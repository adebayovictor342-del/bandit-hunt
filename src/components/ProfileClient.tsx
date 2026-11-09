"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Crosshair, LogOut, Pencil, Shield, Swords, Target, Trophy, X } from "lucide-react";
import { playerStore, usePlayer } from "@/lib/player";
import type { BoardResponse } from "@/lib/board";
import type { Gender } from "@/games/skirmishTypes";
import PlayLink from "./PlayLink";

interface ScoreRow { id: number; xp: number; kills: number; zone: string; durationMs: number; createdAt: string }
interface BattleRow { id: number; format: string; zone: string; won: number; netScore: number; mmrDelta: number; createdAt: string }
interface ProfileData { player: { name: string; face: string; gender: string; sambisaHighscore: number; createdAt: string }; recent: ScoreRow[]; recentBattles: BattleRow[]; stats: { matches: number; wins: number } }

export default function ProfileClient() {
  const p = usePlayer();
  const [data, setData] = useState<ProfileData | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(""); const [gender, setGender] = useState<Gender>("male");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    if (!p.authenticated) return;
    let live = true;
    Promise.all([
      fetch("/api/players", { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/leaderboard?period=weekly&limit=1&you=${encodeURIComponent(p.id)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
    ]).then(([profile, board]: [ProfileData | null, BoardResponse | null]) => { if (live) { setData(profile); setRank(board?.you?.rank ?? null); } }).catch(() => {});
    return () => { live = false; };
  }, [p.authenticated, p.id, p.name]);
  async function update(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await playerStore.signup(name, gender); setEditing(false); } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile."); } finally { setBusy(false); }
  }
  if (!p.sessionChecked) return <div className="profile-empty">Loading profile…</div>;
  if (!p.authenticated) return <div className="profile-empty"><div className="empty-icon"><Shield size={25}/></div><div className="eyebrow">YOUR FIGHTER PROFILE</div><h1>YOUR STORY<br/><span>STARTS HERE.</span></h1><p>Sign in to view your stats and track your journey.</p><div className="hero-actions"><Link className="site-button primary" href="/signin?next=%2Fprofile">SIGN IN <ArrowRight size={17}/></Link><Link className="site-button secondary" href="/signup?next=%2Fprofile">CREATE ACCOUNT</Link></div></div>;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <><div className="section-heading profile-heading"><div><div className="eyebrow"><span className="live-dot"/> FIGHTER PROFILE</div><h1>YOUR RECORD<span>.</span></h1><p className="page-intro">Every run tells a story. This one is yours.</p></div><PlayLink className="site-button primary">PLAY NOW <ArrowRight size={17}/></PlayLink></div>
    <div className="profile-identity"><div className="profile-avatar"><span>{p.name.charAt(0).toUpperCase()}</span></div><div className="profile-name"><small>OPERATIVE / {p.gender === "female" ? "FEMALE" : "MALE"} SQUAD</small><h2>{p.name}</h2><span>{p.email}</span></div><button className="profile-edit" onClick={() => { setName(p.name); setGender(p.gender ?? "male"); setEditing(true); }}><Pencil size={15}/> EDIT PROFILE</button></div>
    <div className="stat-grid"><Stat icon={<Trophy size={19}/>} label="ALL-TIME BEST" value={`${(data?.player.sambisaHighscore ?? 0).toLocaleString()} XP`}/><Stat icon={<Target size={19}/>} label="WEEKLY RANK" value={rank ? `#${rank}` : "—"}/><Stat icon={<Swords size={19}/>} label="BATTLE RECORD" value={`${data?.stats?.wins ?? 0}W / ${Math.max(0, (data?.stats?.matches ?? 0) - (data?.stats?.wins ?? 0))}L`}/><Stat icon={<Crosshair size={19}/>} label="JOURNEY ACCESS" value="UNLIMITED"/></div>
    <div className="profile-history"><div className="history-panel"><div className="history-title"><h3>RECENT JOURNEYS</h3><span>LAST 10 RUNS</span></div>{data?.recent.length ? <div>{data.recent.map(r=><div className="history-row" key={r.id}><div><strong>{r.zone === "forest" ? "SAMBISA FOREST" : r.zone === "city" ? "CITY CENTER" : "DESERT HIDEOUT"}</strong><small>{fmt(r.createdAt)} · {r.kills} ELIMINATIONS</small></div><b>{r.xp.toLocaleString()} <small>XP</small></b></div>)}</div> : <div className="history-empty">No journeys yet. <PlayLink>Start a run <ArrowRight size={14}/></PlayLink></div>}</div><div className="history-panel"><div className="history-title"><h3>RECENT BATTLES</h3><span>LAST 10 MATCHES</span></div>{data?.recentBattles.length ? <div>{data.recentBattles.map(b=><div className="history-row" key={b.id}><div><strong className={b.won ? "win" : "loss"}>{b.won ? "VICTORY" : "DEFEAT"} · {b.format}</strong><small>{fmt(b.createdAt)}</small></div><b>{b.netScore > 0 ? "+" : ""}{b.netScore} <small>NET</small></b></div>)}</div> : <div className="history-empty">No battles yet. <PlayLink>Enter battle <ArrowRight size={14}/></PlayLink></div>}</div></div>
    <button className="signout-button" type="button" onClick={() => void playerStore.signOut()}><LogOut size={15}/> SIGN OUT</button>
    {editing && <div className="modal-backdrop" role="presentation"><form className="edit-modal" onSubmit={update}><div className="edit-modal-head"><h2>EDIT FIGHTER</h2><button type="button" onClick={()=>setEditing(false)} aria-label="Close"><X size={20}/></button></div><label>CALLSIGN<div className="input-wrap"><input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={24} required/></div></label><fieldset><legend>SQUAD</legend><div className="squad-picker"><button type="button" className={gender === "male" ? "active" : ""} onClick={()=>setGender("male")}>♂ MALE</button><button type="button" className={gender === "female" ? "active" : ""} onClick={()=>setGender("female")}>♀ FEMALE</button></div></fieldset>{error && <p role="alert" className="form-error">{error}</p>}<button type="submit" className="site-button primary" disabled={busy}>{busy ? "SAVING..." : "SAVE CHANGES"}<ArrowRight size={16}/></button></form></div>}
  </>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="profile-stat"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>; }
