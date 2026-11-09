"use client";
import { useEffect, type ReactNode } from "react";

/** One stable landscape coordinate system for every game screen, including menus. */
export default function LandscapeShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const oldBody = document.body.style.overflow;
    const oldHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldBody;
      document.documentElement.style.overflow = oldHtml;
      try { screen.orientation?.unlock?.(); } catch { /* orientation lock unsupported */ }
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
  return <div className="game-viewport"><div id="sambisa-landscape" className="game-landscape">{children}</div></div>;
}
