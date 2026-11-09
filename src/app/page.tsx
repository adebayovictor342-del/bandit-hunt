import Link from "next/link";
import { ArrowRight, Crosshair, Medal, ShieldCheck, Swords, Target, Trophy, Zap } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayLink from "@/components/PlayLink";
import LeaderboardClient from "@/components/LeaderboardClient";

export default function Home() {
  return <div className="site-page"><Header/><main>
    <section className="site-container hero-section">
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-dot"/> THE BATTLEFIELD IS CALLING <span className="eyebrow-line"/></div>
        <h1>YOUR MISSION.<br/><span>YOUR LEGACY.</span></h1>
        <p>Drop into Sambisa Fighter. Take on the fight, earn your place and make every run count.</p>
        <div className="hero-actions"><PlayLink className="site-button primary">PLAY NOW <ArrowRight size={18}/></PlayLink><Link href="/leaderboard" className="site-button secondary">VIEW LEADERBOARD <ArrowRight size={17}/></Link></div>
        <div className="hero-note"><ShieldCheck size={16}/> FREE TO PLAY <span/> <Crosshair size={16}/> BUILT FOR THE BATTLE</div>
      </div>
      <div className="hero-visual">
        <div className="hero-art-grid"/><div className="hero-crosshair one"/><div className="hero-crosshair two"/>
        <img src="/images/landing-operative.jpg" alt="A camouflage-clad Sambisa Fighter operative" className="hero-operative"/>
        <div className="hero-art-shade"/><div className="hero-visual-top"><span><i/> OPERATIVE ONLINE</span><span>SF / 001</span></div>
        <div className="hero-visual-caption"><span>YOUR NEXT MISSION</span><strong>STARTS HERE<span>.</span></strong><small>LOCK IN. DROP IN. RANK UP.</small></div>
        <div className="hero-visual-index">01 <span>/ 04</span></div>
      </div>
    </section>
    <section className="site-container feature-strip" aria-label="Game modes">
      <div className="feature-item"><span className="feature-icon"><Target size={20}/></span><div><strong>JOURNEY TO THE TOP</strong><p>One life. Make it count.</p></div><ArrowRight size={16} className="feature-arrow"/></div>
      <div className="feature-item"><span className="feature-icon"><Swords size={20}/></span><div><strong>BATTLE MODE</strong><p>1v1 or 2v2 against AI.</p></div><ArrowRight size={16} className="feature-arrow"/></div>
      <div className="feature-item"><span className="feature-icon"><Medal size={20}/></span><div><strong>CLIMB THE RANKS</strong><p>Every elimination earns XP.</p></div><ArrowRight size={16} className="feature-arrow"/></div>
    </section>
    <section className="site-container home-board-section"><div className="section-heading"><div><div className="eyebrow"><span className="live-dot"/> THE COMPETITION</div><h2>THE LEADERBOARD<span>.</span></h2><p>See who&apos;s leading the charge this week.</p></div><Link href="/leaderboard" className="text-link">VIEW FULL LEADERBOARD <ArrowRight size={16}/></Link></div><LeaderboardClient compact/></section>
    <section className="site-container cta-section"><div><div className="eyebrow"><Zap size={14}/> READY WHEN YOU ARE</div><h2>YOUR NEXT RUN<br/>STARTS <span>NOW.</span></h2></div><div><p>Suit up and make your mark on the board.</p><PlayLink className="site-button primary">ENTER THE GAME <ArrowRight size={18}/></PlayLink></div><div className="cta-mark"><Trophy/></div></section>
  </main><Footer/></div>;
}
