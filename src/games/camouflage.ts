/** Woodland camouflage shared by the player, allies and armored drone. */
const BASE = "#8b895e";
const PATCHES = ["#566344", "#b0a477", "#66553d", "#354333"];

function noise(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Fill the CURRENT path with stable, irregular woodland patches. */
export function fillCamouflage(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 1) {
  ctx.save();
  ctx.clip();
  ctx.fillStyle = BASE;
  ctx.fillRect(x, y, w, h);
  const cell = Math.max(5, Math.min(15, w / 4));
  const cols = Math.ceil(w / cell) + 2;
  const rows = Math.ceil(h / cell) + 2;
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const n = seed * 97 + row * 31 + col * 7;
      const px = x + col * cell + noise(n) * cell;
      const py = y + row * cell + noise(n + 1) * cell;
      const rw = cell * (0.65 + noise(n + 2) * 0.9);
      const rh = cell * (0.4 + noise(n + 3) * 0.65);
      ctx.fillStyle = PATCHES[Math.floor(noise(n + 4) * PATCHES.length)];
      ctx.beginPath();
      ctx.moveTo(px - rw * 0.5, py);
      ctx.quadraticCurveTo(px - rw * 0.45, py - rh * 0.55, px - rw * 0.1, py - rh * 0.4);
      ctx.quadraticCurveTo(px + rw * 0.3, py - rh * 0.65, px + rw * 0.45, py - rh * 0.15);
      ctx.quadraticCurveTo(px + rw * 0.7, py + rh * 0.25, px + rw * 0.25, py + rh * 0.4);
      ctx.quadraticCurveTo(px - rw * 0.05, py + rh * 0.7, px - rw * 0.35, py + rh * 0.35);
      ctx.quadraticCurveTo(px - rw * 0.65, py + rh * 0.25, px - rw * 0.5, py);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  // Clipping saves drawing state, not the current path. Clear the last patch
  // so a caller's later stroke cannot accidentally outline a camo blob.
  ctx.beginPath();
}

/** Camo cloth on a stroked limb, without breaking its animation or silhouette. */
export function camoLimb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, camo: boolean) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = camo ? "#737950" : "#111315";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (camo) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let i = 0; i < 3; i++) {
      const a = 0.14 + i * 0.28;
      ctx.strokeStyle = PATCHES[i];
      ctx.lineWidth = width * 0.72;
      ctx.beginPath();
      ctx.moveTo(x1 + dx * a, y1 + dy * a);
      ctx.lineTo(x1 + dx * (a + 0.13), y1 + dy * (a + 0.13));
      ctx.stroke();
    }
  }
  ctx.restore();
}
