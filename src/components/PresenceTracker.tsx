"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PresenceTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/play")) return;
    let active = true;
    let pending = false;
    const report = () => {
      if (!active || pending || document.visibilityState !== "visible") return;
      pending = true;
      void fetch("/api/presence", { method: "POST", cache: "no-store", keepalive: true })
        .catch((error: unknown) => console.error("Could not update online-player presence.", error))
        .finally(() => { pending = false; });
    };
    report();
    const interval = window.setInterval(report, 30_000);
    document.addEventListener("visibilitychange", report);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", report);
    };
  }, [pathname]);
  return null;
}
