"use server";
import { revalidatePath } from "next/cache";
import { ensureTable, sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getStaff } from "@/lib/staff";
import { cell, clean, colIndex, readXlsx } from "@/lib/xlsx";
import { parseFlats } from "@/lib/flats";
import { normalizeMobile } from "@/lib/resident";

// Residents list can be managed by the admin or the Facility Manager
async function guard() {
  if (!(await isAdmin()) && (await getStaff())?.role !== "fm") throw new Error("Unauthorized");
}
const done = () => { revalidatePath("/staff/residents"); };

function flatCode(block: string, flat: string): string | null {
  for (const candidate of [block + flat, flat]) {
    const r = parseFlats(candidate);
    if (r.flats.length === 1 && !r.invalid.length) return r.flats[0].code;
  }
  return null;
}

export async function importResidents(_: unknown, fd: FormData) {
  await guard(); await ensureTable();
  const r = await readXlsx(fd.get("file"), 3000);
  if ("error" in r) return { error: r.error };
  const header = (r.data[0] ?? []).map((h) => cell(h, 40).toLowerCase());
  const c = {
    name: colIndex(header, "name", "resident", "resident name", "owner", "owner name"),
    mobile: colIndex(header, "mobile", "mobile number", "mobile no", "mobile no.", "phone", "phone number", "contact", "contact number"),
    flat: colIndex(header, "flat number", "flat no", "flat no.", "flat", "unit", "flat/unit"),
    block: colIndex(header, "block", "tower", "block name"),
  };
  if (c.name < 0 || c.mobile < 0 || c.flat < 0) return { error: "Header row must have: Name, Mobile, Flat Number, Block" };

  const q = sql();
  const stmts = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  if (fd.get("replace")) stmts.push(q`DELETE FROM residents`);
  let n = 0;
  r.data.slice(1).forEach((row, i) => {
    const rowNo = i + 2;
    const name = clean(row[c.name], 80);
    const mobile = normalizeMobile(cell(row[c.mobile], 20));
    if (!name && !cell(row[c.mobile], 20) && !cell(row[c.flat], 20)) return; // blank row
    if (!name) return void problems.push(`Row ${rowNo}: name missing`);
    if (!mobile) return void problems.push(`Row ${rowNo}: invalid mobile`);
    const flat = flatCode(c.block < 0 ? "" : cell(row[c.block], 10), cell(row[c.flat], 20));
    if (!flat) return void problems.push(`Row ${rowNo}: no such flat (A: 6–12, A–I · B: GA–GG/GI, 1–14, A–J)`);
    if (seen.has(mobile + flat)) return;
    seen.add(mobile + flat);
    stmts.push(q`INSERT INTO residents (name, mobile, flat) VALUES (${name}, ${mobile}, ${flat})
      ON CONFLICT (mobile, flat) DO UPDATE SET name = EXCLUDED.name`);
    n++;
  });
  if (!n) return { error: problems.length ? `No valid rows. ${problems.slice(0, 5).join("; ")}` : "No valid rows found" };
  await q.transaction(stmts);
  done();
  return { ok: `Imported ${n} resident${n === 1 ? "" : "s"}${problems.length ? `, skipped ${problems.length}` : ""}.`, problems: problems.slice(0, 10) };
}

export async function addResident(_: unknown, fd: FormData) {
  await guard(); await ensureTable();
  const name = clean(fd.get("name"), 80);
  const mobile = normalizeMobile(fd.get("mobile"));
  const flat = flatCode(clean(fd.get("block"), 10), clean(fd.get("flat"), 20));
  if (!name) return { error: "Name is required" };
  if (!mobile) return { error: "Enter a valid 10-digit mobile number" };
  if (!flat) return { error: "No such flat. A block: floors 6–12, flats A–I · B block: GA–GG & GI, floors 1–14 flats A–J" };
  await sql()`INSERT INTO residents (name, mobile, flat) VALUES (${name}, ${mobile}, ${flat})
    ON CONFLICT (mobile, flat) DO UPDATE SET name = EXCLUDED.name`;
  done();
  return { ok: `Saved ${name} · ${flat}` };
}

export async function deleteResident(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid id");
  await sql()`DELETE FROM residents WHERE id=${id}`;
  done();
}
