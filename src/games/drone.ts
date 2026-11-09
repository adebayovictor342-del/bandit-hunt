import { rr } from "./common";
import { fillCamouflage } from "./camouflage";

export const DRONE_SCALE = 0.72;
export interface DronePose {
  x: number;
  y: number;
  aim: number;
  phase: number;
  vx?: number;
  vy?: number;
  flash?: number;
  friendly?: boolean;
  scale?: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const facingOf = (aim: number) => (Math.cos(aim) >= 0 ? 1 : -1);
const turretAngle = (aim: number) => Math.atan2(Math.sin(aim), Math.cos(aim) * facingOf(aim));

/** Barrel tip follows the visible gimbal, including mirroring and game scale. */
export function droneMuzzle(x: number, y: number, aim: number, scale = DRONE_SCALE) {
  const a = turretAngle(aim);
  return { x: x + facingOf(aim) * scale * (8 + Math.cos(a) * 39), y: y + scale * (11 + Math.sin(a) * 39) };
}

function rotor(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, front = false) {
  ctx.save();
  ctx.translate(x, y);
  const spin = phase * 47 + x;
  const span = 18 + Math.sin(spin) * 3;
  ctx.fillStyle = "rgba(47,48,39,0.13)";
  ctx.beginPath();
  ctx.ellipse(0, -3, 22, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#30332b";
  ctx.lineWidth = front ? 2.8 : 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-span, -3 - Math.sin(spin) * 2);
  ctx.lineTo(span, -3 + Math.sin(spin) * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(201,196,164,0.65)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-span + 2, -4);
  ctx.lineTo(span - 2, -4);
  ctx.stroke();
  const metal = ctx.createLinearGradient(-4, 0, 4, 0);
  metal.addColorStop(0, "#33372e");
  metal.addColorStop(0.5, "#92917a");
  metal.addColorStop(1, "#42463a");
  ctx.fillStyle = metal;
  rr(ctx, -4, -3, 8, 8, 2);
  ctx.fill();
  ctx.fillStyle = "#aaa58a";
  ctx.beginPath();
  ctx.ellipse(0, -3, 3, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.strokeStyle = "#272b23";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x * 0.42, -9);
  ctx.quadraticCurveTo(x * 0.75, y + 8, x, y + 4);
  ctx.stroke();
  ctx.strokeStyle = "#858464";
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = "#424d36";
  rr(ctx, x * 0.66 - 3, y + 1, 7, 4, 1);
  ctx.fill();
  rotor(ctx, x, y, seed, y > -20);
}

function pod(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#3c4432";
  rr(ctx, x, y, 18, 12, 2);
  ctx.fill();
  ctx.strokeStyle = "#20251d";
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.save();
  rr(ctx, x + 1, y + 1, 16, 10, 1);
  fillCamouflage(ctx, x, y, 18, 12, 12);
  ctx.restore();
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillStyle = "#151b17";
      ctx.beginPath();
      ctx.arc(x + 4 + col * 5, y + 4 + row * 5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a49b72";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

/** Detailed military quadcopter: hover, forward tilt and vertical banking are live. */
export function drawMilitaryDrone(ctx: CanvasRenderingContext2D, p: DronePose) {
  const scale = p.scale ?? DRONE_SCALE;
  const facing = facingOf(p.aim);
  const bank = clamp((p.vy ?? 0) / 240, -0.14, 0.14) * facing;
  const forward = clamp(Math.abs(p.vx ?? 0) / 500, 0, 0.07);
  const status = p.friendly ? "#83e5ee" : "#ee6554";
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(facing * scale, scale);
  ctx.rotate(bank + forward);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Rear carbon-fiber arms and shock-mounted motors.
  arm(ctx, -31, -27, p.phase);
  arm(ctx, 31, -27, p.phase + 0.7);
  ctx.strokeStyle = "#252a22";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-29, -20);
  ctx.quadraticCurveTo(-19, 2, -8, -2);
  ctx.moveTo(29, -20);
  ctx.quadraticCurveTo(19, 2, 8, -2);
  ctx.stroke();

  // Reinforced landing struts, behind the sensor payload.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 22, -3);
    ctx.lineTo(side * 28, 25);
    ctx.quadraticCurveTo(side * 28, 29, side * 23, 29);
    ctx.lineTo(side * 12, 29);
    ctx.strokeStyle = "#252a21";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#858361";
    ctx.lineWidth = 2.7;
    ctx.stroke();
    ctx.strokeStyle = "#353d2c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(side * 15, 29);
    ctx.lineTo(side * 24, 29);
    ctx.stroke();
  }

  // Armored avionics bay with woodland panels and a raised top plate.
  ctx.beginPath();
  ctx.moveTo(-35, -14);
  ctx.lineTo(-22, -23);
  ctx.lineTo(18, -23);
  ctx.lineTo(36, -14);
  ctx.lineTo(28, 0);
  ctx.lineTo(-27, 0);
  ctx.closePath();
  ctx.strokeStyle = "#25291f";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  fillCamouflage(ctx, -36, -24, 73, 25, 4);
  ctx.beginPath();
  ctx.moveTo(-18, -23);
  ctx.lineTo(-10, -29);
  ctx.lineTo(12, -29);
  ctx.lineTo(21, -23);
  ctx.closePath();
  ctx.strokeStyle = "#414831";
  ctx.lineWidth = 1;
  ctx.stroke();
  fillCamouflage(ctx, -19, -30, 41, 8, 8);
  ctx.strokeStyle = "rgba(222,211,164,0.65)";
  ctx.beginPath();
  ctx.moveTo(-30, -14);
  ctx.lineTo(-20, -19);
  ctx.lineTo(17, -19);
  ctx.stroke();
  ctx.strokeStyle = "#343c2b";
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(side * (18 + i * 3), -13);
      ctx.lineTo(side * (16 + i * 3), -8);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#454d36";
  rr(ctx, -7, -15, 14, 5, 1);
  ctx.fill();
  ctx.fillStyle = "#b5ae83";
  ctx.font = "bold 5px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AF", -11, -7);
  ctx.fillStyle = status;
  ctx.fillRect(9, -13, 3, 1.7);

