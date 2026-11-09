"use client";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, LoaderCircle } from "lucide-react";
import { ZONES, buildGenderSortedLobby, type BattleFormat, type CombatantBattleStats, type Gender, type SkirmishZone } from "@/games/skirmishTypes";
interface Props { zone: SkirmishZone; durationSec: number; format: BattleFormat; playerMmr: number; playerName: string; playerGender: Gender; onMatchFound: (combatants: CombatantBattleStats[]) => void; onCancel: () => void }
export default function MatchmakingScreen({zone,durationSec,format,playerMmr,playerName,playerGender,onMatchFound,onCancel}:Props){
  const [elapsed,setElapsed]=useState(0);const [seed]=useState(()=>Date.now());const lobby=useMemo(()=>buildGenderSortedLobby(playerName,playerGender,format,seed),[playerName,playerGender,format,seed]);
  const ready=elapsed>=3;
  useEffect(()=>{const id=window.setInterval(()=>setElapsed(v=>v+.1),100);return()=>window.clearInterval(id)},[]);
  useEffect(()=>{if(!ready)return;const id=window.setTimeout(()=>onMatchFound(lobby),500);return()=>window.clearTimeout(id)},[ready,lobby,onMatchFound]);
  return <div className="game-panel-screen"><div className="match-screen"><div className="game-eyebrow"><Crosshair size={13}/> AI BATTLE / {format} / {Math.round(durationSec/60)} MIN</div><h1>{ready?"MATCH FOUND":"PREPARING MATCH"}<span>.</span></h1><p>{ZONES.find(z=>z.id===zone)?.name} · MMR {playerMmr} · Unranked</p><div className="match-progress"><span style={{width:`${Math.min(100,elapsed/3*100)}%`}}/></div><div className="match-roster">{lobby.map((c,i)=><div key={c.id} className={c.isTeammate?"ally":"rival"}><span>{i/Math.max(1,lobby.length)<elapsed/3?c.avatarFace:"…"}</span><strong>{i/Math.max(1,lobby.length)<elapsed/3?c.name:"CONNECTING"}</strong><small>{c.isPlayer?"YOU":c.isTeammate?"ALLY":"RIVAL"}</small></div>)}</div><button type="button" className="game-back" onClick={onCancel}><LoaderCircle size={14}/> CANCEL</button></div></div>;
}
