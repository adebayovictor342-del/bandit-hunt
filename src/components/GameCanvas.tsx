"use client";
import { createContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { resetBus, type Bus } from "@/games/bus";
import { clamp, configureWorld, fitWorld, H, W, type Input } from "@/games/common";
import { createSkirmish, type SkirmishOptions } from "@/games/skirmish";

/** Sambisa Fighter design field — landscape, scaled to fill the screen. */
const META = { world: { w: 640, h: 360 }, landscape: true };

/** lets child controls ask whether the stage is currently rotated a quarter turn */
export const StageContext = createContext<() => boolean>(() => false);

interface Props {
  /** change to start a fresh run */
  runKey: number;
  /** written by the on-screen controls */
  bus: Bus;
  /** optional game-specific configuration (e.g. Sambisa Fighter modes, zones) */
  options?: SkirmishOptions;
  onStart(): void;
  onScore?(n: number): void;
  onOver(n: number): void;
  /** overlays (controls, game-over card) rendered on top of the field */
  children?: ReactNode;
}

const STEP = 1 / 60;
const BG = "#050913";
const FIELD = /^(INPUT|TEXTAREA|SELECT)$/;
const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const THRUST_KEYS = ["Space", "ArrowUp", "KeyW"];
const SHIELD_KEYS = ["ShiftLeft", "ShiftRight", "KeyS", "ArrowDown"];
const BOMB_KEYS = ["KeyF", "KeyE", "KeyB"];

export default function GameCanvas({ runKey, bus, options, onStart, onScore, onOver, children }: Props) {
  const meta = META;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbs = useRef({ onStart, onScore, onOver });
  /** how the world is currently placed on the physical screen */
  const layout = useRef({ rot: false, iw: 0, sw: 0, sh: 0, s: 1, ox: 0, oy: 0 });
  const isRotated = () => layout.current.rot;

  useEffect(() => {
    cbs.current = { onStart, onScore, onOver };
  });

  /** A phone held upright shows a landscape game rotated a quarter turn, so it reads correctly. */
  const wantsRotate = () => meta.landscape && window.innerHeight > window.innerWidth;

  const applyLayout = () => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rot = wantsRotate();
    const stage = document.getElementById("sambisa-landscape");
    const iw = window.innerWidth;
    // The entire game, including this canvas, lives inside one landscape stage.
    const sw = stage?.clientWidth || (rot ? window.innerHeight : iw);
    const sh = stage?.clientHeight || (rot ? iw : window.innerHeight);
    // Re-fit the world every time the viewport changes (rotation, resize, entering
    // fullscreen). Without this the field keeps an old aspect and leaves bars.
    const f = fitWorld(sw, sh, meta.world.w, meta.world.h);
    configureWorld(f.w, f.h);
    // cover, not contain: the field always reaches every edge of the screen
    const s = Math.max(sw / W, sh / H);
    layout.current = { rot, iw, sw, sh, s, ox: (sw - W * s) / 2, oy: (sh - H * s) / 2 };

    wrap.style.width = `${sw}px`;
    wrap.style.height = `${sh}px`;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const cw = Math.round(sw * dpr);
    const chh = Math.round(sh * dpr);
    if (canvas.width !== cw || canvas.height !== chh) {
      canvas.width = cw;
      canvas.height = chh;
    }
  };

  // Fit the logical world to the screen before the game is created.
  useLayoutEffect(() => {
    applyLayout();
    window.addEventListener("resize", applyLayout);
    window.addEventListener("orientationchange", applyLayout);
    return () => {
      window.removeEventListener("resize", applyLayout);
      window.removeEventListener("orientationchange", applyLayout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const inst = createSkirmish({
      onStart: () => cbs.current.onStart(),
      onScore: (n) => cbs.current.onScore?.(n),
      onOver: (n) => cbs.current.onOver(n),
    }, options);
    const input: Input = {
      tap: false,
      held: false,
      px: W / 2,
      py: H / 2,
      pointerActive: false,
      dir: 0,
      lx: 0,
      ly: 0,
      rx: 0,
      ry: 0,
      rOn: false,
      mouseFire: false,
      shield: false,
      bombTap: false,
    };

    let ptrHeld = false;
    let ptrTap = false;
    let ptrMouse = false;
    let keyHeld = false;
    let keyTap = false;
    let keyDir = 0;
    let keyShield = false;
    let keyBomb = false;
    const keys = new Set<string>();

    /** screen point → world point, honouring the rotation and letterbox offsets */
    const toWorld = (cx: number, cy: number) => {
      const L = layout.current;
      const bounds = canvas.getBoundingClientRect();
      const lx = L.rot ? cy - bounds.top : cx - bounds.left;
      const ly = L.rot ? bounds.right - cx : cy - bounds.top;
      return { x: (lx - L.ox) / L.s, y: (ly - L.oy) / L.s };
    };
    const aim = (e: PointerEvent) => {
      const p = toWorld(e.clientX, e.clientY);
      input.px = p.x;
      input.py = p.y;
      input.pointerActive = true;
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      ptrMouse = e.pointerType === "mouse";
      aim(e);
      ptrHeld = true;
      ptrTap = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* not supported — fine */
      }
    };
    const onMove = (e: PointerEvent) => aim(e);
    const onUp = () => {
      ptrHeld = false;
    };
    const onLeave = () => {
      if (!ptrHeld) input.pointerActive = false;
    };
    const syncDir = () => {
      const r = RIGHT_KEYS.some((k) => keys.has(k));
      const l = LEFT_KEYS.some((k) => keys.has(k));
      keyDir = (r ? 1 : 0) - (l ? 1 : 0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && FIELD.test(t.tagName)) return;
      if (THRUST_KEYS.includes(e.code)) {
        e.preventDefault();
          if (!e.repeat) keyTap = true;
        keyHeld = true;
      } else if (LEFT_KEYS.includes(e.code) || RIGHT_KEYS.includes(e.code)) {
        e.preventDefault();
        keys.add(e.code);
        syncDir();
      } else if (SHIELD_KEYS.includes(e.code)) {
        e.preventDefault();
        keyShield = true;
      } else if (BOMB_KEYS.includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) keyBomb = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (THRUST_KEYS.includes(e.code)) keyHeld = false;
      if (SHIELD_KEYS.includes(e.code)) keyShield = false;
      if (keys.delete(e.code)) syncDir();
    };
    const onBlur = () => {
      ptrHeld = false;
      keyHeld = false;
      keyShield = false;
      keys.clear();
      syncDir();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        input.dir = keyDir !== 0 ? keyDir : (bus.right ? 1 : 0) - (bus.left ? 1 : 0);
        input.lx = clamp(bus.lx + input.dir, -1, 1);
        input.ly = bus.ly;
        input.rx = bus.rx;
        input.ry = bus.ry;
        input.rOn = bus.rOn;
        input.held = keyHeld || bus.jet || (ptrHeld && !ptrMouse);
        input.mouseFire = ptrHeld && ptrMouse;
        input.shield = keyShield || bus.shield;
        input.bombTap = keyBomb || bus.bomb;
        input.tap = ptrTap || keyTap || bus.tap;
        ptrTap = false;
        keyTap = false;
        keyBomb = false;
        bus.bomb = false;
        bus.tap = false;
        inst.step(STEP, input);
        input.tap = false;
        acc -= STEP;
      }

      const L = layout.current;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, L.sw, L.sh);
      ctx.setTransform(dpr * L.s, 0, 0, dpr * L.s, dpr * L.ox, dpr * L.oy);
      inst.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resetBus(bus);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
    // options are captured when the run is created: mode, zone, roster and
    // getStance() are fixed before launch (live values come back through refs),
    // so re-renders during a run — respawn countdown, stance change — can never
    // tear down an in-progress match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, bus]);

  return (
    <StageContext.Provider value={isRotated}>
      <div
        ref={wrapRef}
        className="absolute top-0 left-0 touch-none overflow-hidden select-none"
        style={{ background: BG, transformOrigin: "0 0" }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Game area — tap, click, drag or press Space to play"
          className="absolute inset-0 h-full w-full touch-none"
        />
        {children}
      </div>
    </StageContext.Provider>
  );
}
