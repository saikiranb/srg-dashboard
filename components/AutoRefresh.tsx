"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the server data every N seconds while the tab is visible (live queue without a full reload).
export default function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    const onVis = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [router, seconds]);
  return null;
}
