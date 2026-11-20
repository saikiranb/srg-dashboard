// Usage: DATABASE_URL=... node scripts/seed.mjs [--replace]   (or: vercel env pull .env.local && node --env-file=.env.local scripts/seed.mjs)
import { neon } from "@neondatabase/serverless";
import { rows } from "./data.mjs";
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', assignee TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'Medium', status TEXT NOT NULL DEFAULT 'Pending', due_date DATE, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
if (process.argv.includes("--replace")) await sql`TRUNCATE tasks RESTART IDENTITY`;
for (const [, title, category, status, priority, description] of rows)
  await sql`INSERT INTO tasks (title, description, category, priority, status) VALUES (${title}, ${description}, ${category}, ${priority}, ${status})`;
console.log(`Seeded ${rows.length} tasks`);
