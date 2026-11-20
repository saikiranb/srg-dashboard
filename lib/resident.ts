import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { ensureTable, sql } from "@/lib/db";
import { attemptsExceeded, clientKey, lockoutMessage, recordFailure } from "@/lib/auth";

const PROD = process.env.NODE_ENV === "production";
const COOKIE = PROD ? "__Host-resident_session" : "resident_session";
const ISSUER = "srg-dashboard";
const AUDIENCE = "srg-resident";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type Resident = { mobile: string; name: string; flats: string[] };

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
};

// "+91 98765-43210", "09876543210", "9876543210" -> "9876543210" (or null if not a valid Indian mobile)
export function normalizeMobile(v: unknown): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export async function residentLogin(rawMobile: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const mobile = normalizeMobile(rawMobile);
  if (!mobile) return { ok: false, error: "Enter your 10-digit mobile number" };
  await ensureTable();
  const ipKey = await clientKey("resident");
  if (await attemptsExceeded(ipKey, 10)) return { ok: false, error: lockoutMessage };
  const rows = await sql()`SELECT 1 FROM residents WHERE mobile=${mobile} LIMIT 1`;
  if (!rows.length) {
    await recordFailure(ipKey); // slows down anyone trying numbers one by one
    return { ok: false, error: "This number is not registered. Please contact the Facility Manager." };
  }
  const token = await new SignJWT({ m: mobile })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
  return { ok: true };
}

export async function residentLogout() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: PROD, sameSite: "strict", path: "/", maxAge: 0, expires: new Date(0) });
}

// Re-checked against the residents list on every request: if the number is removed, access ends immediately.
export const getResident = cache(async (): Promise<Resident | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    const mobile = normalizeMobile(payload.m);
    if (!mobile) return null;
    const rows = await sql()`SELECT name, flat FROM residents WHERE mobile=${mobile} ORDER BY flat`;
    if (!rows.length) return null;
    return { mobile, name: rows[0].name as string, flats: rows.map((r) => r.flat as string) };
  } catch {
    return null;
  }
});
