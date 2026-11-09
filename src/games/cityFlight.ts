export type CityFlightMode = "home" | "departing";
export interface CityFlightProgress { mode: CityFlightMode; progress: number; remaining: number; cloud: number }
export const DEPARTURE_SECONDS = 10;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
function smooth(a: number, b: number, value: number) { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); }

/** Pure, bounded takeoff timeline shared by WebGL and low-power renderers. */
export function cityFlightAt(mode: CityFlightMode, elapsed: number) {
  if (mode === "home") return { mode, progress: 0, remaining: 0, cloud: 0, lift: 0, travel: 0, complete: false };
  const progress = clamp(elapsed / DEPARTURE_SECONDS);
  return {
    mode, progress, remaining: Math.max(0, Math.ceil(DEPARTURE_SECONDS - elapsed)),
    // The city is fully cloud-covered before the camera could see its boundary.
    cloud: smooth(7.1, 9.6, elapsed),
    lift: smooth(1, 4, elapsed),
    travel: smooth(3.4, 9, elapsed),
    complete: progress >= 1,
  };
}
