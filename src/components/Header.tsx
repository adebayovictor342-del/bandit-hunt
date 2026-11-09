"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Menu, Shield, X } from "lucide-react";
import { usePlayer } from "@/lib/player";
import PlayLink from "./PlayLink";

const links = [{ href: "/", label: "HOME" }, { href: "/leaderboard", label: "LEADERBOARD" }, { href: "/profile", label: "MY PROFILE" }];
export function Brand({ small = false }: { small?: boolean }) {
  return <Link href="/" className="brand-mark" aria-label="Sambisa Fighter home"><span className="brand-icon"><Shield size={20} strokeWidth={2.2}/><span className="brand-icon-dot"/></span><span className="brand-word"><strong>SAMBISA<span> FIGHTER</span></strong>{!small && <em>AN AERORANK GAME</em>}</span></Link>;
}
export default function Header() {
  const path = usePathname();
  const p = usePlayer();
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <div className="site-container header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="Main navigation">{links.map((l) => <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>{l.label}</Link>)}</nav>
      <div className="header-actions">
        {p.authenticated ? <Link className="header-signin" href="/profile">{p.name} <ChevronRight size={14}/></Link> : <><Link className="header-signin" href="/signin">SIGN IN</Link><Link className="header-signup" href="/signup">SIGN UP</Link></>}
        <PlayLink className="header-play">PLAY NOW <ChevronRight size={16}/></PlayLink>
        <button className="mobile-menu-button" type="button" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>{open ? <X size={21}/> : <Menu size={21}/>}</button>
      </div>
    </div>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation">{links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}{!p.authenticated && <><Link href="/signin" onClick={() => setOpen(false)}>SIGN IN</Link><Link href="/signup" onClick={() => setOpen(false)}>CREATE ACCOUNT</Link></>}</nav>}
  </header>;
}
