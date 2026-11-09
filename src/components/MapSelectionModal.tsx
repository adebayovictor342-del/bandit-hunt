"use client";
/* Native images are preloaded, static game/advert assets; no resizing proxy is needed. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { BACKGROUNDS, backgroundMeta, type BackgroundId, type BattleFormat, type SkirmishGameMode, type SkirmishZone } from "@/games/skirmishTypes";
interface Props { mode: SkirmishGameMode; initialBackground?: BackgroundId; onDeploy: (zone: SkirmishZone, options: { durationSec?: number; format?: BattleFormat; background: BackgroundId }) => void; onBack: () => void }
export default function MapSelectionModal({ mode, initialBackground = "village-one", onDeploy, onBack }: Props) {
  const [selected,setSelected]=useState<BackgroundId>(initialBackground); const [duration,setDuration]=useState(180); const [format,setFormat]=useState<BattleFormat>("2v2");
  const active=backgroundMeta(selected); const battle=mode==="battle";
  return <div className="game-panel-screen"><div className="game-panel-inner">
    <div className="game-panel-head"><div><button className="game-back" type="button" onClick={onBack}><ArrowLeft size={15}/> BACK</button><div className="game-eyebrow"><MapPin size={13}/> OPERATION / AREA OF COMBAT</div><h1>SELECT YOUR <span>LOCATION.</span></h1></div><span className="game-panel-counter">01 — 04</span></div>
    <div className="game-map-grid">{BACKGROUNDS.map((b,i)=><button key={b.id} type="button" aria-pressed={selected===b.id} className={`game-map ${selected===b.id?"selected":""}`} onClick={()=>setSelected(b.id)}><img src={b.image} alt=""/><span className="game-map-shade"/><span className="game-map-index">0{i+1} / {b.zone === "forest" ? "FOREST" : "CITY"}</span>{selected===b.id && <span className="game-map-check"><Check size={14}/></span>}<strong>{b.label.toUpperCase()}</strong></button>)}</div>
    <div className="game-panel-bottom"><div className="game-panel-selection">SELECTED <strong>{active.label.toUpperCase()}</strong></div>{battle && <div className="game-match-options"><div><span>FORMAT</span>{(["1v1","2v2"] as const).map(f=><button key={f} type="button" className={format===f?"active":""} onClick={()=>setFormat(f)}>{f}</button>)}</div><div><span>TIME</span>{[120,180,300].map(n=><button key={n} type="button" className={duration===n?"active":""} onClick={()=>setDuration(n)}>{n/60}M</button>)}</div></div>}<button type="button" className="game-action bright" onClick={()=>onDeploy(active.zone,{background:selected,...(battle?{durationSec:duration,format}:{})})}>{battle?"FIND MATCH":"DEPLOY"} <ArrowRight size={16}/></button></div>
  </div></div>;
}
