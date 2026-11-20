import { neon } from "@neondatabase/serverless";

export type Task = {
  id: number;
  title: string;
  description: string;
  category: string;
  assignee: string;
  priority: "Low" | "Medium" | "High";
  status: "Pending" | "In Progress" | "Completed";
  due_date: string | null;
  updated_at: string;
};

export const STATUSES = ["Pending", "In Progress", "Completed"] as const;
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const LIMITS = { title: 200, description: 2000, category: 60, assignee: 100 } as const;

// NOTE: every query in this app uses tagged templates -> values are always sent as bound
// parameters (never string-concatenated), which prevents SQL injection.
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ready = false;
export async function ensureTable() {
  if (ready) return;
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
    category TEXT NOT NULL DEFAULT '' CHECK (char_length(category) <= 60),
    assignee TEXT NOT NULL DEFAULT '' CHECK (char_length(assignee) <= 100),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
    due_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS login_attempts_key_at ON login_attempts (key, at)`;
  await q`CREATE TABLE IF NOT EXISTS staff_users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    mobile TEXT NOT NULL UNIQUE CHECK (mobile ~ '^[6-9][0-9]{9}$'),
    role TEXT NOT NULL CHECK (role IN ('fm','electrician','plumber')),
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    flat TEXT NOT NULL CHECK (flat ~ '^[A-Z]-([0-9]{1,2}|G)[A-Z]$'),
    kind TEXT NOT NULL CHECK (kind IN ('electrician','plumber')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Closed','Cancelled')),
    created_by INT REFERENCES staff_users(id),
    attended_by INT REFERENCES staff_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attended_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
  )`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS service_one_active ON service_requests (flat, kind) WHERE status IN ('Open','In Progress')`;
  await q`CREATE INDEX IF NOT EXISTS service_kind_status ON service_requests (kind, status, created_at)`;
  ready = true;
}

export async function getTasks(): Promise<Task[]> {
  await ensureTable();
  const rows = await sql()`SELECT id, title, description, category, assignee, priority, status,
    to_char(due_date, 'YYYY-MM-DD') AS due_date, updated_at::text AS updated_at
    FROM tasks ORDER BY
      CASE status WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
      CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
      due_date NULLS LAST, id`;
  return rows as Task[];
}
