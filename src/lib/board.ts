/** Shared leaderboard helpers — periods, prize tiers, XP matrix. Safe on server and client. */

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
export const XP_PER_KILL = 10;

export type Period = "weekly" | "monthly" | "alltime";

export interface BoardEntry {
  rank: number;
  playerId: string;
  name: string;
  face: string;
  gender: string;
  xp: number;
  kills: number;
  runs: number;
  you: boolean;
}

export interface BoardResponse {
  period: Period;
  periodStart: string;
  periodEnd: string;
  entries: BoardEntry[];
  you: BoardEntry | null;
  total: number;
}

export function weekStartOf(ms: number): number {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

export function monthStartOf(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function monthEndOf(start: number): number {
  const d = new Date(start);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export function periodRange(period: Period, now = Date.now()): { start: number; end: number } {
  if (period === "weekly") {
    const s = weekStartOf(now);
    return { start: s, end: s + WEEK };
  }
  if (period === "monthly") {
    const s = monthStartOf(now);
    return { start: s, end: monthEndOf(s) };
  }
  return { start: 0, end: Date.UTC(2100, 0, 1) };
}

export function periodLabel(period: Period, start: number, end: number): string {
  const f = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (period === "weekly") return `${f(start)} – ${f(end - DAY)}`;
  if (period === "monthly") return new Date(start).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return "All time";
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export interface Tier {
  id: string;
  label: string;
  icon: string;
  title: string;
  nairaAmount: string;
  perks: string[];
  from: number;
  to: number;
}

export const WEEKLY_PRIZE_POOL_NAIRA = "₦20,000";
export const MONTHLY_PRIZE_POOL_NAIRA = "₦200,000";

export const TIERS: Tier[] = [
  { id: "gold", label: "1st Place", icon: "👑", title: "Weekly Champion", nairaAmount: "₦10,000", perks: ["₦10,000 Instant Cash Payout", "Name in Hall of Fame", "Reigning-champion crown all next week"], from: 1, to: 1 },
  { id: "silver", label: "2nd Place", icon: "🥈", title: "Silver Runner-Up", nairaAmount: "₦5,000", perks: ["₦5,000 Instant Cash Payout", "Hall of Fame podium badge"], from: 2, to: 2 },
  { id: "bronze", label: "3rd Place", icon: "🥉", title: "Bronze Podium", nairaAmount: "₦3,000", perks: ["₦3,000 Instant Cash Payout", "Hall of Fame podium badge"], from: 3, to: 3 },
  { id: "top10", label: "4th – 10th", icon: "🎖️", title: "Top-10 Pool Share", nairaAmount: "₦2,000 Pool", perks: ["Share of ₦2,000 Prize Pool (₦285+ each)", "Top-10 Competitor Badge"], from: 4, to: 10 },
];

export const MONTHLY_TIERS: Tier[] = [
  { id: "m_gold", label: "1st Place", icon: "💎", title: "Monthly Grand Champion", nairaAmount: "₦100,000", perks: ["₦100,000 Grand Prize Payout", "Pinned on Home header all month"], from: 1, to: 1 },
  { id: "m_silver", label: "2nd Place", icon: "🥈", title: "Monthly Runner-Up", nairaAmount: "₦50,000", perks: ["₦50,000 Cash Payout"], from: 2, to: 2 },
  { id: "m_bronze", label: "3rd Place", icon: "🥉", title: "Monthly 3rd Place", nairaAmount: "₦30,000", perks: ["₦30,000 Cash Payout"], from: 3, to: 3 },
  { id: "m_top10", label: "4th – 10th", icon: "🎖️", title: "Monthly Top-10 Share", nairaAmount: "₦20,000 Pool", perks: ["Share of ₦20,000 Prize Pool (₦2,850+ each)"], from: 4, to: 10 },
];

export const tierFor = (rank: number, period: Period = "weekly"): Tier | undefined =>
  (period === "monthly" ? MONTHLY_TIERS : TIERS).find((t) => rank >= t.from && rank <= t.to);

export function medal(rank: number) {
  return rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank <= 10 ? "🎖️" : "";
}
