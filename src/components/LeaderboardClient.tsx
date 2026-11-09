"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Crown, RefreshCw, Timer } from "lucide-react";
import { countdown, periodLabel, type BoardResponse, type Period } from "@/lib/board";
import { usePlayer } from "@/lib/player";
import PlayLink from "./PlayLink";

const tabs: { id: Period; label: string }[] = [{ id: "weekly", label: "THIS WEEK" }, { id: "monthly", label: "THIS MONTH" }, { id: "alltime", label: "ALL TIME" }];
export default function LeaderboardClient({ initialPeriod = "weekly", compact = false }: { initialPeriod?: Period; compact?: boolean }) {
  const player = usePlayer();
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [result, setResult] = useState<{ key: string; board: BoardResponse | null; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const key = `${period}:${player.authenticated ? player.id : "guest"}:${compact}:${retry}`;
  const loading = result?.key !== key;
  const board = loading ? null : result?.board ?? null;
  const error = !loading && !!result?.error;
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leaderboard?period=${period}&limit=${compact ? 5 : 50}${player.authenticated ? `&you=${encodeURIComponent(player.id)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("Unable to load standings"); return res.json(); })
      .then((data: BoardResponse) => setResult({ key, board: data, error: false }))
      .catch((e) => { if (e.name !== "AbortError") setResult({ key, board: null, error: true }); });
    return () => controller.abort();
  }, [key, period, player.id, player.authenticated, compact]);
  const end = board ? Date.parse(board.periodEnd) : 0;
  const cd = countdown(end - now);
  return <div className={`board-card ${compact ? "board-compact" : ""}`}>
    <div className="board-toolbar"><div className="board-tabs" role="tablist" aria-label="Leaderboard period">{tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={period === t.id} className={period === t.id ? "active" : ""} onClick={() => setPeriod(t.id)}>{t.label}</button>)}</div><div className="board-period">{board && <><Timer size={15}/><span>{period === "alltime" ? "ALL-TIME RECORDS" : `RESETS IN ${cd.d}D ${String(cd.h).padStart(2,"0")}H ${String(cd.m).padStart(2,"0")}M`}</span></>}</div></div>
    <div className="board-table-wrap"><table className="board-table"><thead><tr><th>RANK</th><th>FIGHTER</th><th className="hide-small">BEST RUN</th><th>SCORE</th></tr></thead><tbody>
      {loading && <tr><td colSpan={4} className="board-message">Loading standings…</td></tr>}
      {error && <tr><td colSpan={4} className="board-message">Couldn&apos;t load standings. <button type="button" onClick={() => setRetry(retry+1)}><RefreshCw size={14}/> Retry</button></td></tr>}
      {!loading && !error && board?.entries.length === 0 && <tr><td colSpan={4} className="board-message">No ranked runs yet. <PlayLink>Be the first <ArrowRight size={14}/></PlayLink></td></tr>}
      {board?.entries.map((e) => <tr key={e.playerId} className={e.you ? "board-you" : ""}><td><span className={`rank-number rank-${e.rank}`}>{e.rank === 1 ? <Crown size={16}/> : String(e.rank).padStart(2,"0")}</span></td><td><span className="board-person"><span className={`board-avatar avatar-${e.rank % 4}`}>{e.name.charAt(0).toUpperCase()}</span><span><strong>{e.name}</strong><small>{e.you ? "YOU" : e.playerId.startsWith("bot_") ? "TRAINING RIVAL" : "FIGHTER"}</small></span></span></td><td className="hide-small"><span className="board-run">{e.kills} ELIMINATIONS</span></td><td><span className="board-score">{e.xp.toLocaleString()} <small>XP</small></span></td></tr>)}
    </tbody></table></div>
    <div className="board-footer"><span>{board ? `${periodLabel(period, Date.parse(board.periodStart), end)}  ·  ${board.total} FIGHTERS` : "SAMBISA FIGHTER / LEADERBOARD"}</span>{compact ? <Link href="/leaderboard">VIEW ALL <ArrowRight size={15}/></Link> : player.authenticated ? <span>{board?.you ? `YOUR POSITION  #${board.you.rank}` : "YOUR POSITION  —"}</span> : <Link href="/signup">JOIN THE RANKS <ArrowRight size={15}/></Link>}</div>
  </div>;
}
