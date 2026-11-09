"use client";
/* Advert creatives are native media, intentionally outside Next's image proxy. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Crosshair, ExternalLink, Shield, X } from "lucide-react";
import { usePlayer } from "@/lib/player";
import { requestLandscape } from "./PlayLink";
import { enableGameAudio, preloadGameAudio, setCityAudioVisible, setGameAudioReady } from "@/games/audio";
import type { IbadanMap } from "@/games/ibadanScene";
import type { CityFlightMode, CityFlightProgress } from "@/games/cityFlight";

interface Campaign { slot: number; creativeIndex: number; rotationTick: number; image: string | null; video: string | null; destination: string; title: string; campaign: string }
const BILLBOARD_SLOTS = [1, 2, 3, 4, 5];
let mapRequest: Promise<IbadanMap> | null = null;
function cityData() {
  if (!mapRequest) mapRequest = fetch("/data/ibadan.json").then((res) => { if (!res.ok) throw new Error("Map unavailable"); return res.json() as Promise<IbadanMap>; }).catch((error) => { mapRequest = null; throw error; });
  return mapRequest;
}
function track(campaign: Campaign, kind: "impression" | "click") {
  const body = JSON.stringify({ campaign: campaign.campaign, slot: campaign.slot, creativeIndex: campaign.creativeIndex, kind });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/ads/events", new Blob([body], { type: "application/json" }));
  else void fetch("/api/ads/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}
function Billboard({ slot, campaign, boardRef, onPreview, onInteract }: {
  slot: number; campaign: Campaign | null; boardRef: RefObject<HTMLDivElement | null>;
  onPreview: () => void; onInteract: (active: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const counted = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = boardRef.current;
    if (!node || !campaign || failed || typeof IntersectionObserver === "undefined") return;
    let timer = 0, visible = false;
    const videoNode = video.current;
    const update = () => {
      const showing = visible && document.visibilityState === "visible";
      if (videoNode) {
        if (showing && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) void videoNode.play().catch(() => {});
        else videoNode.pause();
      }
      window.clearTimeout(timer);
      if (showing && ready && !counted.current) timer = window.setTimeout(() => {
        if (!counted.current && visible && document.visibilityState === "visible") { counted.current = true; track(campaign, "impression"); }
      }, 1000);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= .5; update(); }, { threshold: [0, .5, 1] });
    observer.observe(node); document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); window.clearTimeout(timer); videoNode?.pause(); };
  }, [campaign, ready, failed, boardRef]);
  return <div ref={boardRef} className="city-billboard city-billboard-3d" data-slot={slot} aria-label={`Digital billboard ${slot}`} onPointerEnter={() => onInteract(true)} onPointerLeave={() => onInteract(false)} onFocus={() => onInteract(true)} onBlur={() => onInteract(false)}>
    <button type="button" aria-label={`View billboard ${slot}${campaign ? `: ${campaign.title}` : ""}`} onClick={onPreview}>
      {campaign && !failed ? <>{campaign.video ? <video ref={video} src={campaign.video} poster={campaign.image ?? undefined} muted playsInline loop preload="metadata" onCanPlay={() => setReady(true)} onError={() => setFailed(true)}/> : <img src={campaign.image ?? ""} alt={campaign.title} onLoad={() => setReady(true)} onError={() => setFailed(true)}/>}<span className="billboard-disclosure">ADVERTISEMENT · {String(slot).padStart(2,"0")}</span></> : <div className={`billboard-placeholder billboard-slot-${slot}`}><small>ADVERTISEMENT / 0{slot}</small><strong>YOUR<br/>BRAND<br/>HERE<span>.</span></strong><em>TAP TO VIEW</em></div>}
    </button>
  </div>;
}
function AdvertViewer({ campaign, slot, onClose }: { campaign: Campaign | null; slot: number; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  return <div className="city-ad-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-label={`Billboard ${slot} preview`} className="city-ad-viewer" onClick={(e) => e.stopPropagation()}>
    <header><span>ADVERTISEMENT / BILLBOARD 0{slot}</span><button ref={close} type="button" aria-label="Close advert" onClick={onClose}><X size={20}/></button></header>
    <div className="city-ad-creative">{campaign ? campaign.video ? <video src={campaign.video} poster={campaign.image ?? undefined} controls autoPlay muted playsInline aria-label={campaign.title}/> : <img src={campaign.image ?? ""} alt={campaign.title}/> : <div className={`billboard-placeholder billboard-slot-${slot}`}><small>DIRECT ADVERTISING</small><strong>YOUR BRAND<br/>BELONGS HERE<span>.</span></strong><em>THIS BILLBOARD IS AVAILABLE</em></div>}</div>
    <footer><div><strong>{campaign?.title ?? `Billboard 0${slot}`}</strong><small>{campaign ? "Sponsored content" : "No advertiser configured for this space."}</small></div>{campaign?.destination ? <a href={campaign.destination} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track(campaign, "click")}>VISIT ADVERTISER <ExternalLink size={15}/></a> : <button type="button" onClick={onClose}>BACK TO CITY <ArrowRight size={15}/></button>}</footer>
  </section></div>;
}
interface Props {
  flight?: CityFlightMode;
  showHome?: boolean;
  children?: ReactNode;
  onStart: () => void;
  onFlightComplete: (mode: Exclude<CityFlightMode, "home">) => void;
}

/** Persistent live city home. The helicopter only moves when flight changes. */
export default function CityFlyover({ flight = "home", showHome = true, children, onStart, onFlightComplete }: Props) {
  const player = usePlayer();
  const canvas = useRef<HTMLCanvasElement>(null), fallback = useRef<HTMLCanvasElement>(null), clouds = useRef<HTMLDivElement>(null);
  const boards = useMemo(() => BILLBOARD_SLOTS.map(() => createRef<HTMLDivElement>()), []);
  const paused = useRef(false), hover = useRef(false), command = useRef(flight), next = useRef(onFlightComplete);
  const [campaigns, setCampaigns] = useState<(Campaign | null)[]>(BILLBOARD_SLOTS.map(() => null));
  const [viewing, setViewing] = useState<number | null>(null);
  const [progress, setProgress] = useState<CityFlightProgress>({ mode: flight, remaining: 0, progress: 0, cloud: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [cityReady, setCityReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [cityLoadError, setCityLoadError] = useState("");
  const [audioLoadError, setAudioLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useLayoutEffect(() => { command.current = flight; next.current = onFlightComplete; }, [flight, onFlightComplete]);
  useEffect(() => { paused.current = viewing !== null; }, [viewing]);
  useEffect(() => {
    setGameAudioReady(false);
    setCityAudioVisible(false);
    return () => setCityAudioVisible(false);
  }, []);
  useEffect(() => {
    const ready = cityReady && audioReady && !cityLoadError && !audioLoadError;
    setGameAudioReady(ready);
    setCityAudioVisible(ready);
  }, [cityReady, audioReady, cityLoadError, audioLoadError]);
  useEffect(() => {
    let active = true;
    setAudioReady(false);
    setAudioLoadError("");
    void preloadGameAudio().then(() => {
      if (active) setAudioReady(true);
    }).catch((error: unknown) => {
      if (active) setAudioLoadError(error instanceof Error ? error.message : "A required game sound could not be loaded.");
    });
    return () => { active = false; };
  }, [loadAttempt]);
  useEffect(() => {
    let active = true;
    let timer = 0;
    const refresh = async () => {
      const requestStartedAt = Date.now();
      try {
        const response = await fetch("/api/advertisement", { cache: "no-store" });
        if (!response.ok) throw new Error(`Billboard ads returned ${response.status}.`);
        const data = await response.json() as {
          campaigns?: { slot: number; campaign: Campaign | null }[];
          serverTime?: number;
          nextRotationAt?: number;
        };
        if (!active) return;
        if (!data.campaigns || !Number.isFinite(data.serverTime) || !Number.isFinite(data.nextRotationAt)) {
          throw new Error("Billboard ad schedule was incomplete.");
        }
        setCampaigns(BILLBOARD_SLOTS.map(slot => data.campaigns?.find(item => item.slot === slot)?.campaign ?? null));
        timer = window.setTimeout(refresh, Math.max(100, data.nextRotationAt! - data.serverTime! - (Date.now() - requestStartedAt) + 50));
      } catch (error) {
        if (!active) return;
        console.error("Could not load billboard ads; retrying shortly.", error);
        timer = window.setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false, runningFallback = false;
    let map: IbadanMap = { buildings: [], roads: [] };
    setCityReady(false);
    setCityLoadError("");
    const options = () => ({
      billboards: boards.map(r => r.current), clouds: clouds.current, data: map,
      flight: () => command.current, paused: () => paused.current || (command.current === "home" && hover.current),
      onProgress: (value: CityFlightProgress) => { if (!cancelled) setProgress(current => current.mode === value.mode && current.remaining === value.remaining ? current : value); },
      onComplete: (mode: Exclude<CityFlightMode,"home">) => { if (!cancelled) next.current(mode); },
      onReady: () => { if (!cancelled) setCityReady(true); },
    });
    const startFallback = async () => {
      if (runningFallback || cancelled || !fallback.current) return;
      runningFallback = true; dispose?.();
      try {
        const { createIbadanFallback } = await import("@/games/ibadanFallback");
        if (cancelled || !fallback.current) return;
        if (canvas.current) canvas.current.style.visibility = "hidden";
        fallback.current.style.visibility = "visible";
        dispose = createIbadanFallback({ canvas: fallback.current, ...options() });
        setStatus("fallback");
      } catch (error) {
        if (!cancelled) setCityLoadError(error instanceof Error ? error.message : "The city could not be initialized.");
      }
    };
    const lost = (e: Event) => { e.preventDefault(); void startFallback(); };
    const mainCanvas = canvas.current;
    mainCanvas?.addEventListener("webglcontextlost", lost);
    void (async () => {
      try {
        map = await cityData();
      } catch (error) {
        if (!cancelled) setCityLoadError(error instanceof Error ? error.message : "City map data could not be loaded.");
        return;
      }
      if (cancelled || !canvas.current) return;
      try {
        const { createIbadanScene } = await import("@/games/ibadanScene");
        if (cancelled || !canvas.current) return;
        dispose = createIbadanScene({ canvas: canvas.current, ...options() });
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setCityLoadError(error instanceof Error ? error.message : "The 3D city could not be initialized.");
        }
      }
    })();
    return () => { cancelled = true; mainCanvas?.removeEventListener("webglcontextlost", lost); dispose?.(); };
  }, [boards, loadAttempt]);
  const closeViewer = () => { paused.current = false; hover.current = false; setViewing(null); };
  const departing = flight === "departing";
  const loading = !cityReady || !audioReady;
  const loadError = cityLoadError || audioLoadError;
  const retryLoading = () => {
    setGameAudioReady(false);
    setCityAudioVisible(false);
    setCityLoadError("");
    setAudioLoadError("");
    setLoadAttempt((attempt) => attempt + 1);
  };
  const label = progress.remaining > 7 ? "ENGINES STARTING" : progress.remaining > 5 ? "TAKING OFF" : "DEPARTING THROUGH THE CLOUDS";
  return <div className="city-screen" data-city-state={flight} aria-label="Somewhere in Ibadan — live city home">
    <canvas ref={canvas} className="city-render" aria-label="3D city with moving people and traffic"/>
    <canvas ref={fallback} className="city-render city-fallback" aria-label="Animated low-power city"/>
    {BILLBOARD_SLOTS.map((slot) => <Billboard key={`${slot}-${campaigns[slot-1]?.rotationTick ?? "empty"}-${campaigns[slot-1]?.campaign ?? "none"}`} slot={slot} campaign={campaigns[slot-1]} boardRef={boards[slot-1]} onPreview={() => { paused.current = true; setViewing(slot); }} onInteract={(value) => { hover.current = value; }}/>)}
    <div className="city-shade"/>
    <div className="city-topbar"><Link href="/" className="city-back"><ArrowLeft size={16}/><span>EXIT TO WEBSITE</span></Link><div className="city-signal"><span className="city-live-dot"/> SOMEWHERE IN IBADAN <i/> LIVE</div><div className="city-top-right"><span><Shield size={14}/> {player.authenticated ? player.name : "GUEST"}</span></div></div>
    {showHome && flight === "home" && <div className="city-intro city-home-intro"><div className="city-kicker"><Crosshair size={15}/> {status === "loading" ? "LOADING CITY" : "BASE READY"}<span/></div><h1>SOMEWHERE<br/><em>IN IBADAN.</em></h1><p>CHOOSE YOUR MISSION. DEPART WHEN YOU ARE READY.</p><button type="button" className="city-start" disabled={loading} onClick={() => { enableGameAudio(); requestLandscape(); onStart(); }}>START <ArrowRight size={18}/></button><div className="city-ad-shortcuts"><span>BILLBOARDS</span>{BILLBOARD_SLOTS.map(slot => <button type="button" key={slot} aria-label={`Open advert ${slot}`} onClick={() => { paused.current = true; setViewing(slot); }}>{String(slot).padStart(2, "0")}</button>)}</div></div>}
    {departing && <div className="city-flight-status" role="status"><div className="city-kicker"><Crosshair size={15}/> {status === "loading" ? "PREPARING FLIGHT" : label}</div><h2>MISSION BOUND<span>.</span></h2><div className="city-flight-progress"><span style={{width:`${Math.max(0,Math.min(100,progress.progress*100))}%`}}/></div><small>NEXT: THE BATTLEFIELD</small></div>}
    <div className="city-bottom"><span><i/> LIVE CITY</span><span>TRAFFIC ACTIVE <b>✦</b> PEOPLE MOVING <b>✦</b> BASE SECURE</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OPENSTREETMAP CONTRIBUTORS</a></div>
    {children}
    <div ref={clouds} className="city-cloud-transition" aria-hidden="true" style={{opacity: 0}}><i/><i/><i/><i/><i/><i/></div>
    {viewing !== null && <AdvertViewer key={viewing} slot={viewing} campaign={campaigns[viewing-1]} onClose={closeViewer}/>}
    {loading && <div className="game-loading-overlay" role="status" aria-live="polite">
      <div className="game-loading-card">
        <div className="game-loading-mark"><span>T</span><i/></div>
        <p className="game-loading-studio">TOMI TECH STUDIO</p>
        <h2>PREPARING YOUR CITY<span>.</span></h2>
        <p className="game-loading-caption">Loading the world, traffic and game audio.</p>
        <div className="game-loading-progress"><span style={{ width: `${Number(cityReady) * 55 + Number(audioReady) * 45}%` }}/></div>
        <div className="game-loading-checks">
          <span className={cityReady ? "is-loaded" : ""}><i/>{cityReady ? "CITY READY" : "BUILDING CITY"}</span>
          <span className={audioReady ? "is-loaded" : ""}><i/>{audioReady ? "AUDIO READY" : "LOADING GAME AUDIO"}</span>
        </div>
        {loadError && <div className="game-loading-error"><p role="alert">{loadError}</p><button type="button" onClick={retryLoading}>RETRY ASSET LOAD</button></div>}
      </div>
    </div>}
  </div>;
}
