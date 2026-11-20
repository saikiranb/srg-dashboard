"use client";
import { useEffect, useRef, useState } from "react";
import { removeSubscription, saveSubscription } from "@/app/push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const b64 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

// Sound + vibration while the app is open, and phone notifications (push) even when it is closed.
export default function AlertsPanel({ latestId, count }: { latestId: number; count: number }) {
  const [sound, setSound] = useState(false);
  const [push, setPush] = useState<"unsupported" | "off" | "on" | "denied">("off");
  const [msg, setMsg] = useState("");
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef(latestId);
  const baseTitle = useRef("");

  const beep = () => {
    const c = ctx.current; if (!c) return;
    if (c.state === "suspended") void c.resume();
    [0, 0.35, 0.7].forEach((t) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square"; o.frequency.value = t === 0.7 ? 1040 : 880;
      g.gain.setValueAtTime(0.0001, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, c.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.28);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.3);
    });
  };

  useEffect(() => {
    baseTitle.current = document.title;
    if (get("srg-sound") === "1") { setSound(true); try { ctx.current = new AudioContext(); } catch {} }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !VAPID) { setPush("unsupported"); return; }
    if (Notification.permission === "denied") { setPush("denied"); return; }
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setPush(s ? "on" : "off")).catch(() => {});
  }, []);

  // new request arrived (the page re-fetches every ~15s)
  useEffect(() => {
    if (latestId > last.current) {
      if (sound) beep();
      try { navigator.vibrate?.([250, 120, 250, 120, 250]); } catch {}
    }
    last.current = latestId;
    document.title = count > 0 ? `(${count}) ${baseTitle.current}` : baseTitle.current;
  }, [latestId, count, sound]);

  const toggleSound = () => {
    if (sound) { set("srg-sound", "0"); setSound(false); return; }
    try { ctx.current = ctx.current ?? new AudioContext(); void ctx.current.resume(); } catch {}
    set("srg-sound", "1"); setSound(true); setTimeout(beep, 50); // user gesture -> browsers allow audio from now on
  };

  const enablePush = async () => {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPush(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID!) });
      await saveSubscription(JSON.parse(JSON.stringify(sub)));
      setPush("on");
    } catch { setMsg("Could not turn on notifications on this device."); }
  };
  const disablePush = async () => {
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe(); }
      setPush("off");
    } catch {}
  };

  const row = "flex items-center gap-3 rounded-lg border bg-white p-3 text-sm";
  const btn = "rounded-lg px-3 py-1.5 font-semibold";
  return (
    <section className="mb-6 space-y-2" aria-label="Alerts">
      <div className={row}>
        <div className="flex-1"><b>🔊 Sound alert</b><div className="text-xs text-slate-500">Beeps + vibrates when a new request arrives while this app is open.</div></div>
        <button onClick={toggleSound} className={`${btn} ${sound ? "bg-emerald-600 text-white" : "border"}`}>{sound ? "On" : "Turn on"}</button>
        {sound && <button onClick={beep} className={`${btn} border`}>Test</button>}
      </div>
      <div className={row}>
        <div className="flex-1"><b>🔔 Phone notifications</b>
          <div className="text-xs text-slate-500">
            {push === "unsupported" && "Not available here. On iPhone, first Add to Home Screen and open the app from the icon."}
            {push === "denied" && "Blocked. Allow notifications for this site in your phone settings, then reload."}
            {(push === "on" || push === "off") && "Get alerted for new requests even when the app is closed."}
          </div></div>
        {push === "off" && <button onClick={enablePush} className={`${btn} border`}>Turn on</button>}
        {push === "on" && <button onClick={disablePush} className={`${btn} bg-emerald-600 text-white`}>On</button>}
      </div>
      {msg && <p role="alert" className="text-xs text-red-600">{msg}</p>}
    </section>
  );
}
