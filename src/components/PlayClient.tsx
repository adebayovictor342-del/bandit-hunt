"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import DopamineGameOver from "./DopamineGameOver";
import GameCanvas from "./GameCanvas";
import MapSelectionModal from "./MapSelectionModal";
import MatchmakingScreen from "./MatchmakingScreen";
import NetDamageModal from "./NetDamageModal";
import CityFlyover from "./CityFlyover";
import { ArrowLeft, ArrowRight, Crosshair, Infinity as InfinityIcon, Swords, Trophy } from "lucide-react";
import Stick from "./Stick";
import { newBus, resetBus, type Bus } from "@/games/bus";
import type { Phase } from "@/games/common";
import type { SkirmishOptions } from "@/games/skirmish";
import { nextStance, type Stance } from "@/games/soldier";
import { BACKGROUNDS, type BattleFormat, type BattleResult, type CombatantBattleStats, type SkirmishGameMode, type SkirmishZone, type BackgroundId } from "@/games/skirmishTypes";
import { cn } from "@/lib/cn";
import { playerStore, usePlayer } from "@/lib/player";
import { clearMissionIntent, missionReturnUrl, readMission, rememberMission, type GameIntent } from "@/lib/game-intent";
import type { CityFlightMode } from "@/games/cityFlight";

const STICK = 124;

/** The input bus is intentionally mutable and consumed by the game loop. */
function queueBomb(bus: Bus) {
  bus.bomb = true;
  bus.tap = true;
}

type Stage = "home" | "modes" | "map-select" | "matchmaking" | "departure" | "battlefield" | "journey-over" | "battle-calc";

interface SubmitResult {
  xp: number;
  kills: number;
  isRecord: boolean;
  prevRecord: number;
  weekBefore: number | null;
  weekAfter: number | null;
  monthAfter: number | null;
}

const BTN =
  "pointer-events-auto absolute z-20 grid place-items-center rounded-full border border-white/35 bg-white/10 font-display font-bold text-white opacity-40 shadow-lg backdrop-blur-[2px] select-none touch-none transition-[opacity,transform] active:scale-95 active:opacity-80";

