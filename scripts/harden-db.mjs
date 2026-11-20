import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const add = async (name, expr) => {
  const [r] = await sql`SELECT 1 AS x FROM pg_constraint WHERE conname = ${name}`;
  if (!r) await sql.query(`ALTER TABLE tasks ADD CONSTRAINT ${name} CHECK (${expr})`);
};
await add("tasks_title_len", "char_length(title) BETWEEN 1 AND 200");
await add("tasks_desc_len", "char_length(description) <= 2000");
await add("tasks_cat_len", "char_length(category) <= 60");
await add("tasks_who_len", "char_length(assignee) <= 100");
await add("tasks_priority_ok", "priority IN ('Low','Medium','High')");
await add("tasks_status_ok", "status IN ('Pending','In Progress','Completed')");
await sql`CREATE TABLE IF NOT EXISTS login_attempts (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`;
await sql`CREATE INDEX IF NOT EXISTS login_attempts_key_at ON login_attempts (key, at)`;
console.log("DB constraints applied");
