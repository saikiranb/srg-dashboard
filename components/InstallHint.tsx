"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void> };

// Small "Install app" banner: Android/Chrome gets a one-tap button, iPhone gets the Share -> Add to Home Screen steps.
export default function InstallHint() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("install-hint-dismissed") === "1"; } catch {}
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); setHidden(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;
  const close = () => { setHidden(true); try { localStorage.setItem("install-hint-dismissed", "1"); } catch {} };
  return (
    <div role="region" aria-label="Install app" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-white p-3 text-sm shadow-lg">
      <div className="flex-1">
        <b>Install the SRG Society app</b>
        <div className="text-xs text-slate-600">
          {ios ? "Tap the Share button, then “Add to Home Screen”." : "Add it to your home screen for one-tap access."}
        </div>
      </div>
      {evt && <button onClick={async () => { await evt.prompt(); setEvt(null); close(); }} className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white">Install</button>}
      <button onClick={close} aria-label="Dismiss" className="px-2 text-slate-500">✕</button>
    </div>
  );
}
