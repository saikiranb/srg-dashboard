import { neon } from "@neondatabase/serverless";
import { unstable_cache } from "next/cache";

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
  // fast path: one cheap query when the schema already exists (the normal case)
  const [chk] = await q`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname IN ('service_active_v2','service_kind_status','login_attempts_key_at','staff_sessions_user','residents_mobile','push_user','common_work_active')`;
  if (chk.n === 7) { ready = true; return; }
  await q.transaction([
  q`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
    category TEXT NOT NULL DEFAULT '' CHECK (char_length(category) <= 60),
    assignee TEXT NOT NULL DEFAULT '' CHECK (char_length(assignee) <= 100),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
    due_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  q`CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  q`CREATE INDEX IF NOT EXISTS login_attempts_key_at ON login_attempts (key, at)`,
  q`CREATE TABLE IF NOT EXISTS staff_users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    mobile TEXT NOT NULL UNIQUE CHECK (mobile ~ '^[6-9][0-9]{9}$'),
    role TEXT NOT NULL CHECK (role IN ('fm','electrician','plumber','technician')),
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  q`CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    flat TEXT NOT NULL CHECK (flat ~ '^[A-Z]-([0-9]{1,2}|G)[A-Z]$'),
    kind TEXT NOT NULL CHECK (kind IN ('electrician','plumber')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Acknowledged','In Progress','Closed','Cancelled')),
    created_by INT REFERENCES staff_users(id),
    attended_by INT REFERENCES staff_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attended_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
  )`,
  q`ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check`,
  q`ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check CHECK (status IN ('Open','Acknowledged','In Progress','Closed','Cancelled'))`,
  q`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ`,
  q`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS acknowledged_by INT REFERENCES staff_users(id)`,
  q`CREATE UNIQUE INDEX IF NOT EXISTS service_active_v2 ON service_requests (flat, kind) WHERE status IN ('Open','Acknowledged','In Progress')`,
  q`DROP INDEX IF EXISTS service_one_active`,
  q`CREATE INDEX IF NOT EXISTS service_kind_status ON service_requests (kind, status, created_at)`,
  q`ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_role_check`,
  q`ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check CHECK (role IN ('fm','electrician','plumber','technician'))`,
  q`CREATE TABLE IF NOT EXISTS staff_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    device TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
  )`,
  q`CREATE INDEX IF NOT EXISTS staff_sessions_user ON staff_sessions (user_id, revoked_at)`,
  q`CREATE TABLE IF NOT EXISTS residents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    mobile TEXT NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
    flat TEXT NOT NULL CHECK (flat ~ '^[A-Z]-([0-9]{1,2}|G)[A-Z]$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (mobile, flat)
  )`,
  q`CREATE INDEX IF NOT EXISTS residents_mobile ON residents (mobile)`,
  q`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS raised_by_name TEXT`,
  q`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS raised_by_mobile TEXT`,
  q`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'staff'`,
  q`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  q`CREATE INDEX IF NOT EXISTS push_user ON push_subscriptions (user_id)`,
  q`CREATE TABLE IF NOT EXISTS common_work (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('electrician','plumber')),
    note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 120),
    expected_until TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_by INT REFERENCES staff_users(id),
    ended_at TIMESTAMPTZ
  )`,
  q`CREATE UNIQUE INDEX IF NOT EXISTS common_work_active ON common_work (kind) WHERE ended_at IS NULL`,
  ]);
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

// Public pages read through a short cache so they don't wait on the database (Neon wakes slowly after idle).
// Mutations call updateTag("tasks") so changes show up immediately.
export const getTasksCached = unstable_cache(getTasks, ["tasks-v1"], { tags: ["tasks"], revalidate: 30 });
