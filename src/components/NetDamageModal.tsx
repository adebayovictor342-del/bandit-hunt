"use client";
import { ArrowRight, Crosshair, RotateCcw, Swords } from "lucide-react";
import type { BattleResult } from "@/games/skirmishTypes";
interface Props { result:BattleResult;onRematch:()=>void;onNewSetup:()=>void;onExit:()=>void }
export default function NetDamageModal({result,onRematch,onNewSetup,onExit}:Props){
 const ranked=[...result.combatants].sort((a,b)=>b.netScore-a.netScore);
 return <div className="game-panel-screen"><div className="game-result battle-result"><div className="game-eyebrow"><Swords size={14}/> {result.format} AI BATTLE / MATCH COMPLETE</div><h1>{result.playerWon?"VICTORY":"DEFEAT"}<span>.</span></h1><div className="result-metrics"><div><small>YOUR NET DAMAGE</small><strong>{result.playerNetScore>0?"+":""}{result.playerNetScore}</strong></div><div><small>MMR CHANGE</small><strong>{result.mmrDelta>0?"+":""}{result.mmrDelta}</strong></div><div><small>MATCH MVP</small><strong className="result-name">{result.mvp.name}</strong></div></div><div className="battle-score-line">{ranked.map(c=><span key={c.id}>{c.avatarFace} {c.name} <strong>{c.netScore>0?"+":""}{c.netScore}</strong></span>)}</div><div className="result-actions"><button className="game-action bright" onClick={onRematch}><RotateCcw size={15}/> REMATCH</button><button className="game-action muted" onClick={onNewSetup}><Crosshair size={15}/> CHANGE MAP</button><button className="game-action muted" onClick={onExit}>CITY HOME <ArrowRight size={14}/></button></div></div></div>;
}
