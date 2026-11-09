import { BACKGROUNDS, type BackgroundId, type BattleFormat, type SkirmishGameMode } from "@/games/skirmishTypes";

export interface GameIntent { mode: SkirmishGameMode; background: BackgroundId; format: BattleFormat; durationSec: number }
const KEY = "sambisa.pending-mission.v2";
export function missionReturnUrl(intent: GameIntent) {
  const query = new URLSearchParams({ resume: intent.mode, background: intent.background, format: intent.format, duration: String(intent.durationSec) });
  return `/play?${query}`;
}
export function rememberMission(intent: GameIntent) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() })); } catch { /* URL also carries the full intent. */ }
}
export function readMission(query: URLSearchParams): GameIntent | null {
  if (query.get("resume") !== "journey" && query.get("resume") !== "battle") return null;
  let saved: Partial<GameIntent> = {};
  try { const raw = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (raw && Date.now() - raw.at < 60 * 60 * 1000) saved = raw; } catch { /* optional storage */ }
  const background = query.get("background") || saved.background;
  const duration = Number(query.get("duration") || saved.durationSec || 180);
  return {
    mode: query.get("resume") as SkirmishGameMode,
    background: BACKGROUNDS.some((b) => b.id === background) ? background as BackgroundId : "village-one",
    format: (query.get("format") || saved.format) === "1v1" ? "1v1" : "2v2",
    durationSec: [120, 180, 300].includes(duration) ? duration : 180,
  };
}
export function clearMissionIntent() { try { sessionStorage.removeItem(KEY); } catch { /* optional storage */ } }
