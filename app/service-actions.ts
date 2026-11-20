"use server";
import { after } from "next/server";
import { revalidatePath, updateTag } from "next/cache";
import { notifyStaff } from "@/lib/push";
import { redirect } from "next/navigation";
import { ensureTable, sql } from "@/lib/db";
import { parseFlats, LAYOUT_HINT } from "@/lib/flats";
import { getStaff, kindsFor, staffLogin, staffLogout } from "@/lib/staff";

const done = () => { updateTag("queue"); revalidatePath("/resident"); revalidatePath("/service"); revalidatePath("/staff"); revalidatePath("/staff/analytics"); };
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
  // FM and the shared Electrician/Plumber login can raise for either trade; a single-trade login only for its own
  const allowed = kindsFor(me.role);
  const kind = allowed.length === 1 ? allowed[0] : fd.get("kind");
  if (kind !== "electrician" && kind !== "plumber") return { error: "Choose Electrician or Plumber" };
  const text = String(fd.get("flats") ?? "").slice(0, 600);
  const { flats, invalid, tooMany } = parseFlats(text);
  if (invalid.length) return { error: `Not a valid flat: ${invalid.join(", ")}. ${LAYOUT_HINT}. Format like b4g, a6i, bgg.` };
  if (tooMany) return { error: "Too many flats in one go (max 20)" };
  if (!flats.length) return { error: "Enter at least one flat, e.g. b4g" };

  await ensureTable();
  const q = sql();
  const res = await q.transaction(flats.map((f) =>
    q`INSERT INTO service_requests (flat, kind, created_by) VALUES (${f.code}, ${kind}, ${me.id})
      ON CONFLICT (flat, kind) WHERE status IN ('Open','Acknowledged','In Progress','On Hold') DO NOTHING RETURNING flat`));
  const added = res.flat().map((r) => r.flat as string);
  const dup = flats.map((f) => f.code).filter((c) => !added.includes(c));
  done();
  if (added.length) after(() => notifyStaff(kind, added, { excludeUserId: me.id }));
  const msg = added.length ? `Added to ${kind} queue: ${added.join(", ")}.` : "";
  const dmsg = dup.length ? ` Already in queue: ${dup.join(", ")}.` : "";
  return { ok: (msg + dmsg).trim() };
}

// Step 1: someone (FM, electrician, plumber) confirms they have seen the request
export async function acknowledgeRequest(fd: FormData) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='Acknowledged', acknowledged_by=${me.id}, acknowledged_at=now()
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status='Open'`;
  done();
}

// Step 2: work has started (allowed straight from Open too, if nobody pressed Acknowledge first)
export async function attendRequest(fd: FormData) {
  const me = await getStaff();
  if (!me || me.role === "fm") throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='In Progress', attended_by=${me.id}, attended_at=now()
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status IN ('Open','Acknowledged')`; // atomic: two people can't take the same job
  done();
}

