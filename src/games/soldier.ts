import { clamp, H, rr } from "./common";
import { camoLimb, fillCamouflage } from "./camouflage";
import { drawDagger } from "./dagger";

export type Stance = "stand" | "kneel" | "prone";
export type Faction = "soldier" | "bandit";
export type GunKind = "rifle" | "mg" | "dagger";
export const STANCE_HITBOX: Record<Stance, number> = { stand: 18, kneel: 15, prone: 10 };
export const STANCE_SPEED: Record<Stance, number> = { stand: 1, kneel: 0.72, prone: 0.42 };
export const STANCE_THRUST: Record<Stance, number> = { stand: 1, kneel: 0.75, prone: 0.3 };
export const nextStance = (s: Stance): Stance => s === "stand" ? "kneel" : s === "kneel" ? "prone" : "stand";
export const FIGHTER_RELOAD_SECONDS = 1.65;

export interface FighterAnimation {
  speed?: number;
  gait?: number;
  moveBlend?: number;
  aimAngle?: number;
  hit?: number;
  reload?: number;
  crouch?: number;
  phase?: number;
  throwProgress?: number;
}
export interface SoldierOpts {
  x: number;
  y: number; // feet anchor
  aim: number;
  stance: Stance;
  phase: number;
  moving: boolean;
  airborne: boolean;
  faction: Faction;
  team: string;
  gun: GunKind;
  flash: number;
  jet?: boolean;
  scale?: number;
  female?: boolean;
  animation?: FighterAnimation;
}
export interface BattleOperativePose {
  x: number;
  y: number; // Battle Mode's centered anchor
  facing: number;
  aim: number;
  phase: number;
  jet: boolean;
  flash: number;
  camo: boolean;
  female: boolean;
  trim: string;
  stance?: Stance;
  scale?: number;
  moving?: boolean;
  airborne?: boolean;
  weapon?: GunKind;
  animation?: FighterAnimation;
}

const crouchOf = (stance: Stance = "stand", animation?: FighterAnimation) => clamp(animation?.crouch ?? (stance === "kneel" ? 1 : stance === "prone" ? 2 : 0), 0, 2);
/** World-proportional size: approximately 18% of the visible field high. */
export const fighterScale = () => 1.75 * clamp(H / 360, 0.8, 4);
/** Distance from the sprite's centered rig to its soles, in unscaled art units. */
export const fighterFootOffset = (crouch: number) => 16 - clamp(crouch, 0, 1) * 8 - clamp(crouch - 1, 0, 1) * 6;

export interface FighterBounds { left: number; right: number; top: number; bottom: number }
/** Character collision and overhead labels use the same scale and planted feet. */
export function fighterBounds(x: number, feetY: number, aim: number, stance: Stance = "stand", scale = fighterScale(), animation?: FighterAnimation): FighterBounds {
  const c = crouchOf(stance, animation);
  const kneel = clamp(c, 0, 1), prone = clamp(c - 1, 0, 1);
  const backwards = (9 + 3 * kneel + 17 * prone) * scale;
  const forwards = (9 + 3 * kneel + 10 * prone) * scale;
  const facing = Math.cos(aim) >= 0 ? 1 : -1;
  return {
    left: x - (facing > 0 ? backwards : forwards),
    right: x + (facing > 0 ? forwards : backwards),
    top: feetY - (37.5 - kneel * 8 - prone * 16) * scale,
    bottom: feetY + 0.5,
  };
}
export function pointInFighter(x: number, y: number, bounds: FighterBounds, padding = 0) {
  return x >= bounds.left - padding && x <= bounds.right + padding && y >= bounds.top - padding && y <= bounds.bottom + padding;
}
const facingOf = (aim: number) => Math.cos(aim) >= 0 ? 1 : -1;
const localAngle = (aim: number, facing: number) => Math.atan2(Math.sin(aim), Math.cos(aim) * facing);

/** Journey enemies face left; the player's and Battle fighters' aim is unrestricted. */
export function leftFacingAim(aim: number) {
  return Math.PI - clamp(Math.atan2(Math.sin(aim), Math.abs(Math.cos(aim))), -0.65, 0.65);
}

function weaponRig(aim: number, facing: number, crouch: number, weapon: GunKind) {
  const prone = clamp(crouch - 1, 0, 1);
  return { angle: localAngle(aim, facing), x: prone * 11, y: -prone * 4, tip: weapon === "mg" ? 36 : weapon === "dagger" ? 22 : 32 };
}

/** Shared geometry: visible barrels and actual projectiles use the same anchor. */
export function operativeMuzzle(x: number, y: number, aim: number, scale = 1, weapon: GunKind = "rifle", crouch = 0) {
  const facing = facingOf(aim), r = weaponRig(aim, facing, crouch, weapon);
  return {
    x: x + facing * scale * (r.x + Math.cos(r.angle) * r.tip + Math.sin(r.angle) * 5),
    y: y + scale * (r.y + Math.sin(r.angle) * r.tip - Math.cos(r.angle) * 5),
  };
}

