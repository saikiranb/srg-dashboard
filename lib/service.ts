import { unstable_cache } from "next/cache";
import { ensureTable, sql } from "@/lib/db";

export type Kind = "electrician" | "plumber";
export type Req = {
  id: number; flat: string; kind: Kind; status: "Open" | "Acknowledged" | "In Progress" | "Closed";
  created: string; acked: string | null; attended: string | null; closed: string | null; age_min: number; mine: boolean; who: string | null; mobile: string | null; source: string;
};
const TZ = "Asia/Kolkata";
export const KIND_LABEL: Record<Kind, string> = { electrician: "Electrician", plumber: "Plumber" };

// Active requests (oldest first = first come, first served) + requests closed today (IST)
type RawReq = Omit<Req, "mine" | "who" | "mobile"> & { created_by: number | null; raised_by_name: string | null; raised_by_mobile: string | null };
const getQueueRaw = unstable_cache(async (): Promise<RawReq[]> => {
  await ensureTable();
  const rows = await sql()`SELECT id, flat, kind, status,
      to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM') AS created,
      to_char(acknowledged_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS acked,
      to_char(attended_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS attended,
      to_char(closed_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS closed,
      floor(extract(epoch from (now() - created_at)) / 60)::int AS age_min,
      created_by, raised_by_name, raised_by_mobile, source
    FROM service_requests
    WHERE status IN ('Open','Acknowledged','In Progress')
       OR (status = 'Closed' AND closed_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'))
    ORDER BY created_at, id`;
  return rows as RawReq[];
}, ["queue-v1"], { tags: ["queue"], revalidate: 10 });

// Personal fields are added per viewer outside the shared cache and never reach the public page:
//  - `mine`: this staff member / resident raised it
//  - `who`/`mobile`: name + number of the resident who raised it (staff viewers only)
export type Viewer = { staffId?: number; mobile?: string; showWho?: boolean };
export async function getQueue(v: Viewer = {}): Promise<Req[]> {
  return (await getQueueRaw()).map(({ created_by, raised_by_name, raised_by_mobile, ...r }) => ({
    ...r,
    mine: (v.staffId != null && created_by === v.staffId) || (v.mobile != null && raised_by_mobile === v.mobile),
    who: v.showWho ? raised_by_name : null,
    mobile: v.showWho ? raised_by_mobile : null,
  }));
}

export const fmtAge = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`);

export async function getAnalytics() {
  await ensureTable();
  const q = sql();
  const perDay = await q`SELECT to_char(d, 'YYYY-MM-DD') AS day, to_char(d, 'DD Mon') AS label,
      coalesce(sum((r.kind='electrician')::int), 0)::int AS electrician,
      coalesce(sum((r.kind='plumber')::int), 0)::int AS plumber
    FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 29, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') AS d
    LEFT JOIN service_requests r ON (r.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date AND r.status <> 'Cancelled'
    GROUP BY d ORDER BY d`;
  const [today] = await q`SELECT
      count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS raised,
      count(*) FILTER (WHERE status='Open')::int AS open,
      count(*) FILTER (WHERE status='Acknowledged')::int AS acknowledged,
      count(*) FILTER (WHERE status='In Progress')::int AS in_progress,
      count(*) FILTER (WHERE status='Closed' AND (closed_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS closed_today
    FROM service_requests WHERE status <> 'Cancelled'`;
  const times = await q`SELECT kind, count(*)::int AS total,
      round(avg(extract(epoch from (acknowledged_at - created_at)) / 60))::int AS avg_ack_min,
      round(avg(extract(epoch from (attended_at - created_at)) / 60))::int AS avg_response_min,
      round(avg(extract(epoch from (closed_at - created_at)) / 60))::int AS avg_resolution_min
    FROM service_requests WHERE status <> 'Cancelled' AND created_at > now() - interval '30 days' GROUP BY kind ORDER BY kind`;
  const byBlock = await q`SELECT split_part(flat, '-', 1) AS block, count(*)::int AS n
    FROM service_requests WHERE status <> 'Cancelled' AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`;
  const topFlats = await q`SELECT flat, count(*)::int AS n FROM service_requests
    WHERE status <> 'Cancelled' AND created_at > now() - interval '30 days' GROUP BY flat ORDER BY n DESC, flat LIMIT 5`;
  return {
    perDay: perDay as { day: string; label: string; electrician: number; plumber: number }[],
    today: today as { raised: number; open: number; acknowledged: number; in_progress: number; closed_today: number },
    times: times as { kind: Kind; total: number; avg_ack_min: number | null; avg_response_min: number | null; avg_resolution_min: number | null }[],
    byBlock: byBlock as { block: string; n: number }[],
    topFlats: topFlats as { flat: string; n: number }[],
  };
}

export type StaffRow = { id: number; name: string; mobile: string; role: string; active: boolean };
export async function getStaffList(): Promise<StaffRow[]> {
  await ensureTable();
  return (await sql()`SELECT id, name, mobile, role, active FROM staff_users ORDER BY role, name`) as StaffRow[];
}
export { TZ };

export type ActiveSession = { id: string; name: string; mobile: string; role: string; device: string; signed_in: string; idle_min: number };
// "Logged in now" = not signed out, token not expired (12h) and seen in the last 15 minutes
export async function getActiveSessions(): Promise<ActiveSession[]> {
  await ensureTable();
  return (await sql()`SELECT s.id::text AS id, u.name, u.mobile, u.role, s.device,
      to_char(s.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM') AS signed_in,
      floor(extract(epoch from (now() - s.last_seen)) / 60)::int AS idle_min
    FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id
    WHERE s.revoked_at IS NULL AND s.created_at > now() - interval '12 hours' AND s.last_seen > now() - interval '15 minutes'
    ORDER BY u.role, s.created_at`) as ActiveSession[];
}
