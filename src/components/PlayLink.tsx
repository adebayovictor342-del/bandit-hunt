"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { enableGameAudio } from "@/games/audio";

type ScreenWithLock = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
/** Must run in the click gesture. Unsupported browsers use the rotated game shell. */
export function requestLandscape() {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
  const lock = () => (screen.orientation as ScreenWithLock | undefined)?.lock?.("landscape").catch(() => {});
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(lock).catch(() => lock());
  } else lock();
}
export default function PlayLink({ children, className, href = "/play" }: { children: ReactNode; className?: string; href?: string }) {
  return <Link href={href} className={className} onClick={() => { enableGameAudio(); requestLandscape(); }}>{children}</Link>;
}
