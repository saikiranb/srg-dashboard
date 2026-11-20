# Apartment Task Tracker

Public page `/` shows all tasks (filter by status/category, search). `/admin` (password) lets the admin add, edit, delete, change status, and import from Excel.

## Deploy on Vercel
1. `npm i -g vercel@latest && vercel login`
2. `vercel link` (from this folder), then add a Neon Postgres database: Vercel dashboard → Storage / Marketplace → Neon → connect to the project (sets `DATABASE_URL`).
3. Set env vars: `vercel env add ADMIN_PASSWORD` and `vercel env add AUTH_SECRET` (any long random string), for Production.
4. `vercel --prod`

The `tasks` table is created automatically on first load.

## Local
`vercel env pull .env.local && npm run dev`
