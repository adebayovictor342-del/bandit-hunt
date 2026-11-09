"use client";
import { useSyncExternalStore } from "react";
import type { Gender } from "@/games/skirmishTypes";

export interface LocalPlayer {
  id: string;
  name: string;
  email: string;
  gender: Gender | null;
  face: string;
  authenticated: boolean;
  sessionChecked: boolean;
  battleMmr: number;
  battleMatches: number;
  battleWins: number;
  highestNetScore: number;
}
export interface SessionPlayer { id: string; name: string; email?: string | null; gender: string; face: string }
const KEY = "sambisa.player.v1";
const blank = (): LocalPlayer => ({ id: "", name: "", email: "", gender: null, face: "👨‍🚀", authenticated: false, sessionChecked: false, battleMmr: 1250, battleMatches: 0, battleWins: 0, highestNetScore: 0 });
const SERVER = blank();
let state: LocalPlayer | null = null;
const listeners = new Set<() => void>();
let pending: Promise<void> | null = null;
let sessionRevision = 0;
function load(): LocalPlayer {
  if (typeof window === "undefined") return SERVER;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LocalPlayer>;
      // Migrate old settings without retaining ticket limits or trusting stored login state.
      return { ...blank(), id: p.id || "", name: p.name || "", email: p.email || "", gender: p.gender ?? null, face: p.face || "👨‍🚀", battleMmr: p.battleMmr ?? 1250, battleMatches: p.battleMatches ?? 0, battleWins: p.battleWins ?? 0, highestNetScore: p.highestNetScore ?? 0 };
    }
  } catch { /* Storage is optional; the HTTP-only session remains authoritative. */ }
  return blank();
}
function get() { if (!state) state = load(); return state; }
function save(p: LocalPlayer) {
  state = p;
  try { localStorage.setItem(KEY, JSON.stringify({ ...p, authenticated: false, sessionChecked: false })); } catch { /* optional storage */ }
  listeners.forEach((l) => l());
}
function applySession(remote: SessionPlayer | null) {
  const previous = get();
  if (!remote) { save({ ...blank(), sessionChecked: true }); return; }
  const settings = previous.id === remote.id ? previous : blank();
  save({ ...settings, id: remote.id, name: remote.name, email: remote.email ?? "", gender: remote.gender === "female" ? "female" : "male", face: remote.face, authenticated: true, sessionChecked: true });
}
function setSession(remote: SessionPlayer | null) {
  // An in-flight anonymous check must never erase a successful sign-in/signup.
  sessionRevision++;
  applySession(remote);
}
export const playerStore = {
  get,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  isSignedUp: () => get().authenticated,
  setSession,
  refreshSession(force = false): Promise<void> {
    if (pending && !force) return pending;
    const revision = sessionRevision;
    const task = fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" }).then(async (res) => {
      const data = res.ok ? await res.json() : null;
      if (revision !== sessionRevision) return;
      if (res.ok) applySession(data.player ?? null);
      else if (res.status === 401) applySession(null);
      else save({ ...get(), sessionChecked: true });
    }).catch(() => {
      if (revision === sessionRevision) save({ ...get(), sessionChecked: true });
    }).finally(() => { if (pending === task) pending = null; });
    pending = task;
    return task;
  },
  async ensureRemote() { await playerStore.refreshSession(); },
  async signup(name: string, gender: Gender) {
    const res = await fetch("/api/players", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, gender }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not update profile.");
    setSession(data.player);
  },
  async signOut() {
    sessionRevision++;
    await fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setSession(null);
  },
  recordBattle(won: boolean, netScore: number, mmrDelta: number) {
    const p = get();
    save({ ...p, battleMmr: Math.max(800, p.battleMmr + mmrDelta), battleMatches: p.battleMatches + 1, battleWins: p.battleWins + (won ? 1 : 0), highestNetScore: Math.max(p.highestNetScore, netScore) });
  },
  reset() { setSession(null); },
};
export function usePlayer(): LocalPlayer { return useSyncExternalStore(playerStore.subscribe, get, () => SERVER); }
