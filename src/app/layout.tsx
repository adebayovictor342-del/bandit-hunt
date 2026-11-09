import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import AuthSync from "@/components/AuthSync";
import PresenceTracker from "@/components/PresenceTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sambisa Fighter | AeroRank",
  description: "Enter the arena, play Sambisa Fighter, and climb the leaderboard.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111713" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body className="min-h-screen antialiased"><AuthSync /><PresenceTracker />{children}</body></html>;
}
