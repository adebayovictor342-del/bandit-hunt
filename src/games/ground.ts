import { H, W } from "./common";
import type { BackgroundId } from "./skirmishTypes";

type GroundPalette = { edge: string; top: string; base: string; bottom: string; light: string; stone: string };
const PALETTES: Record<BackgroundId, GroundPalette> = {
  "village-one": { edge: "#8b602e", top: "#ceaa6c", base: "#bd9052", bottom: "#aa7741", light: "rgba(246,220,161,0.28)", stone: "#866c50" },
  "village-two": { edge: "#4d4935", top: "#9a8661", base: "#82704e", bottom: "#67583f", light: "rgba(210,190,151,0.24)", stone: "#625c49" },
  "background-three": { edge: "#c2beb0", top: "#5d6260", base: "#4d5351", bottom: "#3e4444", light: "rgba(202,204,191,0.16)", stone: "#858985" },
  "background-four": { edge: "#785c42", top: "#bf9c77", base: "#a9815f", bottom: "#927052", light: "rgba(233,205,171,0.2)", stone: "#786858" },
};

function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A continuous painted ground plane. The top edge is the exact collision line;
 * texture remains below that edge so character feet never float above the art.
 */
export function drawGround(ctx: CanvasRenderingContext2D, background: BackgroundId, groundY: number, scroll: number) {
  const p = PALETTES[background];
  const depth = Math.max(1, H - groundY);
  const g = ctx.createLinearGradient(0, groundY, 0, H + 10);
  g.addColorStop(0, p.top);
  g.addColorStop(0.2, p.base);
  g.addColorStop(1, p.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-50, groundY, W + 100, depth + 60);
  ctx.fillStyle = p.edge;
  ctx.fillRect(-50, groundY, W + 100, 1.2);
  ctx.fillStyle = p.light;
  ctx.fillRect(-50, groundY + 1.2, W + 100, 1);

  const offset = scroll * 0.7;
  const step = background === "background-three" ? 58 : 42;
  const first = Math.floor(offset / step) - 2;
  const count = Math.ceil(W / step) + 5;
  for (let i = first; i < first + count; i++) {
    const h = hash(i + 109);
    const x = i * step - offset + h * 30;
    const y = groundY + 5 + hash(i + 911) * Math.max(1, depth - 9);
    if (background === "background-three") {
      ctx.strokeStyle = p.light;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7 + h * 8, y - 0.5); ctx.stroke();
    } else {
      ctx.fillStyle = p.stone;
      ctx.beginPath(); ctx.ellipse(x, y, 1.3 + h * 2.2, 0.55 + h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.light;
      ctx.beginPath(); ctx.ellipse(x - 0.4, y - 0.5, 0.8 + h, 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.light;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x + 10, y + 1); ctx.lineTo(x + 15 + h * 8, y + 0.5); ctx.stroke();
    }
  }
}
