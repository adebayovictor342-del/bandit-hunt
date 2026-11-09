"use client";
import { useEffect } from "react";
import { playerStore } from "@/lib/player";
export default function AuthSync() {
  useEffect(() => { void playerStore.refreshSession(); }, []);
  return null;
}
