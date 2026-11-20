"use server";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { readXlsx, cell } from "@/lib/xlsx";
import { ensureTable, sql, STATUSES, PRIORITIES, LIMITS } from "@/lib/db";
import { isAdmin, login, logout } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

// ---------- helpers ----------
async function guard() {
  if (!(await isAdmin())) throw new Error("Unauthorized"); // re-checked in EVERY action, never trust the UI
}
// strip control chars, normalise, trim, hard-cap length
const clean = (v: unknown, max: number) =>
  String(v ?? "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const field = (fd: FormData, k: string, max: number) => clean(fd.get(k), max);
function oneOf<T extends readonly string[]>(list: T, v: string, d: T[number]): T[number] {
  return list.find((x) => x.toLowerCase() === v.toLowerCase()) ?? d;
}
function validDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z");
  if (isNaN(+d) || d.toISOString().slice(0, 10) !== v) return null;
  const y = d.getUTCFullYear();
  return y >= 2000 && y <= 2100 ? v : null;
}
function validId(v: unknown) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Invalid id");
  return n;
}
const done = () => { updateTag("tasks"); revalidatePath("/"); revalidatePath("/admin"); };

type Parsed = { title: string; description: string; category: string; assignee: string; priority: string; status: string; due: string | null };
function parseTask(fd: FormData): Parsed | null {
  const title = field(fd, "title", LIMITS.title);
  if (!title) return null;
  return {
    title,
    description: field(fd, "description", LIMITS.description),
    category: field(fd, "category", LIMITS.category),
    assignee: field(fd, "assignee", LIMITS.assignee),
    priority: oneOf(PRIORITIES, field(fd, "priority", 10), "Medium"),
    status: oneOf(STATUSES, field(fd, "status", 20), "Pending"),
    due: validDate(field(fd, "due_date", 10)),
  };
}

