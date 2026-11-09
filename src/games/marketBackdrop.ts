import { H, W } from "./common";

/** Background 4: dusty Nigerian market, not the paved City Center street. */
function noise(n: number) {
  const x = Math.sin(n * 131.7 + 73.1) * 43758.5453;
  return x - Math.floor(x);
}

function dustCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.24);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, `rgba(218,185,137,${alpha})`);
  g.addColorStop(0.55, `rgba(218,185,137,${alpha * 0.45})`);
  g.addColorStop(1, "rgba(218,185,137,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

export function drawMarketAtmosphere(ctx: CanvasRenderingContext2D, scroll: number, t: number, g0: number) {
  for (let i = 0; i < Math.round(W / 42); i++) {
    const h = noise(i + 8100);
    const x = ((h * W + t * (12 + h * 15) + scroll * 0.12) % (W + 24)) - 12;
    const y = g0 - 8 - noise(i + 8200) * 95 + Math.sin(t * 0.8 + i) * 3;
    ctx.fillStyle = `rgba(231,204,159,${0.14 + h * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + h * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const x = ((t * (9 + i * 2) + i * W * 0.39 + scroll * 0.08) % (W + 220)) - 110;
    dustCloud(ctx, x, g0 - 26 - i * 25, 100 + i * 15, 0.085);
  }
}

export function drawMarketFloor(ctx: CanvasRenderingContext2D, scroll: number, g0: number) {
  ctx.save();
  const span = Math.max(20, H - g0);
  const earth = ctx.createLinearGradient(0, g0 - 8, 0, H);
  earth.addColorStop(0, "rgba(184,137,83,0)");
  earth.addColorStop(0.4, "rgba(184,137,83,0.10)");
  earth.addColorStop(1, "rgba(150,105,61,0.23)");
  ctx.fillStyle = earth;
  ctx.fillRect(-20, g0 - 8, W + 40, span + 28);

  const shadow = ctx.createLinearGradient(0, g0 - 1, 0, g0 + 6);
  shadow.addColorStop(0, "rgba(87,57,31,0.20)");
  shadow.addColorStop(1, "rgba(87,57,31,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(-20, g0 - 1, W + 40, 7);

  // Shallow wheel ruts in compacted earth; no lane paint or asphalt cracks.
  const off = scroll * 0.8;
  for (const [depth, phase] of [[0.4, 0], [0.56, 0.16]]) {
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 10) {
      const y = g0 + span * depth + Math.sin((x + off) * 0.009 + phase) * 1.8;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(104,72,40,0.13)";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(232,196,141,0.16)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const step = 72;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const h = noise(i + 8300);
    if (h < 0.45) continue;
    const x = i * step - off + h * 32;
    const y = g0 + 8 + noise(i + 8400) * (span - 10);
    const r = 1 + h * 1.6;
    ctx.fillStyle = "rgba(110,83,53,0.56)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,188,139,0.5)";
    ctx.fillRect(x - r * 0.5, y - r * 0.4, r, 0.7);
  }
  ctx.restore();
}

function produceCrate(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = "rgba(124,85,46,0.94)";
  ctx.fillRect(x, y, 34, 20);
  ctx.strokeStyle = "rgba(65,44,26,0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 34, 20);
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y + k * 5);
    ctx.lineTo(x + 34, y + k * 5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(163,119,67,0.95)";
  ctx.fillRect(x + 3, y, 3, 20);
  ctx.fillRect(x + 28, y, 3, 20);
  for (let k = 0; k < 9; k++) {
    const h = noise(seed * 20 + k);
    ctx.fillStyle = seed % 2 ? "#a94d35" : "#697342";
    ctx.beginPath();
    ctx.arc(x + 5 + k * 3, y - 1 - h * 3, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sack(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(169,144,98,0.94)";
  ctx.strokeStyle = "rgba(91,72,43,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 24);
  ctx.bezierCurveTo(x - 14, y - 15, x - 14, y - 2, x - 7, y);
  ctx.quadraticCurveTo(x, y + 3, x + 8, y);
  ctx.bezierCurveTo(x + 14, y - 4, x + 11, y - 17, x + 5, y - 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 23);
  ctx.lineTo(x + 6, y - 23);
  ctx.moveTo(x - 4, y - 18);
  ctx.quadraticCurveTo(x - 8, y - 8, x - 5, y - 4);
  ctx.stroke();
}

export function drawMarketForeground(ctx: CanvasRenderingContext2D, scroll: number, t: number, g0: number) {
  ctx.save();
  // Dust crosses the lower equipment silhouettes, but never whites out the arena.
  for (let i = 0; i < 3; i++) {
    const x = ((t * (15 + i * 3) + i * W * 0.41 + scroll * 0.3) % (W + 200)) - 100;
    dustCloud(ctx, x, g0 - 8 - i * 7, 76 + i * 12, 0.13 - i * 0.025);
  }

  // Low market goods stay at the road edge; the fighting lane remains clear.
  const off = scroll * 0.95;
  const step = 610;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const x = i * step - off + 68;
    produceCrate(ctx, x + 12, H - 22, i + 9000);
    sack(ctx, x - 14, H - 3);
  }
  ctx.restore();
}
