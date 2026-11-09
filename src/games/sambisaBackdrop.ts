import { H, W } from "./common";
import type { BackgroundId } from "./skirmishTypes";
import { drawMarketAtmosphere, drawMarketFloor, drawMarketForeground } from "./marketBackdrop";
import { drawGround } from "./ground";

/**
 * Painted arenas: Village One, Village Two, Background 3 and the dusty market.
 * Each scene pans slowly inside its own width and has its own floor,
 * atmosphere and foreground cover, so gameplay detail is not presented
 * identically in every background.
 */

interface Art {
  src: string;
  horizon: number;
  plumes: { u: number; v: number }[];
  smokeScale?: number;
}

const ART: Record<BackgroundId, Art> = {
  "village-one": {
    src: "/images/village-one.jpg",
    horizon: 0.42,
    plumes: [
      { u: 0.655, v: 0.41 },
      { u: 0.805, v: 0.41 },
    ],
  },
  "village-two": {
    src: "/images/village-two-updated.jpg",
    horizon: 0.5,
    plumes: [
      { u: 0.61, v: 0.43 },
      { u: 0.72, v: 0.43 },
    ],
  },
  "background-three": {
    src: "/images/background-three.jpg",
    horizon: 0.4,
    plumes: [],
  },
  "background-four": {
    src: "/images/background-four.jpg",
    horizon: 0.4,
    plumes: [
      { u: 0.363, v: 0.395 },
      { u: 0.675, v: 0.39 },
    ],
    smokeScale: 0.8,
  },
};

/** slow back-and-forth pan: one full sweep takes about 60 s at game scroll speed */
const PAN_RATE = 0.0026;
const FLOOR_SPEED = 1.4;

const cache = new Map<BackgroundId, HTMLImageElement>();

