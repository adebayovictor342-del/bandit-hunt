"use client";
import { useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Bus } from "../games/bus";
import { cn } from "@/lib/cn";
import { StageContext } from "./GameCanvas";

/** fraction of the ring radius that is ignored, so thumbs can rest on the stick */
const DEAD = 0.12;

interface Props {
  bus: Bus;
  side: "left" | "right";
  label: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Analogue stick drawn as the faded green aim ring. Writes into the bus:
 *  - left:  lx / ly  (move, jet)
 *  - right: rx / ry / rOn  (aim, fire)
 * The knob is positioned in the stage's own frame, so it stays under the thumb
 * even when the whole stage is rotated for an upright phone.
 */
export default function Stick({ bus, side, label, size = 124, className, style }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<Bus>(bus);
  const rotated = useContext(StageContext);
  const pointer = useRef<number | null>(null);
  const [k, setK] = useState({ x: 0, y: 0, on: false });

  useEffect(() => {
    busRef.current = bus;
  }, [bus]);

  const travel = size * 0.27;
  const knob = size * 0.42;

  const write = (x: number, y: number, on: boolean) => {
    const current = busRef.current;
    if (side === "left") {
      current.lx = x;
      current.ly = y;
    } else {
      current.rx = x;
      current.ry = y;
      current.rOn = on;
    }
  };

  const update = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = baseRef.current?.getBoundingClientRect();
    if (!r) return;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    // screen → stage frame when the stage is rotated a quarter turn
    if (rotated()) [dx, dy] = [dy, -dx];
    const R = size / 2;
    let x = dx / R;
    let y = dy / R;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    const mag = Math.min(1, m);
    setK({ x, y, on: mag >= DEAD });
    if (mag < DEAD) {
      write(0, 0, false);
    } else {
      const f = (mag - DEAD) / (1 - DEAD);
      write((x / mag) * f, (y / mag) * f, true);
    }
  };

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointer.current = e.pointerId;
    try {
      baseRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
    busRef.current.tap = true; // touching a stick also starts / serves
    update(e);
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current === e.pointerId) update(e);
  };

  const release = () => {
    pointer.current = null;
    write(0, 0, false);
    setK({ x: 0, y: 0, on: false });
  };

  const ring = k.on ? "rgba(200,255,220,0.95)" : "rgba(150,255,200,0.7)";

  return (
    <div
      ref={baseRef}
      role="img"
      aria-label={label}
      data-stick={side}
      data-x={k.x.toFixed(2)}
      data-y={k.y.toFixed(2)}
      data-on={k.on ? 1 : 0}
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "absolute touch-none select-none rounded-full transition-opacity duration-200",
        k.on ? "opacity-90" : "opacity-55",
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={`stick-glow-${side}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(110,255,180,0.10)" />
            <stop offset="70%" stopColor="rgba(110,255,180,0.18)" />
            <stop offset="100%" stopColor="rgba(110,255,180,0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill={`url(#stick-glow-${side})`} />
        <circle cx="50" cy="50" r="46" fill="rgba(20,80,58,0.22)" stroke={ring} strokeWidth="2.4" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(150,255,200,0.4)" strokeWidth="1.4" />
        {side === "right" &&
          [0, 90, 180, 270].map((a) => (
            <line
              key={a}
              x1="50"
              y1="6"
              x2="50"
              y2="12"
              stroke="rgba(190,255,215,0.6)"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
      </svg>
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
        style={{
          width: knob,
          height: knob,
          transform: `translate(calc(-50% + ${(k.x * travel).toFixed(1)}px), calc(-50% + ${(k.y * travel).toFixed(1)}px))`,
          background:
            "radial-gradient(circle at 35% 30%, rgba(230,255,240,0.95), rgba(90,220,165,0.55) 60%, rgba(40,150,110,0.45))",
          boxShadow: "0 0 0 2px rgba(190,255,220,0.5), 0 4px 14px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}
