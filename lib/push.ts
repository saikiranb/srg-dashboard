import * as webpush from "web-push";
import { sql } from "@/lib/db";

type Kind = "electrician" | "plumber";
let configured = false;
function configure() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://srg-dashboard-five.vercel.app", pub, priv);
    configured = true;
  }
  return true;
}

// Sends a phone notification to every subscribed FM + the trade's staff (+ the shared Electrician/Plumber login).
export async function notifyStaff(kind: Kind, flats: string[], opts: { excludeUserId?: number; title?: string; body?: string } = {}) {
  try {
    if (!configure() || !flats.length) return;
    const roles = kind === "electrician" ? ["fm", "electrician", "technician"] : ["fm", "plumber", "technician"];
    const subs = await sql()`SELECT p.id, p.endpoint, p.p256dh, p.auth FROM push_subscriptions p
      JOIN staff_users u ON u.id = p.user_id WHERE u.active AND u.role = ANY(${roles}) AND u.id <> ${opts.excludeUserId ?? 0}`;
    const label = kind === "electrician" ? "Electrician" : "Plumber";
    const payload = JSON.stringify({
      title: opts.title ?? `New ${label} request`,
      body: opts.body ?? (flats.length === 1 ? `Flat ${flats[0]}` : `${flats.length} flats: ${flats.slice(0, 6).join(", ")}${flats.length > 6 ? "…" : ""}`),
      url: "/staff", tag: `req-${kind}`,
    });
    const ok = (e: string) => { try { const h = new URL(e).hostname; return ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "push.services.mozilla.com"].includes(h) || h.endsWith(".notify.windows.com") || h.endsWith(".push.apple.com"); } catch { return false; } };
    await Promise.all(subs.map(async (s) => {
      if (!ok(s.endpoint as string)) { await sql()`DELETE FROM push_subscriptions WHERE id=${s.id}`; return; }
      try {
        await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, payload, { TTL: 3600, urgency: "high" });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sql()`DELETE FROM push_subscriptions WHERE id=${s.id}`; // phone unsubscribed
      }
    }));
  } catch { /* notifications must never break raising a request */ }
}
