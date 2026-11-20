"use server";
import { sql } from "@/lib/db";
import { getStaff } from "@/lib/staff";

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function saveSubscription(sub: Sub) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  const { endpoint, keys } = sub ?? {};
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) throw new Error("Invalid subscription");
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100) throw new Error("Invalid subscription");
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
