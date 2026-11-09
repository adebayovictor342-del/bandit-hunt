"use client";
/* Native images are preloaded, static game/advert assets; no resizing proxy is needed. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { playerStore, type SessionPlayer } from "@/lib/player";
import type { Gender } from "@/games/skirmishTypes";

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter(); const search = useSearchParams();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("male"); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const next = search.get("next"); const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, gender }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      playerStore.setSession(data.player as SessionPlayer);
      await playerStore.refreshSession(true);
      if (!playerStore.isSignedUp()) throw new Error("Your login could not be saved. Please allow cookies and try again.");
      // Preserve the selected mission. Avoid a second router refresh that can
      // restart the city before its authenticated resume intent is consumed.
      router.replace(destination);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  return <div className="auth-layout"><div className="auth-visual"><img src="/images/landing-operative.jpg" alt=""/><div className="auth-visual-shade"/><div className="auth-visual-copy"><div className="eyebrow"><span className="live-dot"/> YOUR JOURNEY STARTS HERE</div><h2>LEAVE YOUR<br/><span>MARK.</span></h2><p>One fighter. Every run. Your name on the board.</p></div><span className="auth-index">SAMBISA FIGHTER / 001</span></div>
    <div className="auth-panel"><div className="eyebrow"><span className="live-dot"/> {mode === "signup" ? "JOIN THE FIGHT" : "WELCOME BACK"}</div><h1>{mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}<span>.</span></h1><p className="auth-subtitle">{mode === "signup" ? "Create your fighter and start climbing." : "Your next mission is waiting."}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <label>CALLSIGN<div className="input-wrap"><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={24} autoComplete="nickname" placeholder="Your fighter name" required/></div></label>}
        <label>EMAIL ADDRESS<div className="input-wrap"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></div></label>
        <label>PASSWORD<div className="input-wrap"><LockKeyhole size={17}/><input type={show ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} required/><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={()=>setShow(!show)}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {mode === "signup" && <fieldset><legend>SQUAD</legend><div className="squad-picker"><button type="button" className={gender === "male" ? "active" : ""} onClick={()=>setGender("male")} aria-pressed={gender === "male"}>♂ &nbsp; MALE</button><button type="button" className={gender === "female" ? "active" : ""} onClick={()=>setGender("female")} aria-pressed={gender === "female"}>♀ &nbsp; FEMALE</button></div></fieldset>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="site-button primary auth-submit" type="submit" disabled={busy}>{busy ? "PLEASE WAIT..." : mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}<ArrowRight size={17}/></button>
      </form><p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Sambisa Fighter?"} <Link href={`${mode === "signup" ? "/signin" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}>{mode === "signup" ? "Sign in" : "Create account"}</Link></p>
    </div></div>;
}
