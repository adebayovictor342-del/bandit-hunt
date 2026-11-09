"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type Creative = {
  slot: number;
  creativeIndex: number;
  image: string;
  video: string;
  destination: string;
  title: string;
  campaign: string;
};
type Analytics = { online: number; samples: { time: number; active: number }[] };

function OnlineChart({ analytics }: { analytics: Analytics }) {
  const points = useMemo(() => {
    const samples = analytics.samples.slice(-60);
    if (samples.length < 2) return "";
    const max = Math.max(1, ...samples.map((sample) => sample.active));
    return samples.map((sample, index) => {
      const x = (index / (samples.length - 1)) * 640;
      const y = 142 - (sample.active / max) * 124;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }, [analytics.samples]);
  return <section className="admin-metric-card" aria-label="Online players chart">
    <div className="admin-metric-head"><div><span className="admin-eyebrow">LIVE PRESENCE</span><h2>{analytics.online}</h2><p>players online now</p></div><span className="admin-live"><i/> LIVE</span></div>
    <svg className="admin-chart" viewBox="0 0 640 160" role="img" aria-label="Online players during the last hour">
      <title>Online players sampled by the server during the last hour</title>
      <path className="admin-chart-grid" d="M0 18H640M0 80H640M0 142H640"/>
      {points && <path className="admin-chart-line" d={points}/>}
    </svg>
    <div className="admin-chart-labels"><span>60 MIN AGO</span><span>NOW</span></div>
  </section>;
}

export default function AdminPage() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [campaigns, setCampaigns] = useState<Creative[][]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ online: 0, samples: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async (replaceCampaigns: boolean) => {
    const response = await fetch("/api/admin/advertisements", { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "Admin session expired. Sign in again." : "Could not load admin data.");
    const data = await response.json() as { campaigns: Creative[][]; analytics: Analytics };
    if (replaceCampaigns) setCampaigns(data.campaigns);
    setAnalytics(data.analytics);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Could not check admin access.");
      return response.json() as Promise<{ configured: boolean; authenticated: boolean }>;
    }).then(async (session) => {
      if (!active) return;
      setConfigured(session.configured);
      setAuthenticated(session.authenticated);
      if (session.authenticated) await loadData(true);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not check admin access.");
    });
    return () => { active = false; };
  }, [loadData]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setInterval(() => {
      void loadData(false).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not refresh online players."));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [authenticated, loadData]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
      });
      const data = await response.json() as { error?: string; authenticated?: boolean };
      if (!response.ok) throw new Error(data.error ?? "Could not sign in.");
      setPassword("");
      setAuthenticated(Boolean(data.authenticated));
      await loadData(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out.");
      setAuthenticated(false); setCampaigns([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    }
  }

  function updateCreative(slotIndex: number, creativeIndex: number, key: keyof Creative, value: string) {
    setCampaigns((previous) => previous.map((slot, currentSlot) => currentSlot !== slotIndex ? slot
      : slot.map((creative, currentIndex) => currentIndex !== creativeIndex ? creative : { ...creative, [key]: value })));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/advertisements", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaigns }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save billboard ads.");
      setMessage("All billboard ads saved. Every viewer follows the same server schedule.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save billboard ads.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="admin-shell">
    <header className="admin-header"><Link href="/" className="admin-brand">SAMBISA <span>FIGHTER</span></Link><span>AD OPERATIONS</span></header>
    <div className="admin-content">
      <div className="admin-title-row"><div><span className="admin-eyebrow">CITY NETWORK / FIVE PLACEMENTS</span><h1>AD CONTROL ROOM<span>.</span></h1><p>Manage four server-synchronized creatives on every Ibadan billboard.</p></div>{authenticated && <button className="admin-signout" type="button" onClick={signOut}>SIGN OUT</button>}</div>
      {error && <p className="admin-alert admin-error" role="alert">{error}</p>}
      {message && <p className="admin-alert admin-success" role="status">{message}</p>}
      {!configured ? <section className="admin-login"><h2>Admin access is not configured</h2><p>Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> in the deployment environment, then redeploy.</p></section>
        : !authenticated ? <form className="admin-login" onSubmit={signIn}><span className="admin-eyebrow">RESTRICTED ACCESS</span><h2>Sign in to manage ads</h2><label>Admin password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label><button className="admin-save" disabled={busy}>{busy ? "SIGNING IN…" : "SIGN IN"}</button></form>
          : <><OnlineChart analytics={analytics}/><form className="admin-campaign-form" onSubmit={save}>
            <div className="admin-section-heading"><div><span className="admin-eyebrow">CREATIVE ROTATION / EVERY 10 SECONDS</span><h2>Billboard campaigns</h2></div><button className="admin-save" disabled={busy || campaigns.length !== 5}>{busy ? "SAVING…" : "SAVE ALL ADS"}</button></div>
            <p className="admin-help">Each placement supports four creatives. Selection is based on server time, so every visitor sees the same ad at the same time. Empty ads show the billboard placeholder.</p>
            {campaigns.map((slot, slotIndex) => <section className="admin-placement" key={slotIndex}>
              <h3>PLACEMENT 0{slotIndex + 1}<span> · {slot.filter((creative) => creative.image || creative.video).length}/4 ACTIVE</span></h3>
              <div className="admin-creative-grid">{slot.map((creative, creativeIndex) => <fieldset className="admin-creative" key={creativeIndex}>
                <legend>AD {creativeIndex + 1}</legend>
                <label>Image URL<input type="text" inputMode="url" value={creative.image} onChange={(event) => updateCreative(slotIndex, creativeIndex, "image", event.target.value)} placeholder="https://… or /ads/creative.webp"/></label>
                <label>Video URL (optional)<input type="text" inputMode="url" value={creative.video} onChange={(event) => updateCreative(slotIndex, creativeIndex, "video", event.target.value)} placeholder="https://… or /ads/creative.mp4"/></label>
                <label>Landing page (optional)<input type="text" inputMode="url" value={creative.destination} onChange={(event) => updateCreative(slotIndex, creativeIndex, "destination", event.target.value)} placeholder="https://advertiser.example"/></label>
                <label>Title<input maxLength={80} value={creative.title} onChange={(event) => updateCreative(slotIndex, creativeIndex, "title", event.target.value)} placeholder="Advertiser name"/></label>
                <label>Campaign ID<input maxLength={80} pattern="[A-Za-z0-9_-]+" value={creative.campaign} onChange={(event) => updateCreative(slotIndex, creativeIndex, "campaign", event.target.value)} required placeholder="campaign-01"/></label>
              </fieldset>)}</div>
            </section>)}
            <button className="admin-save admin-save-bottom" disabled={busy || campaigns.length !== 5}>{busy ? "SAVING…" : "SAVE ALL ADS"}</button>
          </form></>}
    </div>
  </main>;
}
