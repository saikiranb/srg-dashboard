import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { ensureTable, sql } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { attemptsExceeded, clearFailures, clientKey, hashKey, lockoutMessage, recordFailure } from "@/lib/auth";

export type Role = "fm" | "electrician" | "plumber";
export type StaffUser = { id: number; name: string; role: Role };
export const ROLE_LABEL: Record<Role, string> = { fm: "Facility Manager", electrician: "Electrician", plumber: "Plumber" };

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

  const token = await new SignJWT({ uid: u.id, pv: pv(u.password_hash) })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return { ok: true };
}

export async function staffLogout() {
  (await cookies()).delete(COOKIE);
}

// Re-validated against the DB on every call: deactivated users / reset passwords lose access immediately.
export async function getStaff(): Promise<StaffUser | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    const uid = Number(payload.uid);
    if (!Number.isSafeInteger(uid)) return null;
    const [u] = await sql()`SELECT id, name, role, password_hash FROM staff_users WHERE id=${uid} AND active`;
    if (!u || pv(u.password_hash) !== payload.pv) return null;
    return { id: u.id, name: u.name, role: u.role as Role };
  } catch {
    return null;
  }
}