export function soldierMuzzle(x: number, feetY: number, aim: number, stance: Stance, scale = 1, weapon: GunKind = "rifle", animation?: FighterAnimation) {
  const crouch = crouchOf(stance, animation);
  const resolvedAim = animation ? leftFacingAim(aim) : aim;
  return operativeMuzzle(x, feetY - fighterFootOffset(crouch) * scale, resolvedAim, scale, weapon, crouch);
}

/** Feet-anchored Journey wrapper around the exact same avatar used in Battle Mode. */
export function drawSoldier(ctx: CanvasRenderingContext2D, p: SoldierOpts) {
  const scale = p.scale ?? 1;
  const crouch = crouchOf(p.stance, p.animation);
  const aim = p.faction === "bandit" ? leftFacingAim(p.animation?.aimAngle ?? p.aim) : p.aim;
  drawBattleOperative(ctx, {
    x: p.x, y: p.y - fighterFootOffset(crouch) * scale, facing: facingOf(aim), aim,
    phase: p.phase, jet: !!p.jet, flash: p.flash, camo: p.faction === "soldier",
    female: !!p.female, trim: p.team, stance: p.stance, scale,
    moving: p.moving, airborne: p.airborne, weapon: p.gun, animation: p.animation,
  });
}

function palm(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ad8059";
  rr(ctx, x - 1.9, y - 1.6, 4.6, 3.7, 1.1);
  ctx.fill();
  ctx.strokeStyle = "#644f3c";
  ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(x, y - 1); ctx.lineTo(x + 0.2, y + 1.5); ctx.stroke();
}

function throwHand(progress: number) {
  if (progress < 0) return { x: 8, y: -3 };
  if (progress < 0.35) {
    const k = progress / 0.35;
    return { x: 8 - k * 15, y: -3 - k * 15 };
  }
  if (progress < 0.57) {
    const k = (progress - 0.35) / 0.22;
    return { x: -7 + k * 25, y: -18 + k * 13 };
  }
  const k = clamp((progress - 0.57) / 0.43, 0, 1);
  return { x: 18 - k * 10, y: -5 + k * 2 };
}

