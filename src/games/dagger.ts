import { rr } from "./common";

export const DAGGER_SPEED = 340;
export const DAGGER_GRAVITY = 42;
export const DAGGER_THROW_TIME = 0.64;
export const DAGGER_RELEASE_AT = 0.28;
export const DAGGER_DAMAGE = 12;

export interface ThrownDagger {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ownerId: number;
}

/** Reference dagger, points toward +x before rotation. Guard is the origin. */
export function drawDagger(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale = 0.42) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const blade = ctx.createLinearGradient(0, -6, 0, 6);
  blade.addColorStop(0, "#ecfff8");
  blade.addColorStop(0.36, "#88a9a3");
  blade.addColorStop(0.52, "#d8ece0");
  blade.addColorStop(0.58, "#355e61");
  blade.addColorStop(1, "#153f43");
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(1, -6);
  ctx.lineTo(32, -4.8);
  ctx.lineTo(45, 0);
  ctx.lineTo(31, 5);
  ctx.lineTo(1, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#31514d";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.strokeStyle = "#d1e9d8";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(43, 0);
  ctx.stroke();

  const grip = ctx.createLinearGradient(0, -3, 0, 3);
  grip.addColorStop(0, "#a58d72");
  grip.addColorStop(0.5, "#71523d");
  grip.addColorStop(1, "#382c24");
  ctx.fillStyle = grip;
  rr(ctx, -22, -3.4, 22, 6.8, 1.5);
  ctx.fill();
  ctx.strokeStyle = "#392b21";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const gx = -20 + i * 5;
    ctx.strokeStyle = "#c4ae8d";
    ctx.beginPath(); ctx.moveTo(gx, -3); ctx.lineTo(gx - 0.6, 3); ctx.stroke();
  }

  const gold = ctx.createLinearGradient(-3, -12, 3, 12);
  gold.addColorStop(0, "#fbf3ab");
  gold.addColorStop(0.35, "#c8b245");
  gold.addColorStop(0.6, "#ffeaa0");
  gold.addColorStop(1, "#9a8329");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-4, -9); ctx.quadraticCurveTo(2, -10, 2, -15);
  ctx.lineTo(5, -12); ctx.lineTo(4, -8); ctx.lineTo(7, -6);
  ctx.lineTo(4, 0); ctx.lineTo(7, 6); ctx.lineTo(4, 8);
  ctx.lineTo(5, 12); ctx.lineTo(2, 15);
  ctx.quadraticCurveTo(2, 10, -4, 9);
  ctx.lineTo(-2, 0); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#9a8c35";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.strokeStyle = "#fff5bb";
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(2, -6); ctx.lineTo(0, -1); ctx.stroke();

  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-22, -4); ctx.lineTo(-27, -7); ctx.lineTo(-32, 0);
  ctx.lineTo(-27, 7); ctx.lineTo(-22, 4); ctx.lineTo(-24, 0); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#99852d";
  ctx.stroke();
  const gem = ctx.createRadialGradient(-1, -0.8, 0.1, 0, 0, 3.1);
  gem.addColorStop(0, "#ff8a67"); gem.addColorStop(0.4, "#e72b1d"); gem.addColorStop(1, "#8f0c08");
  ctx.fillStyle = gem;
  ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 2.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#b92315";
  ctx.beginPath(); ctx.ellipse(-27, 0, 2.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffcab0";
  ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
