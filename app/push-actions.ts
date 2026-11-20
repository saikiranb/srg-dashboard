"use server";
import { sql } from "@/lib/db";
import { getStaff } from "@/lib/staff";

// The server POSTs to whatever endpoint is stored, so only accept the real browser push services
// (otherwise a staff login could make our server send requests to any URL = SSRF).
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "push.services.mozilla.com"];
const PUSH_SUFFIXES = [".notify.windows.com", ".push.apple.com"];
function isPushEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 1000) return false;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    return PUSH_HOSTS.includes(u.hostname) || PUSH_SUFFIXES.some((s) => u.hostname.endsWith(s));
  } catch { return false; }
}

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function saveSubscription(sub: Sub) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  const { endpoint, keys } = sub ?? {};
  if (!isPushEndpoint(endpoint)) throw new Error("Invalid subscription");
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100 || !/^[A-Za-z0-9_-]+=*$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]+=*$/.test(keys.auth)) throw new Error("Invalid subscription");
  const q = sql();
  await q`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (${me.id}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id=${me.id}, p256dh=${keys.p256dh}, auth=${keys.auth}`;
  // keep at most 5 devices per login
  await q`DELETE FROM push_subscriptions WHERE user_id=${me.id} AND id NOT IN (SELECT id FROM push_subscriptions WHERE user_id=${me.id} ORDER BY id DESC LIMIT 5)`;
}

export async function removeSubscription(endpoint: string) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  await sql()`DELETE FROM push_subscriptions WHERE user_id=${me.id} AND endpoint=${String(endpoint).slice(0, 1000)}`;
}