function Controls({ bus, mode, stance, setStance }: { bus: Bus; mode: SkirmishGameMode; stance: Stance; setStance: (s: Stance) => void }) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [stickSize, setStickSize] = useState(STICK);
  const actionSize = Math.round(Math.max(44, Math.min(64, stickSize * 0.65)));
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const update = () => {
      const { clientWidth, clientHeight } = controls;
      if (!clientWidth || !clientHeight) return;
      const next = Math.round(Math.max(48, Math.min(STICK, clientWidth * 0.13, clientHeight * 0.25)));
      setStickSize((current) => current === next ? current : next);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(controls);
    window.addEventListener("resize", update);
    const initial = window.requestAnimationFrame(update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); window.cancelAnimationFrame(initial); };
  }, []);
  const hold = (key: "shield") => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      bus[key] = true;
      bus.tap = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    onPointerUp: () => {
      bus[key] = false;
    },
    onPointerCancel: () => {
      bus[key] = false;
    },
    onLostPointerCapture: () => {
      bus[key] = false;
    },
    onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
  });
  return (
    <div ref={controlsRef} className="game-touch-controls pointer-events-none absolute inset-0 z-20">
      <Stick bus={bus} side="left" size={stickSize} label="Move left and right, push up to fly" className="pointer-events-auto bottom-4 left-4 z-20" />
      <Stick bus={bus} side="right" size={stickSize} label="Aim and fire" className="pointer-events-auto right-4 bottom-4 z-20" />
      <button type="button" aria-label="Shield" className={cn(BTN, "text-[11px] tracking-wide")} style={{ width: actionSize, height: actionSize, left: 16, bottom: stickSize + 24 }} {...hold("shield")}>
        SHIELD
      </button>
      <button
        type="button"
        aria-label="Bomb"
        className={cn(BTN, "text-[11px] tracking-wide")}
        style={{ width: actionSize, height: actionSize, right: 16, bottom: stickSize + 24 }}
        onPointerDown={(e) => {
          e.preventDefault();
          queueBomb(bus);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        BOMB
      </button>
      {mode === "journey" && (
        <button
          type="button"
          aria-label={`Pose: ${stance}. Tap to change stance`}
          onClick={() => setStance(nextStance(stance))}
          onContextMenu={(e) => e.preventDefault()}
          className={BTN}
          style={{ width: actionSize, height: actionSize, right: 90, top: 16 }}
        >
          <span className="flex flex-col items-center leading-none">
            <span className="text-[9px] font-bold tracking-wider opacity-75">POSE</span>
            <span className="mt-0.5 text-[11px] font-extrabold uppercase">{stance}</span>
          </span>
        </button>
      )}
    </div>
  );
}

/** Mission state is independent of account navigation and the live city renderer. */
export default function PlayClient() {
  const player = usePlayer();
  const [stage, setStage] = useState<Stage>("home");
  const [needSignup, setNeedSignup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [bus] = useState<Bus>(newBus);
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [mode, setMode] = useState<SkirmishGameMode>("journey");
  const [zone, setZone] = useState<SkirmishZone>("forest");
  const [background, setBackground] = useState<BackgroundId>(() => {
    if (typeof window === "undefined") return "village-one";
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("background");
    return BACKGROUNDS.some((b) => b.id === requested) ? (requested as BackgroundId) : "village-one";
  });
  const [battleDurationSec, setBattleDurationSec] = useState(180);
  const [battleFormat, setBattleFormat] = useState<BattleFormat>("2v2");
  const [roster, setRoster] = useState<CombatantBattleStats[]>([]);
  const [respawn, setRespawn] = useState<number | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [stance, setStance] = useState<Stance>("stand");
  const stanceRef = useRef<Stance>("stand");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [liveXp, setLiveXp] = useState(0);
  const startedAt = useRef(0);

  const [mounted, setMounted] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const intent = readMission(query);
    setMounted(true);
    void (async () => {
      if (!playerStore.get().sessionChecked) await playerStore.refreshSession();
      if (!active || !intent) return;
      setMode(intent.mode); setBackground(intent.background); setBattleFormat(intent.format); setBattleDurationSec(intent.durationSec);
      if (intent.mode === "journey" && !playerStore.isSignedUp()) {
        setStage("modes"); setNeedSignup(true);
      } else {
        clearMissionIntent();
        // Resume at the selected mode's map setup, not a fresh city intro.
        setStage("map-select");
        window.history.replaceState(window.history.state, "", "/play");
      }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => { stanceRef.current = stance; }, [stance]);
  useEffect(() => { if (phase !== "playing") resetBus(bus); }, [phase, bus]);
  useEffect(() => {
    if (stage !== "battlefield") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.code === "KeyC" || e.code === "KeyX") { e.preventDefault(); setStance((previous) => nextStance(previous)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const restart = useCallback(() => {
    setRunKey((key) => key + 1); setPhase("ready"); setResult(null); setLiveXp(0); setRespawn(null); setScoreError(""); setStance("stand");
  }, []);
  const handleStart = useCallback(() => { startedAt.current = Date.now(); setPhase("playing"); }, []);
  const handleOver = useCallback(async (xp: number) => {
    setPhase("over");
    if (mode === "battle") return;
    const kills = Math.round(xp / 10);
    setStage("journey-over"); setSubmitting(true); setScoreError("");
    const fallbackResult: SubmitResult = { xp, kills, isRecord: false, prevRecord: 0, weekBefore: null, weekAfter: null, monthAfter: null };
    try {
      const res = await fetch("/api/scores", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ xp, kills, zone, durationMs: startedAt.current ? Date.now() - startedAt.current : 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Score could not be saved.");
      setResult(data as SubmitResult);
    } catch (error) {
      setResult(fallbackResult); setScoreError(error instanceof Error ? error.message : "Score could not be saved.");
    } finally { setSubmitting(false); }
  }, [mode, zone]);
  const handleBattleEnd = useCallback((res: BattleResult) => {
    setBattleResult(res); setPhase("over"); playerStore.recordBattle(res.playerWon, res.playerNetScore, res.mmrDelta);
    if (playerStore.isSignedUp()) void fetch("/api/battles", {
      method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: res.format, zone: res.zone, won: res.playerWon, netScore: res.playerNetScore, mmrDelta: res.mmrDelta }),
    }).catch(() => {});
    setStage("battle-calc");
  }, []);

  const intent: GameIntent = { mode, background, format: battleFormat, durationSec: battleDurationSec };
  const returnUrl = missionReturnUrl({ ...intent, mode: "journey" });
  const selectMode = async (selected: SkirmishGameMode) => {
    if (checkingSession) return;
    setMode(selected); setNeedSignup(false); setCheckingSession(true);
    try {
      if (selected === "journey" && (!playerStore.get().sessionChecked || !playerStore.isSignedUp())) await playerStore.refreshSession();
      if (selected === "journey" && !playerStore.isSignedUp()) {
        rememberMission({ ...intent, mode: selected }); setNeedSignup(true); setStage("modes"); return;
      }
      clearMissionIntent(); setStage("map-select");
    } finally { setCheckingSession(false); }
  };
  const handleMapSelected = (selectedZone: SkirmishZone, opts?: { durationSec?: number; format?: BattleFormat; background?: BackgroundId }) => {
    setZone(selectedZone); if (opts?.background) setBackground(opts.background);
    if (mode === "journey" && !playerStore.isSignedUp()) {
      rememberMission({ ...intent, background: opts?.background ?? background }); setNeedSignup(true); setStage("modes"); return;
    }
    setResult(null); setBattleResult(null); setScoreError("");
    if (mode === "battle") {
      setBattleDurationSec(opts?.durationSec ?? 180); setBattleFormat(opts?.format ?? "2v2"); setStage("matchmaking");
    } else setStage("departure");
  };
  const handleMatchFound = useCallback((combatants: CombatantBattleStats[]) => { setRoster(combatants); setStage("departure"); }, []);
  const flightComplete = useCallback((flight: Exclude<CityFlightMode, "home">) => {
    if (flight === "departing") { restart(); setStage("battlefield"); }
  }, [restart]);
  const abortMission = () => {
    resetBus(bus); setPhase("over"); setStage("home");
  };
  const options: SkirmishOptions = {
    mode, zone, background, matchDurationSec: battleDurationSec, matchType: battleFormat,
    playerName: player.name || "You", playerGender: player.gender ?? "male", roster: roster.length ? roster : undefined,
    getStance: () => stanceRef.current, onBattleEnd: handleBattleEnd, onRespawnCountdown: setRespawn,
  };

  if (!mounted) return <div className="absolute inset-0 bg-ink-950"/>;
  if (stage === "battlefield") return <GameCanvas runKey={runKey} bus={bus} options={options} onStart={handleStart} onScore={setLiveXp} onOver={handleOver}>
    <div className="mission-arrival-cloud" aria-hidden="true"/>
    {phase !== "over" && <Controls bus={bus} mode={mode} stance={stance} setStance={setStance}/>}
    {mode === "battle" && respawn !== null && respawn > 0 && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 select-none"><p className="game-eyebrow">RETURNING TO THE FIGHT</p><div className="font-display mt-2 text-7xl font-black text-white tabular-nums">{respawn}</div></div>}
    <button type="button" onClick={abortMission} aria-label="Return to city" className="absolute top-3 right-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/30 text-white transition hover:bg-black/50">✕</button>
  </GameCanvas>;

  const flight: CityFlightMode = stage === "departure" ? "departing" : "home";
  return <CityFlyover flight={flight} showHome={stage === "home"} onStart={() => setStage("modes")} onFlightComplete={flightComplete}>
    {stage === "modes" && <div className="mission-screen city-mission-overlay"><div className="mission-shade"/><div className="mission-content">
      <button className="game-back" type="button" onClick={() => { setNeedSignup(false); setStage("home"); }}><ArrowLeft size={15}/> BACK TO CITY</button>
      <div className="game-eyebrow"><Crosshair size={14}/> SELECT MODE / BEFORE DEPARTURE</div><h1>CHOOSE YOUR <span>MISSION.</span></h1>
      <div className="mission-grid"><button type="button" disabled={checkingSession} onClick={() => void selectMode("journey")} className="mission-card journey-card"><span className="mission-icon"><Trophy size={23}/></span><span className="mission-card-title">JOURNEY</span><span className="mission-card-sub">RANKED SURVIVAL</span><span className="mission-meta"><InfinityIcon size={16}/> UNLIMITED RUNS <ArrowRight size={17}/></span></button><button type="button" disabled={checkingSession} onClick={() => void selectMode("battle")} className="mission-card battle-card"><span className="mission-icon"><Swords size={23}/></span><span className="mission-card-title">BATTLE</span><span className="mission-card-sub">1v1 / 2v2 AI MATCH</span><span className="mission-meta">UNRANKED <ArrowRight size={17}/></span></button></div>
    </div></div>}
    {stage === "map-select" && <MapSelectionModal mode={mode} initialBackground={background} onDeploy={handleMapSelected} onBack={() => setStage("modes")}/>}
    {stage === "matchmaking" && <MatchmakingScreen zone={zone} durationSec={battleDurationSec} format={battleFormat} playerMmr={player.battleMmr} playerName={player.name || "You"} playerGender={player.gender ?? "male"} onMatchFound={handleMatchFound} onCancel={() => setStage("map-select")}/>}
    {stage === "journey-over" && (submitting || !result ? <div className="game-panel-screen"><div className="game-result"><div className="game-eyebrow">SYNCING YOUR RUN</div><h1>{liveXp.toLocaleString()} <span>XP</span></h1></div></div> : <DopamineGameOver score={result.xp} kills={result.kills} rank={result.weekAfter} isRecord={result.isRecord} prevRecord={result.prevRecord} error={scoreError} onPlayAgain={() => void selectMode("journey")} onSelectZone={() => void selectMode("journey")} onExit={() => setStage("home")}/>)}
    {stage === "battle-calc" && battleResult && <NetDamageModal result={battleResult} onRematch={() => setStage("map-select")} onNewSetup={() => setStage("map-select")} onExit={() => setStage("home")}/>}
    {needSignup && <div className="game-account-overlay"><div className="game-account-card"><span className="game-eyebrow">UNLIMITED RANKED JOURNEY</span><h2>JOIN THE <span>RANKS.</span></h2><p>Sign in once to save your scores. You&apos;ll continue straight to Journey setup.</p><div><Link href={`/signin?next=${encodeURIComponent(returnUrl)}`} onClick={() => rememberMission({ ...intent, mode: "journey" })} className="game-action muted">SIGN IN</Link><Link href={`/signup?next=${encodeURIComponent(returnUrl)}`} onClick={() => rememberMission({ ...intent, mode: "journey" })} className="game-action bright">CREATE ACCOUNT <ArrowRight size={15}/></Link></div><button onClick={() => setNeedSignup(false)} className="game-cancel">NOT NOW</button></div></div>}
  </CityFlyover>;
}
