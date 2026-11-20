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

async function clientKey() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET}`).digest("hex"); // raw IPs are never stored
}

async function tooManyAttempts(key: string) {
  await ensureTable();
  const q = sql();
  const [a] = await q`SELECT count(*)::int AS n FROM login_attempts WHERE key=${key} AND at > now() - make_interval(mins => ${WINDOW_MIN})`;
  const [g] = await q`SELECT count(*)::int AS n FROM login_attempts WHERE at > now() - make_interval(mins => ${WINDOW_MIN})`;
  return a.n >= MAX_FAILS_PER_IP || g.n >= MAX_FAILS_GLOBAL;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) return { ok: false, error: "Login is disabled (server not configured)" };
  if (password.length > 200) return { ok: false, error: "Invalid password" };

  const key = await clientKey();
  if (await tooManyAttempts(key))
    return { ok: false, error: `Too many attempts. Try again in ${WINDOW_MIN} minutes.` };

  if (!safeEqual(password, expected)) {
    const q = sql();
    await q`INSERT INTO login_attempts (key) VALUES (${key})`;
    await q`DELETE FROM login_attempts WHERE at < now() - interval '1 day'`;
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400)); // slow down guessing
    return { ok: false, error: "Invalid password" };
  }

  await sql()`DELETE FROM login_attempts WHERE key=${key}`;
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
  (await cookies()).delete(COOKIE);
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