  // Front arms, ammunition pods and replaceable payload boxes.
  arm(ctx, -45, -16, p.phase + 1.3);
  arm(ctx, 45, -16, p.phase + 2.1);
  pod(ctx, -41, -1);
  pod(ctx, 24, -1);
  ctx.save();
  rr(ctx, -22, 0, 13, 13, 2);
  fillCamouflage(ctx, -22, 0, 13, 13, 16);
  ctx.restore();
  ctx.strokeStyle = "#303729";
  ctx.lineWidth = 1;
  rr(ctx, -22, 0, 13, 13, 2);
  ctx.stroke();
  ctx.fillStyle = "#414932";
  ctx.fillRect(-20, 3, 9, 2);

  // Stabilized electro-optical gimbal and thermal lens.
  ctx.fillStyle = "#292f27";
  rr(ctx, -8, 1, 17, 6, 2);
  ctx.fill();
  ctx.fillStyle = "#8c8c6b";
  ctx.fillRect(-5, 5, 3, 5);
  ctx.fillRect(4, 5, 3, 5);
  ctx.save();
  rr(ctx, -10, 8, 21, 16, 3);
  fillCamouflage(ctx, -10, 8, 21, 16, 22);
  ctx.restore();
  ctx.strokeStyle = "#222a22";
  ctx.lineWidth = 1.5;
  rr(ctx, -10, 8, 21, 16, 3);
  ctx.stroke();
  ctx.fillStyle = "#202d2b";
  ctx.beginPath();
  ctx.arc(2, 16, 6.1, 0, Math.PI * 2);
  ctx.fill();
  const lens = ctx.createRadialGradient(0, 14, 0.5, 2, 16, 4.6);
  lens.addColorStop(0, "#c8f6ee");
  lens.addColorStop(0.3, "#4eabb1");
  lens.addColorStop(0.7, "#235563");
  lens.addColorStop(1, "#102b35");
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(2, 16, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(239,255,247,0.85)";
  ctx.beginPath();
  ctx.arc(0.5, 14.4, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Side-mounted multi-barrel turret tracks the actual firing direction.
  ctx.save();
  ctx.translate(8, 11);
  ctx.rotate(turretAngle(p.aim));
  ctx.fillStyle = "#3d4735";
  rr(ctx, -2, -6, 13, 12, 2);
  ctx.fill();
  ctx.strokeStyle = "#1d251e";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#8b8055";
  for (let i = 0; i < 4; i++) ctx.fillRect(1 + i * 2, 5, 1.3, 3);
  ctx.fillStyle = "#252d28";
  rr(ctx, 10, -4.5, 26, 9, 1);
  ctx.fill();
  ctx.strokeStyle = "#879083";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(12, -3 + i * 3);
    ctx.lineTo(36, -3 + i * 3);
    ctx.stroke();
  }
  ctx.fillStyle = "#4b5549";
  rr(ctx, 28, -5.5, 4, 11, 1);
  ctx.fill();
  ctx.fillStyle = "#151d19";
  ctx.beginPath();
  ctx.ellipse(38, 0, 2.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if ((p.flash ?? 0) > 0) {
    ctx.fillStyle = `rgba(255,190,76,${Math.min(1, (p.flash ?? 0) * 7)})`;
    ctx.beginPath();
    ctx.moveTo(39, -3);
    ctx.lineTo(48, -6);
    ctx.lineTo(45, -1);
    ctx.lineTo(56, 0);
    ctx.lineTo(45, 2);
    ctx.lineTo(48, 6);
    ctx.lineTo(39, 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
