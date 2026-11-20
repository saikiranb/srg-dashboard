import { revokeSession } from "@/app/actions";
import type { ActiveSession } from "@/lib/service";

const LABEL: Record<string, string> = { fm: "Facility Manager", electrician: "Electrician", plumber: "Plumber", technician: "Electrician / Plumber" };
const MAX_FM = 1, MAX_STAFF = 2; // alert thresholds

export default function AdminSessions({ sessions }: { sessions: ActiveSession[] }) {
  const fm = sessions.filter((s) => s.role === "fm");
  const staff = sessions.filter((s) => s.role !== "fm");
  const alerts = [
    fm.length > MAX_FM && `${fm.length} Facility Manager sessions are active (expected ${MAX_FM}).`,
    staff.length > MAX_STAFF && `${staff.length} electrician/plumber sessions are active (expected at most ${MAX_STAFF}).`,
  ].filter(Boolean) as string[];
  const chip = (n: number, max: number, label: string) => (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${n > max ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>{label}: {n} / {max}</span>
  );
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-1 font-semibold">Who is logged in now</h2>
      <p className="mb-3 text-xs text-slate-500">Each phone/browser that is signed in counts once. Active = used in the last 15 minutes. Refreshes every 30 seconds.</p>
      <div className="mb-3 flex flex-wrap gap-2">{chip(fm.length, MAX_FM, "FM")}{chip(staff.length, MAX_STAFF, "Electrician/Plumber")}</div>
      {alerts.map((a) => <p key={a} role="alert" className="mb-2 rounded-lg bg-red-50 p-2 text-sm font-medium text-red-700">⚠ {a} A login may be shared — sign out the extra device(s) below.</p>)}
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1 basis-40">
              <div className="font-medium">{s.name} <span className="text-xs font-normal text-slate-500">· {LABEL[s.role]} · {s.mobile}</span></div>
              <div className="text-xs text-slate-500">{s.device} · signed in {s.signed_in} · {s.idle_min < 1 ? "active now" : `last active ${s.idle_min} min ago`}</div>
            </div>
            <form action={revokeSession}><input type="hidden" name="id" value={s.id} /><button className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600">Sign out</button></form>
          </li>
        ))}
        {!sessions.length && <li className="text-sm text-slate-500">Nobody is logged in right now.</li>}
      </ul>
    </section>
  );
}
