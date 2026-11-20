"use server";
import { after } from "next/server";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTable, sql } from "@/lib/db";
import { getResident, residentLogin, residentLogout } from "@/lib/resident";
import { notifyStaff } from "@/lib/push";

const MAX_PER_FLAT_PER_DAY = 4;   // per trade
const MAX_PER_MOBILE_PER_DAY = 10;

export async function residentLoginAction(_: unknown, fd: FormData) {
  const r = await residentLogin(String(fd.get("mobile") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/resident");
}
export async function residentLogoutAction() {
  await residentLogout();
  redirect("/resident");
}

export async function raiseResidentRequest(_: unknown, fd: FormData) {
  const me = await getResident();
  if (!me) return { error: "Please enter your mobile number again." };
  const kind = fd.get("kind");
  if (kind !== "electrician" && kind !== "plumber") return { error: "Choose Electrician or Plumber." };
  const flat = String(fd.get("flat") ?? me.flats[0]);
  if (!me.flats.includes(flat)) return { error: "That flat is not linked to your number." }; // flat always comes from the backend list

  await ensureTable();
  const q = sql();
  const [c] = await q`SELECT
      count(*) FILTER (WHERE flat=${flat} AND kind=${kind})::int AS flat_n,
      count(*)::int AS mobile_n
    FROM service_requests WHERE source='resident' AND raised_by_mobile=${me.mobile} AND status <> 'Cancelled'
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
  if (c.flat_n >= MAX_PER_FLAT_PER_DAY || c.mobile_n >= MAX_PER_MOBILE_PER_DAY)
    return { error: "You have reached today's request limit. Please call the Facility Manager." };

  const ins = await q`INSERT INTO service_requests (flat, kind, source, raised_by_name, raised_by_mobile)
    VALUES (${flat}, ${kind}, 'resident', ${me.name}, ${me.mobile})
    ON CONFLICT (flat, kind) WHERE status IN ('Open','In Progress') DO NOTHING RETURNING id`;
  updateTag("queue"); revalidatePath("/service"); revalidatePath("/staff"); revalidatePath("/resident");
  if (!ins.length) return { ok: `A ${kind} request for ${flat} is already in the queue — no need to raise it again.` };
  after(() => notifyStaff(kind, [flat])); // sound/phone alert to FM + the trade's staff
  const label = kind === "electrician" ? "Electrician" : "Plumber";
  return { ok: `✅ ${label} request raised for ${flat}. You can track it below.` };
}

export async function cancelResidentRequest(fd: FormData) {
  const me = await getResident();
  if (!me) throw new Error("Unauthorized");
  const id = Number(fd.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id");
  await sql()`UPDATE service_requests SET status='Cancelled' WHERE id=${id} AND status='Open' AND source='resident' AND raised_by_mobile=${me.mobile}`;
  updateTag("queue"); revalidatePath("/service"); revalidatePath("/staff"); revalidatePath("/resident");
}