// ---------- auth ----------
export async function loginAction(_: unknown, fd: FormData) {
  const r = await login(String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect("/admin");
}
export async function logoutAction() {
  await logout();
  redirect("/");
}

// ---------- CRUD (all values are bound parameters) ----------
export async function addTask(fd: FormData) {
  await guard(); await ensureTable();
  const t = parseTask(fd);
  if (!t) return;
  await sql()`INSERT INTO tasks (title, description, category, assignee, priority, status, due_date)
    VALUES (${t.title}, ${t.description}, ${t.category}, ${t.assignee}, ${t.priority}, ${t.status}, ${t.due})`;
  done();
}

export async function updateTask(fd: FormData) {
  await guard();
  const id = validId(fd.get("id"));
  const t = parseTask(fd);
  if (!t) return;
  await sql()`UPDATE tasks SET title=${t.title}, description=${t.description}, category=${t.category},
    assignee=${t.assignee}, priority=${t.priority}, status=${t.status}, due_date=${t.due}, updated_at=now() WHERE id=${id}`;
  done();
}

export async function setStatus(id: number, status: string) {
  await guard();
  await sql()`UPDATE tasks SET status=${oneOf(STATUSES, clean(status, 20), "Pending")}, updated_at=now() WHERE id=${validId(id)}`;
  done();
}

export async function deleteTask(fd: FormData) {
  await guard();
  await sql()`DELETE FROM tasks WHERE id=${validId(fd.get("id"))}`;
  done();
}

// ---------- Excel import (hardened, see lib/xlsx.ts) ----------
const MAX_ROWS = 500;

const STATUS_ALIASES: Record<string, string> = {
  open: "Pending", todo: "Pending", "not started": "Pending", pending: "Pending",
  ongoing: "In Progress", wip: "In Progress", "in-progress": "In Progress", "working progress": "In Progress",
  done: "Completed", complete: "Completed", closed: "Completed",
};

export async function importExcel(_: unknown, fd: FormData) {
  await guard(); await ensureTable();
  const r = await readXlsx(fd.get("file"), MAX_ROWS);
  if ("error" in r) return { error: r.error };
  const data = r.data;

  // index-based column lookup (no object keys from user data -> no prototype pollution)
  const header = (data[0] ?? []).map((h) => cell(h, 60).toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const c = {
    title: col("task", "title", "name", "work", "work description", "issue", "item"),
    desc: col("description", "details", "notes", "remarks", "effects"),
    cat: col("category", "area", "type"),
    who: col("assignee", "assigned to", "owner", "responsible", "vendor"),
    pri: col("priority"), st: col("status"),
    due: col("due date", "due", "deadline", "target date"),
  };
  if (c.title < 0) return { error: "No Task/Title column found in the header row" };
  const get = (r: unknown[], i: number, max: number) => (i < 0 ? "" : cell(r[i], max));

  const q = sql();
  const stmts = [];
  if (fd.get("replace")) stmts.push(q`DELETE FROM tasks`);
  let n = 0;
  for (const r of data.slice(1)) {
    const title = get(r, c.title, LIMITS.title);
    if (!title) continue;
    const rawStatus = get(r, c.st, 20);
    stmts.push(q`INSERT INTO tasks (title, description, category, assignee, priority, status, due_date) VALUES (
      ${title}, ${get(r, c.desc, LIMITS.description)}, ${get(r, c.cat, LIMITS.category)}, ${get(r, c.who, LIMITS.assignee)},
      ${oneOf(PRIORITIES, get(r, c.pri, 10), "Medium")},
      ${oneOf(STATUSES, STATUS_ALIASES[rawStatus.toLowerCase()] ?? rawStatus, "Pending")},
      ${validDate(get(r, c.due, 10))})`);
    n++;
  }
  if (!n) return { error: "No valid rows found" };
  await q.transaction(stmts); // all-or-nothing
  done();
  return { ok: `Imported ${n} tasks` };
}

// ---------- staff accounts (admin only) ----------

const ROLES = ["fm", "electrician", "plumber", "technician"] as const;
// min 10 chars, letters + digits, and must not contain the login mobile number
const PW_RULE = "Password must be 10-72 characters with letters and numbers, and must not contain the mobile number";
const goodPassword = (p: string, mobile = "") =>
  p.length >= 10 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p) && !(mobile && p.replace(/\D/g, "").includes(mobile.slice(-6)));

export async function addStaff(_: unknown, fd: FormData) {
  await guard(); await ensureTable();
  const name = field(fd, "name", 80);
  const mobile = field(fd, "mobile", 15).replace(/\D/g, "");
  const role = ROLES.find((r) => r === field(fd, "role", 12));
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Name is required" };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { error: "Enter a valid 10-digit mobile number" };
  if (!role) return { error: "Choose a role" };
  if (!goodPassword(password, mobile)) return { error: PW_RULE };
  const hash = await hashPassword(password);
  const r = await sql()`INSERT INTO staff_users (name, mobile, role, password_hash) VALUES (${name}, ${mobile}, ${role}, ${hash})
    ON CONFLICT (mobile) DO NOTHING RETURNING id`;
  if (!r.length) return { error: "That mobile number is already registered" };
  done();
  return { ok: `Added ${name}` };
}

export async function resetStaffPassword(_: unknown, fd: FormData) {
  await guard();
  const password = String(fd.get("password") ?? "");
  const uid = validId(fd.get("id"));
  const [u] = await sql()`SELECT mobile FROM staff_users WHERE id=${uid}`;
  if (!goodPassword(password, u?.mobile ?? "")) return { error: PW_RULE };
  await sql()`UPDATE staff_users SET password_hash=${await hashPassword(password)} WHERE id=${uid}`;
  await sql()`UPDATE staff_sessions SET revoked_at=now() WHERE user_id=${uid} AND revoked_at IS NULL`;
  done();
  return { ok: "Password updated (user was signed out)" };
}

export async function setStaffActive(fd: FormData) {
  await guard();
  const uid = validId(fd.get("id"));
  const active = fd.get("active") === "1";
  await sql()`UPDATE staff_users SET active=${active} WHERE id=${uid}`;
  if (!active) await sql()`UPDATE staff_sessions SET revoked_at=now() WHERE user_id=${uid} AND revoked_at IS NULL`;
  done();
}

export async function revokeSession(fd: FormData) {
  await guard();
  const sid = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sid)) throw new Error("Invalid id");
  await sql()`UPDATE staff_sessions SET revoked_at=now() WHERE id=${sid} AND revoked_at IS NULL`;
  done();
}