export function preloadSambisa(background: BackgroundId = "village-one") {
  if (typeof window === "undefined" || cache.has(background)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = ART[background].src;
  cache.set(background, img);
}

function ready(background: BackgroundId): HTMLImageElement | null {
  preloadSambisa(background);
  const img = cache.get(background);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/* deterministic pseudo-random for stable scenery per tile index */
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function sky(ctx: CanvasRenderingContext2D, g0: number, background: BackgroundId) {
  const g = ctx.createLinearGradient(0, 0, 0, g0);
  if (background === "background-four") {
    g.addColorStop(0, "#bfdce8");
    g.addColorStop(0.55, "#e7dfc9");
    g.addColorStop(1, "#b78f60");
  } else if (background === "background-three") {
    g.addColorStop(0, "#c3dfe9");
    g.addColorStop(0.6, "#e5ebe3");
    g.addColorStop(1, "#a6ae91");
  } else if (background === "village-two") {
    g.addColorStop(0, "#bfd9de");
    g.addColorStop(0.55, "#e8efdc");
    g.addColorStop(1, "#77894f");
  } else {
    g.addColorStop(0, "#cfe3ee");
    g.addColorStop(0.55, "#f3efdf");
    g.addColorStop(0.75, "#f6e7bf");
    g.addColorStop(1, "#e2b65c");
  }
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

function smoke(ctx: CanvasRenderingContext2D, bx: number, by: number, scale: number, t: number, seed: number) {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const life = (t * 0.09 + i / N + seed * 0.37) % 1;
    const rise = life * 120 * scale;
    const drift = (life * life * 80 + Math.sin(t * 0.7 + i * 1.7) * 3) * scale;
    const r = (6 + life * 20) * scale;
    const a = 0.22 * Math.sin(Math.PI * Math.min(1, life * 1.1));
    if (a <= 0.01) continue;
    const shade = Math.round(105 + life * 80);
    const px = bx + drift;
    const py = by - rise;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${shade},${shade},${shade + 4},${a})`);
    g.addColorStop(0.6, `rgba(${shade},${shade},${shade + 4},${a * 0.55})`);
    g.addColorStop(1, `rgba(${shade},${shade},${shade + 4},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

function thornBush(ctx: CanvasRenderingContext2D, x: number, base: number, s: number, seed: number) {
  ctx.strokeStyle = "rgba(74,52,34,0.85)";
  ctx.lineCap = "round";
  const stems = 6 + Math.floor(seed * 4);
  for (let k = 0; k < stems; k++) {
    const ang = -Math.PI / 2 + (k / (stems - 1) - 0.5) * 1.9;
    const len = (11 + hash(seed * 50 + k) * 9) * s;
    const ex = x + Math.cos(ang) * len;
    const ey = base + Math.sin(ang) * len;
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.4 + 2 * s, base + Math.sin(ang) * len * 0.6, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x + (ex - x) * 0.6, base + (ey - base) * 0.6);
    ctx.lineTo(ex + 4 * s * Math.cos(ang + 0.8), ey + 4 * s * Math.sin(ang + 0.8));
    ctx.stroke();
  }
}

function reed(ctx: CanvasRenderingContext2D, x: number, base: number, s: number, seed: number, foreground = false) {
  const stems = 5 + Math.floor(seed * 4);
  ctx.lineCap = "round";
  for (let k = 0; k < stems; k++) {
    const spread = (k / (stems - 1) - 0.5) * 16 * s;
    const len = (18 + hash(seed * 80 + k) * 18) * s;
    const topX = x + spread + Math.sin(seed * 20 + k) * 2;
    const topY = base - len;
    ctx.strokeStyle = foreground ? "rgba(24,48,25,0.82)" : "rgba(48,78,38,0.75)";
    ctx.lineWidth = (foreground ? 1.8 : 1.3) * s;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + spread * 0.3, base - len * 0.6, topX, topY);
    ctx.stroke();
    if ((k + Math.floor(seed * 10)) % 3 === 0) {
      ctx.strokeStyle = "rgba(94,62,35,0.9)";
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY + 5 * s);
      ctx.lineTo(topX, topY - 3 * s);
      ctx.stroke();
    }
  }
}

function sandFloor(ctx: CanvasRenderingContext2D, scroll: number, g0: number) {
  const off = scroll * FLOOR_SPEED;
  const g = ctx.createLinearGradient(0, g0 - 12, 0, H);
  g.addColorStop(0, "rgba(228,182,96,0)");
  g.addColorStop(0.35, "rgba(228,182,96,0.22)");
  g.addColorStop(1, "rgba(206,152,66,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(-40, g0 - 12, W + 80, H - g0 + 52);

  const sh = ctx.createLinearGradient(0, g0 - 1, 0, g0 + 5);
  sh.addColorStop(0, "rgba(140,94,40,0.28)");
  sh.addColorStop(1, "rgba(140,94,40,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(-40, g0 - 1, W + 80, 6);

  const span = H - g0;
  const ps = 38;
  const startI = Math.floor(off / ps) - 1;
  for (let i = startI; i < startI + W / ps + 3; i++) {
    const h1 = hash(i);
    if (h1 < 0.62) continue;
    const h2 = hash(i + 1000);
    const x = i * ps - off + h2 * ps;
    const yy = g0 + 6 + hash(i + 2000) * (span - 8);
    const rx = 1.2 + (h1 - 0.62) * 5;
    ctx.fillStyle = "rgba(112,98,88,0.7)";
    ctx.beginPath();
    ctx.ellipse(x, yy, rx, rx * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(196,184,170,0.55)";
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.25, yy - rx * 0.22, rx * 0.5, rx * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const bs = 230;
  const bStart = Math.floor(off / bs) - 1;
  for (let i = bStart; i < bStart + W / bs + 3; i++) {
    const h = hash(i * 3.7 + 9);
    if (h < 0.55) continue;
    thornBush(ctx, i * bs - off + hash(i + 77) * 120, g0 + 2, 0.7 + h * 0.4, h);
  }
}

function riverFloor(ctx: CanvasRenderingContext2D, scroll: number, g0: number) {
  const off = scroll * FLOOR_SPEED;
  const span = H - g0;
  const g = ctx.createLinearGradient(0, g0 - 12, 0, H);
  g.addColorStop(0, "rgba(78,86,48,0)");
  g.addColorStop(0.35, "rgba(78,80,47,0.28)");
  g.addColorStop(1, "rgba(52,54,32,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(-40, g0 - 12, W + 80, H - g0 + 52);

  const sh = ctx.createLinearGradient(0, g0 - 1, 0, g0 + 5);
  sh.addColorStop(0, "rgba(20,34,18,0.34)");
  sh.addColorStop(1, "rgba(20,34,18,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(-40, g0 - 1, W + 80, 6);

  // slow water sheen under the fighters' feet
  ctx.strokeStyle = "rgba(226,240,210,0.20)";
  ctx.lineWidth = 1;
  const step = 54;
  const startI = Math.floor((off * 0.55) / step) - 1;
  for (let i = startI; i < startI + W / step + 3; i++) {
    const h = hash(i + 4100);
    if (h < 0.3) continue;
    const x = i * step - off * 0.55 + h * 26;
    const y = g0 + 7 + hash(i + 4200) * (span - 10);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12 + h * 18, y);
    ctx.stroke();
  }

  // bank reeds behind the action
  const bs = 190;
  const bStart = Math.floor(off / bs) - 1;
  for (let i = bStart; i < bStart + W / bs + 3; i++) {
    const h = hash(i * 4.3 + 21);
    if (h < 0.48) continue;
    reed(ctx, i * bs - off + hash(i + 88) * 110, g0 + 3, 0.65 + h * 0.35, h);
  }
}

function cityFloor(ctx: CanvasRenderingContext2D, scroll: number, g0: number) {
  // Keep the painted sidewalk and shop fronts visible; only dress the asphalt.
  ctx.save();
  const shadow = ctx.createLinearGradient(0, g0 - 2, 0, g0 + 7);
  shadow.addColorStop(0, "rgba(24,27,28,0.24)");
  shadow.addColorStop(1, "rgba(24,27,28,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(-20, g0 - 2, W + 40, 9);

  const off = scroll * 0.65;
  const step = 67;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const h = hash(i + 7100);
    if (h < 0.45) continue;
    const x = i * step - off + h * 25;
    const y = g0 + 12 + hash(i + 7200) * Math.max(8, H - g0 - 16);
    ctx.strokeStyle = "rgba(174,177,169,0.16)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5, y - 1);
    ctx.lineTo(x + 9, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

function cityForeground(ctx: CanvasRenderingContext2D, scroll: number, g0: number) {
  // Narrow street poles interrupt equipment silhouettes without washing out
  // the scene. No jungle mist, reeds or sand is reused in the city.
  ctx.save();
  const off = scroll * 0.45;
  const step = 540;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const x = i * step - off + 42;
    const top = g0 - 88;
    ctx.strokeStyle = "rgba(53,55,49,0.72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, H + 4);
    ctx.lineTo(x, top);
    ctx.moveTo(x - 9, top + 10);
    ctx.lineTo(x + 9, top + 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(157,163,151,0.8)";
    ctx.fillRect(x - 7, top + 6, 3, 4);
    ctx.fillRect(x + 4, top + 6, 3, 4);

    // A small pavement crate stays below the fighters' feet.
    const bx = x + 13;
    const by = H - 15;
    ctx.fillStyle = "rgba(117,88,54,0.82)";
    ctx.fillRect(bx, by, 23, 15);
    ctx.strokeStyle = "rgba(55,43,29,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, 23, 15);
    ctx.beginPath();
    ctx.moveTo(bx, by + 5);
    ctx.lineTo(bx + 23, by + 5);
    ctx.moveTo(bx + 5, by);
    ctx.lineTo(bx + 5, by + 15);
    ctx.moveTo(bx + 18, by);
    ctx.lineTo(bx + 18, by + 15);
    ctx.stroke();
  }
  ctx.restore();
}

function atmosphere(ctx: CanvasRenderingContext2D, t: number, g0: number, background: BackgroundId) {
  if (background === "background-three") {
    for (let i = 0; i < Math.round(W / 60); i++) {
      const h = hash(i + 6200);
      const x = ((h * W + t * (8 + h * 12)) % (W + 20)) - 10;
      const y = g0 - 12 - hash(i + 6300) * 70 + Math.sin(t + i) * 2;
      ctx.fillStyle = `rgba(239,235,216,${0.08 + h * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + h, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const n = Math.round(W / 26);
  for (let i = 0; i < n; i++) {
    const h = hash(i + 500);
    const x = (((h * W * 3 + t * (18 + h * 30)) % (W + 40)) + W + 40) % (W + 40) - 20;
    const y = g0 - 20 - hash(i + 900) * (g0 * 0.55) + Math.sin(t * 1.3 + i) * 4;
    ctx.fillStyle = background === "village-two" ? `rgba(235,246,220,${0.10 + h * 0.13})` : `rgba(255,236,190,${0.18 + h * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + h * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (background === "village-two") {
    // low humid mist drifting across the river clearing
    for (let i = 0; i < 3; i++) {
      const mx = ((t * (7 + i * 3) + i * W * 0.45) % (W + 260)) - 130;
      const my = g0 - 58 - i * 34;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
      mg.addColorStop(0, "rgba(238,248,232,0.075)");
      mg.addColorStop(1, "rgba(238,248,232,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 120, my - 45, 240, 90);
    }
  }
}

export function drawSambisaBackdrop(ctx: CanvasRenderingContext2D, scroll: number, t: number, g0: number, background: BackgroundId = "village-one") {
  sky(ctx, g0, background);
  const art = ART[background];
  const im = ready(background);

  if (im) {
    const s = Math.max(H / im.naturalHeight, (W * 1.14) / im.naturalWidth);
    const tw = im.naturalWidth * s;
    const th = im.naturalHeight * s;
    const ty = Math.max(H - th, Math.min(0, H * 0.45 - th * art.horizon));
    const slack = tw - W;
    const x = -slack * (0.5 - 0.5 * Math.cos(scroll * PAN_RATE));
    ctx.drawImage(im, x, ty, tw, th);
    for (let p = 0; p < art.plumes.length; p++) {
      smoke(ctx, x + art.plumes[p].u * tw, ty + art.plumes[p].v * th, s * (art.smokeScale ?? 1.4), t, p);
    }
    const hz = ctx.createLinearGradient(0, ty + th * 0.3, 0, ty + th * 0.48);
    hz.addColorStop(0, "rgba(255,248,228,0)");
    hz.addColorStop(1, background === "background-four" ? "rgba(226,204,166,0.07)" : background === "background-three" ? "rgba(238,242,232,0.035)" : background === "village-two" ? "rgba(238,248,232,0.13)" : "rgba(255,248,228,0.16)");
    ctx.fillStyle = hz;
    ctx.fillRect(-20, ty + th * 0.3, W + 40, th * 0.18);
  } else {
    ctx.fillStyle = background === "background-four" ? "#b88c59" : background === "background-three" ? "#a8aa98" : background === "village-two" ? "#74905a" : "#d9b26a";
    ctx.beginPath();
    ctx.moveTo(-20, g0 - 70);
    for (let x = -20; x <= W + 20; x += 40) ctx.lineTo(x, g0 - 70 - Math.sin((x + scroll * 0.2) * 0.012) * 10);
    ctx.lineTo(W + 20, H + 20);
    ctx.lineTo(-20, H + 20);
    ctx.closePath();
    ctx.fill();
  }

  if (background === "background-four") drawMarketAtmosphere(ctx, scroll, t, g0);
  else atmosphere(ctx, t, g0, background);
  if (background === "background-four") drawMarketFloor(ctx, scroll, g0);
  else if (background === "background-three") cityFloor(ctx, scroll, g0);
  else if (background === "village-two") riverFloor(ctx, scroll, g0);
  else sandFloor(ctx, scroll, g0);
  drawGround(ctx, background, g0, scroll);
}

/**
 * Foreground cover drawn after fighters and effects, before the HUD.
 * Village One stays open. Village Two uses canopy shade, mist and bank
 * reeds, so lower weapons and equipment are only partly visible there.
 */
export function drawSambisaForeground(ctx: CanvasRenderingContext2D, background: BackgroundId, scroll: number, t: number, g0: number) {
  if (background === "background-four") {
    drawMarketForeground(ctx, scroll, t, g0);
    return;
  }
  if (background === "background-three") {
    cityForeground(ctx, scroll, g0);
    return;
  }
  if (background !== "village-two") return;

  const shade = ctx.createLinearGradient(0, 0, 0, 72);
  shade.addColorStop(0, "rgba(17,40,20,0.20)");
  shade.addColorStop(1, "rgba(17,40,20,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(-20, -20, W + 40, 92);

  const mist = ctx.createLinearGradient(0, g0 - 46, 0, g0 + 8);
  mist.addColorStop(0, "rgba(238,248,232,0)");
  mist.addColorStop(0.55, `rgba(238,248,232,${0.05 + 0.015 * Math.sin(t * 0.7)})`);
  mist.addColorStop(1, "rgba(238,248,232,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(-20, g0 - 46, W + 40, 54);

  const off = scroll * FLOOR_SPEED * 1.25;
  const step = 150;
  const startI = Math.floor(off / step) - 1;
  for (let i = startI; i < startI + W / step + 3; i++) {
    const h = hash(i * 6.1 + 300);
    if (h < 0.42) continue;
    const x = i * step - off + hash(i + 301) * 90;
    // Reeds remain below the walking line so soles stay visible.
    reed(ctx, x, g0 + 58, 0.9 + h * 0.55, h, true);
  }
}
