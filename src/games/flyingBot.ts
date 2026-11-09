import { rr } from "./common";

/** Enemy hover bot: armored camera chassis, vector thrusters and chin cannon. */
export const FLYING_BOT_SCALE = 0.7;
export interface FlyingBotPose {
  x: number;
  y: number;
  aim: number;
  phase: number;
  flash?: number;
  scale?: number;
}
const facingOf = (aim: number) => (Math.cos(aim) >= 0 ? 1 : -1);
const aimLocal = (aim: number) => Math.atan2(Math.sin(aim), Math.cos(aim) * facingOf(aim));

export function flyingBotMuzzle(x: number, y: number, aim: number, scale = FLYING_BOT_SCALE) {
  return { x: x + facingOf(aim) * scale * 56, y: y + scale * 22 };
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = "#555d4d") {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, 2);
  ctx.fill();
  ctx.strokeStyle = "#171e20";
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.strokeStyle = "rgba(190,197,170,0.38)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 1.5);
  ctx.lineTo(x + w - 2, y + 1.5);
  ctx.stroke();
}

function thruster(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, phase: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  panel(ctx, -6, -3, 12, 14, "#414b43");
  ctx.fillStyle = "#1c2729";
  rr(ctx, -7, 8, 14, 5, 1.5);
  ctx.fill();
  ctx.fillStyle = "#94dce0";
  ctx.fillRect(-4, 12, 8, 1.5);
  const len = 19 + Math.sin(phase * 31 + x) * 5;
  const flame = ctx.createLinearGradient(0, 13, 0, 13 + len);
  flame.addColorStop(0, "rgba(226,253,255,0.94)");
  flame.addColorStop(0.28, "rgba(104,219,242,0.7)");
  flame.addColorStop(0.65, "rgba(244,184,139,0.3)");
  flame.addColorStop(1, "rgba(137,221,241,0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-4, 13);
  ctx.quadraticCurveTo(-6, 22, 0, 13 + len);
  ctx.quadraticCurveTo(6, 22, 4, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawFlyingBot(ctx: CanvasRenderingContext2D, p: FlyingBotPose) {
  const scale = p.scale ?? FLYING_BOT_SCALE;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(facingOf(p.aim) * scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Three downward vector jets keep the bot visibly airborne.
  thruster(ctx, -29, 11, 0.56, p.phase);
  thruster(ctx, -13, 22, 0.48, p.phase + 0.6);
  thruster(ctx, 3, 17, 0.35, p.phase + 1.2);

  // Rear power pack, raised stabilizer and exposed armored cabling.
  panel(ctx, -43, -16, 25, 27, "#343d3e");
  ctx.beginPath();
  ctx.moveTo(-35, -17);
  ctx.lineTo(-49, -43);
  ctx.lineTo(-34, -43);
  ctx.lineTo(-15, -18);
  ctx.closePath();
  ctx.fillStyle = "#515d4e";
  ctx.fill();
  ctx.strokeStyle = "#17201e";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#28785e";
  ctx.beginPath();
  ctx.moveTo(-46, -41);
  ctx.lineTo(-36, -41);
  ctx.lineTo(-24, -23);
  ctx.lineTo(-34, -23);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#65977a";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-42 + i * 4, -38);
    ctx.lineTo(-33 + i * 4, -26);
    ctx.stroke();
  }
  for (const [color, dy] of [["#a56347", 0], ["#3b8999", 5], ["#171e21", 10]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-23, -12 + dy);
    ctx.bezierCurveTo(-5, -21 + dy, -17, 18 + dy, 5, 11 + dy);
    ctx.stroke();
  }
  ctx.fillStyle = "#171f21";
  ctx.font = "bold 6px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("07", -30, -5);
  ctx.fillStyle = "#d3d9c7";
  ctx.fillRect(-39, -12, 4, 2);
  ctx.fillStyle = "#399676";
  ctx.fillRect(-34, -12, 4, 2);

  // Main angular armored camera body.
  ctx.beginPath();
  ctx.moveTo(-18, -23);
  ctx.lineTo(19, -23);
  ctx.lineTo(33, -15);
  ctx.lineTo(30, 10);
  ctx.lineTo(12, 19);
  ctx.lineTo(-18, 13);
  ctx.closePath();
  ctx.fillStyle = "#59634f";
  ctx.fill();
  ctx.strokeStyle = "#141d1d";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = "#747b60";
  ctx.beginPath();
  ctx.moveTo(-16, -21);
  ctx.lineTo(17, -21);
  ctx.lineTo(25, -15);
  ctx.lineTo(-17, -14);
  ctx.closePath();
  ctx.fill();
  panel(ctx, -13, -10, 22, 21, "#626b56");
  ctx.strokeStyle = "#3b493e";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-10, -7 + i * 6);
    ctx.lineTo(-4, -2 + i * 6);
    ctx.lineTo(2, -7 + i * 6);
    ctx.stroke();
  }
  ctx.fillStyle = "#e2e5d4";
  ctx.beginPath();
  ctx.moveTo(-5, -20);
  ctx.lineTo(0, -20);
  ctx.lineTo(-4, -14);
  ctx.lineTo(-9, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3b9c76";
  ctx.fillRect(2, -20, 6, 3);

  // Black sensor hood and bright electro-optical lens.
  ctx.beginPath();
  ctx.moveTo(22, -22);
  ctx.lineTo(42, -20);
  ctx.lineTo(53, -10);
  ctx.lineTo(47, 14);
  ctx.lineTo(26, 16);
  ctx.lineTo(19, 8);
  ctx.closePath();
  ctx.fillStyle = "#202a2d";
  ctx.fill();
  ctx.strokeStyle = "#11191c";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = "#dce3d1";
  ctx.beginPath();
  ctx.moveTo(28, -19);
  ctx.lineTo(39, -18);
  ctx.lineTo(45, -13);
  ctx.lineTo(34, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#329773";
  ctx.fillRect(24, -19, 4, 5);
  ctx.fillStyle = "#101c23";
  ctx.beginPath();
  ctx.ellipse(38, -1, 12, 14, 0.12, 0, Math.PI * 2);
  ctx.fill();
  const lens = ctx.createRadialGradient(35, -4, 1, 38, -1, 10);
  lens.addColorStop(0, "#e1ffff");
  lens.addColorStop(0.25, "#87f5f5");
  lens.addColorStop(0.65, "#36bccb");
  lens.addColorStop(1, "#174957");
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.ellipse(38, -1, 8.5, 10, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5ce2d0";
  ctx.fillRect(21, 5, 5, 2.5);

  // Antenna and independent top sensor.
  ctx.strokeStyle = "#263b36";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -23);
  ctx.lineTo(-13, -44);
  ctx.stroke();
  ctx.fillStyle = "#64d9cd";
  rr(ctx, -15, -48, 4, 5, 1);
  ctx.fill();
  panel(ctx, -2, -33, 28, 10, "#414e43");
  ctx.fillStyle = "#182729";
  ctx.beginPath();
  ctx.arc(20, -28, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ee9e5";
  ctx.beginPath();
  ctx.arc(20, -28, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9dfcd";
  ctx.fillRect(3, -31, 3, 5);
  ctx.fillRect(8, -31, 3, 5);

  // Articulated side armor, not landing legs.
  ctx.strokeStyle = "#172123";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-3, 3);
  ctx.lineTo(-17, 21);
  ctx.lineTo(-24, 17);
  ctx.stroke();
  ctx.strokeStyle = "#79816b";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#293632";
  ctx.beginPath();
  ctx.arc(-3, 3, 4, 0, Math.PI * 2);
  ctx.fill();
  panel(ctx, 7, 8, 15, 14, "#626b57");
  ctx.fillStyle = "#29382f";
  ctx.fillRect(11, 12, 7, 3);
  ctx.fillStyle = "#e0e4cf";
  ctx.fillRect(13, 8, 3, 3);

  // Fixed chin cannon with a short, direction-aligned firing flash.
  panel(ctx, 10, 18, 24, 9, "#4a5847");
  ctx.fillStyle = "#1a2528";
  rr(ctx, 31, 18, 25, 7, 1);
  ctx.fill();
  ctx.fillStyle = "#596c66";
  ctx.fillRect(36, 19, 16, 1.5);
  ctx.fillStyle = "#7ae7ef";
  ctx.fillRect(54, 19, 2, 5);
  ctx.strokeStyle = "#1a2524";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(17, 27);
  ctx.lineTo(20, 32);
  ctx.lineTo(34, 32);
  ctx.lineTo(37, 27);
  ctx.stroke();
  if ((p.flash ?? 0) > 0) {
    ctx.fillStyle = `rgba(158,240,255,${Math.min(1, (p.flash ?? 0) * 7)})`;
    ctx.beginPath();
    ctx.ellipse(63, 22, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hostile identification is a small red lamp; the optics stay cyan.
  ctx.fillStyle = "#ef705b";
  ctx.beginPath();
  ctx.arc(-17, -17, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
