import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { ensureTable, sql } from "@/lib/db";

const PROD = process.env.NODE_ENV === "production";
// __Host- prefix: browser only accepts it if Secure, Path=/, and no Domain (blocks subdomain cookie injection)
const COOKIE = PROD ? "__Host-admin_session" : "admin_session";
const ISSUER = "srg-dashboard";
const AUDIENCE = "srg-admin";
const SESSION_SECONDS = 60 * 60 * 8;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_GLOBAL = 40;
const WINDOW_MIN = 15;

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

const sha = (s: string) => createHash("sha256").update(s).digest();
function safeEqual(a: string, b: string) {
  return timingSafeEqual(sha(a), sha(b)); // equal-length digests -> constant-time compare
}

export async function clientKey(scope: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const hash = createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET}`).digest("hex"); // raw IPs are never stored
  return `${scope}:${hash}`;
}
export const hashKey = (scope: string, v: string) =>
  `${scope}:${createHash("sha256").update(`${v}|${process.env.AUTH_SECRET}`).digest("hex")}`;

export async function attemptsExceeded(key: string, max: number, scope?: string, maxGlobal?: number) {
  await ensureTable();
  const q = sql();
  const [a] = await q`SELECT count(*)::int AS n FROM login_attempts WHERE key=${key} AND at > now() - make_interval(mins => ${WINDOW_MIN})`;
  if (a.n >= max) return true;
  if (scope && maxGlobal) {
    const [g] = await q`SELECT count(*)::int AS n FROM login_attempts WHERE key LIKE ${scope + ":%"} AND at > now() - make_interval(mins => ${WINDOW_MIN})`;
    if (g.n >= maxGlobal) return true;
  }
  return false;
}
export async function recordFailure(...keys: string[]) {
  const q = sql();
  for (const k of keys) await q`INSERT INTO login_attempts (key) VALUES (${k})`;
  await q`DELETE FROM login_attempts WHERE at < now() - interval '1 day'`;
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400)); // slow down guessing
}
export const clearFailures = (key: string) => sql()`DELETE FROM login_attempts WHERE key=${key}`;
export const lockoutMessage = `Too many attempts. Try again in ${WINDOW_MIN} minutes.`;

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) return { ok: false, error: "Login is disabled (server not configured)" };
  if (password.length > 200) return { ok: false, error: "Invalid password" };

  const key = await clientKey("admin");
  if (await attemptsExceeded(key, MAX_FAILS_PER_IP, "admin", MAX_FAILS_GLOBAL))
    return { ok: false, error: lockoutMessage };

  if (!safeEqual(password, expected)) {
    await recordFailure(key);
    return { ok: false, error: "Invalid password" };
  }

  await clearFailures(key);
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS,
  });
  return { ok: true };
}

export async function logout() {
  // __Host- cookies can only be overwritten by a Set-Cookie that is also Secure + Path=/ ; a bare delete() is ignored by browsers
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: 0, expires: new Date(0) });
}

export async function isAdmin() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return false;
  try {
    await jwtVerify(t, secretKey(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