/** Compact Battle Mode avatar: simple supported arms, no crossed IK joints. */
export function drawBattleOperative(ctx: CanvasRenderingContext2D, p: BattleOperativePose) {
  const scale = p.scale ?? 1;
  const crouch = crouchOf(p.stance, p.animation);
  const kneel = clamp(crouch, 0, 1), prone = clamp(crouch - 1, 0, 1);
  const moving = p.animation?.moveBlend ?? (p.moving === false ? 0 : 1);
  const gait = p.animation?.gait ?? p.phase * (p.female ? 12 : 10);
  const stride = Math.sin(gait) * 3 * moving * (1 - prone);
  const weapon = p.weapon ?? "rifle";
  const rig = weaponRig(p.aim, p.facing, crouch, weapon);
  const dark = p.camo ? "#424d35" : "#080a0b";
  if (!p.airborne) {
    ctx.save();
    ctx.fillStyle = "rgba(22,22,16,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + fighterFootOffset(crouch) * scale + 0.8, (9 + prone * 7) * scale, 1.7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing * scale, scale);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (!p.airborne) {
    // As the body rotates between stances, keep every part above the same
    // walking plane while leaving the planted soles exactly on its edge.
    ctx.beginPath();
    ctx.rect(-1000, -1000, 2000, 1000 + fighterFootOffset(crouch));
    ctx.clip();
  }

  if (p.jet) {
    const fl = 9 + Math.sin(p.phase * 37) * 3;
    const g = ctx.createLinearGradient(0, 4, 0, 20);
    g.addColorStop(0, "#ffe39a"); g.addColorStop(1, "rgba(255,96,48,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(-8, 4 + fl); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = dark;
  rr(ctx, -11, -8, 6, 14, 2); ctx.fill();

  // The ankles and boot soles interpolate together through standing, kneeling
  // and prone. Their lowest point is always exactly fighterFootOffset(crouch).
  const morph = (standing: number, kneeling: number, lying: number) => {
    const first = standing + (kneeling - standing) * kneel;
    return first + (lying - first) * prone;
  };
  const back = {
    hip: { x: morph(-1, -1, -2), y: morph(3, 3, 0) },
    knee: { x: morph(-3 - stride * 0.5, -8, -13), y: morph(8, 5, 0) },
    ankle: { x: morph(-5 - stride, -12, -23), y: morph(13.5, 6, -0.25) },
  };
  const front = {
    hip: { x: morph(1, 1, -3), y: morph(3, 2, -3) },
    knee: { x: morph(3 + stride * 0.5, 7, -15), y: morph(8, -1, -3.5) },
    ankle: { x: morph(6 + stride, 7, -25), y: morph(13.5, 6, -0.25) },
  };
  camoLimb(ctx, back.hip.x, back.hip.y, back.knee.x, back.knee.y, 4.5, p.camo);
  camoLimb(ctx, back.knee.x, back.knee.y, back.ankle.x, back.ankle.y, 4, p.camo);
  camoLimb(ctx, front.hip.x, front.hip.y, front.knee.x, front.knee.y, 4.5, p.camo);
  camoLimb(ctx, front.knee.x, front.knee.y, front.ankle.x, front.ankle.y, 4, p.camo);
  const bootBottom = fighterFootOffset(crouch);
  const bootHeight = morph(4, 3, 7);
  ctx.fillStyle = "#090b0c";
  rr(ctx, morph(-8 - stride, -14, -29), bootBottom - bootHeight, 7, bootHeight, 1.5); ctx.fill();
  rr(ctx, morph(3 + stride, 5, -27), bootBottom - bootHeight, 8, bootHeight, 1.5); ctx.fill();
  ctx.save();
  ctx.rotate(prone * 1.25);
  ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(7, -9); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath();
  if (p.camo) fillCamouflage(ctx, -7, -9, 14, 14, 9);
  else { ctx.fillStyle = "#101214"; ctx.fill(); }
  ctx.fillStyle = dark; rr(ctx, -5.5, -7, 11, 10, 2); ctx.fill();
  ctx.fillStyle = p.camo ? "#737951" : "#262a2b";
  for (let i = 0; i < 3; i++) ctx.fillRect(-4.5 + i * 3.3, -2, 2.6, 4);
  ctx.fillStyle = p.trim; ctx.fillRect(-7, -8, 2.5, 2.5);

  ctx.fillStyle = "#a77853"; ctx.beginPath(); ctx.arc(0, -14, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -15, 6.4, Math.PI, Math.PI * 2); ctx.lineTo(6.4, -13); ctx.lineTo(-6.4, -13); ctx.closePath();
  if (p.camo) fillCamouflage(ctx, -7, -22, 14, 9, 11);
  else { ctx.fillStyle = "#151719"; ctx.fill(); }
  ctx.fillStyle = dark; rr(ctx, -6.5, -14, 13, 2.5, 1); ctx.fill();
  ctx.fillStyle = "#263b3a"; rr(ctx, 0, -15, 5, 2.5, 1); ctx.fill();
  if (p.female) {
    ctx.strokeStyle = "#211a14"; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-5, -16); ctx.quadraticCurveTo(-10, -13, -9, -8); ctx.quadraticCurveTo(-9, -5, -12, -3);
    ctx.stroke();
    ctx.fillStyle = "#d7bd75";
    ctx.beginPath(); ctx.arc(-9, -8, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.save(); ctx.translate(rig.x, rig.y); ctx.rotate(rig.angle);
  if (weapon === "dagger") {
    const progress = p.animation?.throwProgress ?? -1;
    const hand = throwHand(progress);
    const elbow = { x: hand.x * 0.4, y: Math.max(-11, hand.y * 0.45 + 1) };
    camoLimb(ctx, 0, -5, elbow.x, elbow.y, 3.8, p.camo);
    camoLimb(ctx, elbow.x, elbow.y, hand.x, hand.y, 3.5, p.camo);
    palm(ctx, hand.x, hand.y);
    if (progress < 0.57) drawDagger(ctx, hand.x + 4, hand.y, 0, 0.21);
    camoLimb(ctx, -2, -4, 3, 2, 3.2, p.camo);
  } else {
    // Both sleeves and palms share the weapon's mirrored frame. Nothing twists
    // independently of the rifle when aiming left or returning from a reload.
    camoLimb(ctx, 0, -5, 11, -3, 3.8, p.camo);
    camoLimb(ctx, 2, -4, 8, 2, 3.4, p.camo);
    camoLimb(ctx, 8, 2, 22, -3, 3.2, p.camo);
    ctx.fillStyle = "#111719"; rr(ctx, 10, -8, 15, 6, 1.3); ctx.fill();
    ctx.fillRect(24, -6.5, weapon === "mg" ? 12 : 8, 2.8);
    const reload = p.animation?.reload ?? 0;
    const magDrop = reload > 0 ? Math.sin((1 - clamp(reload / FIGHTER_RELOAD_SECONDS, 0, 1)) * Math.PI) * 3 : 0;
    ctx.fillRect(15, -2 + magDrop, 3.5, 4);
    ctx.fillStyle = "#68716a"; ctx.fillRect(12, -7.5, 9, 1);
    palm(ctx, 12, -2.4); palm(ctx, 23, -3);
    if (p.flash > 0) {
      ctx.fillStyle = `rgba(255,202,102,${Math.min(1, p.flash * 7)})`;
      ctx.beginPath(); ctx.moveTo(rig.tip, -8); ctx.lineTo(rig.tip + 11, -5); ctx.lineTo(rig.tip, -1); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}
