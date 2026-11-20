import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { ensureTable, sql } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { attemptsExceeded, clearFailures, clientKey, hashKey, lockoutMessage, recordFailure } from "@/lib/auth";

export type Role = "fm" | "electrician" | "plumber" | "technician";
export type StaffUser = { id: number; name: string; role: Role };
export const ROLE_LABEL: Record<Role, string> = { fm: "Facility Manager", electrician: "Electrician", plumber: "Plumber", technician: "Electrician / Plumber" };
// which request queues a role may work on / raise into
export const kindsFor = (r: Role): ("electrician" | "plumber")[] => (r === "electrician" ? ["electrician"] : r === "plumber" ? ["plumber"] : ["electrician", "plumber"]);

const PROD = process.env.NODE_ENV === "production";
const COOKIE = PROD ? "__Host-staff_session" : "staff_session";
const ISSUER = "srg-dashboard";
const AUDIENCE = "srg-staff";
const SESSION_SECONDS = 60 * 60 * 12;

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
};
// changes whenever the password changes -> old sessions die on password reset
const pv = (hash: string) => createHash("sha256").update(hash).digest("hex").slice(0, 16);

function deviceLabel(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${br}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function staffLogin(mobile: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const bad = { ok: false as const, error: "Invalid mobile number or password" };
  if (!/^[6-9]\d{9}$/.test(mobile) || password.length < 1 || password.length > 200) return bad;
  await ensureTable();

  const ipKey = await clientKey("staff");
  const acctKey = hashKey("staffacct", mobile);
  if ((await attemptsExceeded(ipKey, 8, "staff", 60)) || (await attemptsExceeded(acctKey, 8)))
    return { ok: false, error: lockoutMessage };

  const [u] = await sql()`SELECT id, password_hash, active FROM staff_users WHERE mobile=${mobile}`;
  const valid = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !u.active || !valid) {
    await recordFailure(ipKey, acctKey);
    return bad;
  }
  await clearFailures(ipKey); await clearFailures(acctKey);

  // one row per signed-in device -> lets the admin see who is logged in right now
  const device = deviceLabel((await headers()).get("user-agent") ?? "").slice(0, 60);
  const [sess] = await sql()`INSERT INTO staff_sessions (user_id, device) VALUES (${u.id}, ${device}) RETURNING id`;
  await sql()`DELETE FROM staff_sessions WHERE created_at < now() - interval '30 days'`;
  const token = await new SignJWT({ uid: u.id, pv: pv(u.password_hash) })
    .setProtectedHeader({ alg: "HS256" }).setJti(sess.id as string).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return { ok: true };
}

export async function staffLogout() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (t) {
    try {
      const { payload } = await jwtVerify(t, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
      if (payload.jti && UUID.test(payload.jti)) await sql()`UPDATE staff_sessions SET revoked_at=now() WHERE id=${payload.jti} AND revoked_at IS NULL`;
    } catch {}
  }
  // __Host- cookies can only be overwritten by a Set-Cookie that is also Secure + Path=/ ; a bare delete() is ignored by browsers
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: 0, expires: new Date(0) });
}

// Re-validated against the DB on every call: deactivated users / reset passwords lose access immediately.
export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    const uid = Number(payload.uid);
    const jti = payload.jti;
    if (!Number.isSafeInteger(uid) || !jti || !UUID.test(jti)) return null;
    // valid only if the user is active, the password is unchanged AND this device's session hasn't been signed out
    const [u] = await sql()`SELECT u.id, u.name, u.role, u.password_hash FROM staff_users u
      JOIN staff_sessions s ON s.user_id = u.id
      WHERE u.id=${uid} AND u.active AND s.id=${jti} AND s.revoked_at IS NULL`;
    if (!u || pv(u.password_hash) !== payload.pv) return null;
    after(async () => { // mark "last seen" (at most once a minute) without slowing the page
      await sql()`UPDATE staff_sessions SET last_seen=now() WHERE id=${jti} AND last_seen < now() - interval '1 minute'`;
    });
    return { id: u.id, name: u.name, role: u.role as Role };
  } catch {
    return null;
  }
});
