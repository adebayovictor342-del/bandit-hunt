"use client";
import { useState, type FormEvent } from "react";
import type { Gender } from "@/games/skirmishTypes";
import { playerStore } from "@/lib/player";
import { cn } from "@/lib/cn";

/** Mandatory callsign + gender before a fighter can enter the arena or the boards. */
export default function SignupGate({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(playerStore.get().name);
  const [gender, setGender] = useState<Gender | null>(playerStore.get().gender);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr("Callsign must be at least 2 characters.");
    if (!gender) return setErr("Pick a squad — it decides your Battle Mode team.");
    setBusy(true);
    setErr("");
    try {
      await playerStore.signup(name, gender);
      onDone();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not register");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/90 p-5 backdrop-blur-sm">
      <form onSubmit={submit} className="glass animate-pop w-full max-w-md rounded-3xl p-7">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-300 uppercase">🪖 Enlist</p>
        <h2 className="font-display mt-2 text-3xl font-black text-white">Create your fighter</h2>

        <label className="mt-6 block text-xs font-bold tracking-wider text-slate-400 uppercase" htmlFor="callsign">
          Callsign
        </label>
        <input
          id="callsign"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoComplete="off"
          placeholder="e.g. Nova_Vixen"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/70"
        />

        <p className="mt-5 text-xs font-bold tracking-wider text-slate-400 uppercase">Squad</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(["male", "female"] as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                gender === g ? "border-cyan-300/80 bg-cyan-300/[0.12]" : "border-white/12 bg-white/[0.04] hover:bg-white/[0.08]",
              )}
            >
              <span className="text-2xl">{g === "male" ? "👨‍🚀" : "👩‍🚀"}</span>
              <span className="mt-2 block font-bold text-white">{g === "male" ? "♂ Male Squad" : "♀ Female Squad"}</span>
            </button>
          ))}
        </div>

        {err && (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-gradient mt-6 w-full rounded-full py-3 font-bold text-ink-950 disabled:opacity-50">
          {busy ? "Enlisting…" : "Enter the arena"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mt-3 w-full text-sm text-slate-400 hover:text-white">
            Not now
          </button>
        )}
      </form>
    </div>
  );
}
