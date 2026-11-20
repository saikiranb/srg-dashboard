"use server";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTable, sql } from "@/lib/db";
import { parseFlats } from "@/lib/flats";
import { getStaff, staffLogin, staffLogout } from "@/lib/staff";

const done = () => { updateTag("queue"); revalidatePath("/service"); revalidatePath("/staff"); revalidatePath("/staff/analytics"); };
const id = (fd: FormData) => {
  const n = Number(fd.get("id"));
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Invalid id");
  return n;
};

export async function staffLoginAction(_: unknown, fd: FormData) {
  const mobile = String(fd.get("mobile") ?? "").replace(/\D/g, "").slice(-10);
  const r = await staffLogin(mobile, String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/staff");
}
export async function staffLogoutAction() {
  await staffLogout();
  redirect("/staff");
}

// FM raises requests: "b4g a6i" -> one queue entry per flat
export async function raiseRequests(_: unknown, fd: FormData) {
  const me = await getStaff();
  if (!me) return { error: "Please sign in again" };
  // FM can raise for either trade; electrician/plumber can raise only for their own trade (e.g. after the FM's hours)
  const kind = me.role === "fm" ? fd.get("kind") : me.role;
  if (kind !== "electrician" && kind !== "plumber") return { error: "Choose Electrician or Plumber" };
  const text = String(fd.get("flats") ?? "").slice(0, 600);
  const { flats, invalid, tooMany } = parseFlats(text);
  if (invalid.length) return { error: `Not recognised: ${invalid.join(", ")}. Use format like b4g, a6i, bgg.` };
  if (tooMany) return { error: "Too many flats in one go (max 20)" };
  if (!flats.length) return { error: "Enter at least one flat, e.g. b4g" };

  await ensureTable();
  const q = sql();
  const res = await q.transaction(flats.map((f) =>
    q`INSERT INTO service_requests (flat, kind, created_by) VALUES (${f.code}, ${kind}, ${me.id})
      ON CONFLICT (flat, kind) WHERE status IN ('Open','In Progress') DO NOTHING RETURNING flat`));
  const added = res.flat().map((r) => r.flat as string);
  const dup = flats.map((f) => f.code).filter((c) => !added.includes(c));
  done();
  const msg = added.length ? `Added to ${kind} queue: ${added.join(", ")}.` : "";
  const dmsg = dup.length ? ` Already in queue: ${dup.join(", ")}.` : "";
  return { ok: (msg + dmsg).trim() };
}

export async function attendRequest(fd: FormData) {
  const me = await getStaff();
  if (!me || me.role === "fm") throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='In Progress', attended_by=${me.id}, attended_at=now()
    WHERE id=${id(fd)} AND kind=${me.role} AND status='Open'`; // atomic: two people can't take the same job
  done();
}

export async function closeRequest(fd: FormData) {
  const me = await getStaff();
  if (!me || me.role === "fm") throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='Closed', closed_at=now()
    WHERE id=${id(fd)} AND kind=${me.role} AND status='In Progress'`;
  done();
}

export async function cancelRequest(fd: FormData) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  // FM can cancel any open request; electrician/plumber only the open requests they raised themselves
  if (me.role === "fm")
    await sql()`UPDATE service_requests SET status='Cancelled' WHERE id=${id(fd)} AND status='Open'`;
  else
    await sql()`UPDATE service_requests SET status='Cancelled' WHERE id=${id(fd)} AND status='Open' AND created_by=${me.id} AND kind=${me.role}`;
  done();
}