export async function closeRequest(fd: FormData) {
  const me = await getStaff();
  if (!me || me.role === "fm") throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='Closed', closed_at=now()
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status='In Progress'`;
  done();
}

export async function cancelRequest(fd: FormData) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  // FM can cancel any open request; electrician/plumber only the open requests they raised themselves
  if (me.role === "fm")
    await sql()`UPDATE service_requests SET status='Cancelled' WHERE id=${id(fd)} AND status IN ('Open','Acknowledged','On Hold')`;
  else
    await sql()`UPDATE service_requests SET status='Cancelled' WHERE id=${id(fd)} AND status IN ('Open','Acknowledged') AND created_by=${me.id} AND kind = ANY(${kindsFor(me.role)})`;
  done();
}

// ---------- society common work (FM only) ----------
export async function startCommonWork(_: unknown, fd: FormData) {
  const me = await getStaff();
  if (me?.role !== "fm") return { error: "Only the Facility Manager can do this" };
  const kind = fd.get("kind");
  if (kind !== "electrician" && kind !== "plumber") return { error: "Choose Electrician or Plumber" };
  const note = String(fd.get("note") ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 120);
  if (!note) return { error: "Describe the work, e.g. Main pipeline leakage" };
  const until = String(fd.get("until") ?? "");
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(until) ? until : null; // optional "expected free by" (today, IST)
  await ensureTable();
  await sql()`INSERT INTO common_work (kind, note, expected_until, started_by)
    VALUES (${kind}, ${note},
      CASE WHEN ${time}::text IS NULL THEN NULL ELSE (
        (((now() AT TIME ZONE 'Asia/Kolkata')::date + ${time}::time) AT TIME ZONE 'Asia/Kolkata')
        -- a time that has already passed today means tomorrow (e.g. night work finishing at 6 AM)
        + CASE WHEN (((now() AT TIME ZONE 'Asia/Kolkata')::date + ${time}::time) AT TIME ZONE 'Asia/Kolkata') < now() THEN interval '1 day' ELSE interval '0' END
      ) END,
      ${me.id})
    ON CONFLICT (kind) WHERE ended_at IS NULL
    DO UPDATE SET note = EXCLUDED.note, expected_until = EXCLUDED.expected_until`;
  done();
  return { ok: "Saved — residents can now see this." };
}

export async function endCommonWork(fd: FormData) {
  const me = await getStaff();
  if (me?.role !== "fm") throw new Error("Unauthorized");
  const kind = fd.get("kind");
  if (kind !== "electrician" && kind !== "plumber") throw new Error("Invalid");
  await sql()`UPDATE common_work SET ended_at = now() WHERE kind = ${kind} AND ended_at IS NULL`;
  done();
}

// ---------- pause / resume (material needed etc.) ----------
const HOLD_KINDS = ["material", "unavailable", "other"] as const;

// Worker (or FM) pauses a job, e.g. resident must buy white cement / a switch first.
export async function holdRequest(_: unknown, fd: FormData) {
  const me = await getStaff();
  if (!me) return { error: "Please sign in again" };
  const hk = HOLD_KINDS.find((k) => k === fd.get("hold_kind"));
  if (!hk) return { error: "Choose a reason" };
  const note = String(fd.get("note") ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 200);
  if (hk !== "unavailable" && !note) return { error: hk === "material" ? "List the material needed, e.g. White cement 1 kg, 6A switch" : "Add a short reason" };
  const r = await sql()`UPDATE service_requests SET status='On Hold', hold_kind=${hk}, hold_reason=${note || null},
      held_at=now(), held_by=${me.id}, material_ready_at=NULL
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status IN ('In Progress','Acknowledged') RETURNING id`;
  if (!r.length) return { error: "This request can't be paused now" };
  done();
  return { ok: "Paused" };
}

// Worker continues the paused job straight away (e.g. got the material himself).
export async function resumeRequest(fd: FormData) {
  const me = await getStaff();
  if (!me || me.role === "fm") throw new Error("Unauthorized");
  await sql()`UPDATE service_requests SET status='In Progress', attended_by=${me.id}, attended_at=coalesce(attended_at, now())
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status='On Hold'`;
  done();
}

// Material arrived -> back into the waiting queue, keeping the wait the resident had before work started.
export async function requeueRequest(fd: FormData) {
  const me = await getStaff();
  if (!me) throw new Error("Unauthorized");
  const rows = await sql()`UPDATE service_requests SET status='Acknowledged', material_ready_at=now(),
      queued_at = now() - coalesce(attended_at - created_at, interval '0')
    WHERE id=${id(fd)} AND kind = ANY(${kindsFor(me.role)}) AND status='On Hold' RETURNING flat, kind`;
  done();
  if (rows.length) after(() => notifyStaff(rows[0].kind, [rows[0].flat], { excludeUserId: me.id, title: "Material ready", body: `Flat ${rows[0].flat} is ready to continue` }));
}
