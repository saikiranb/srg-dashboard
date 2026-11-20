import { redirect } from "next/navigation";
import Link from "next/link";
import { getAnalytics, fmtAge, KIND_LABEL } from "@/lib/service";
import { getStaff } from "@/lib/staff";
import { isAdmin } from "@/lib/auth";
import SocietyHeader from "@/components/SocietyHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request analytics · Sri Ram Garden", robots: { index: false, follow: false } };

const EL = "#d97706", PL = "#2563eb"; // electrician amber, plumber blue (always labelled too)

export default async function Analytics() {
  const me = await getStaff();
  if (me?.role !== "fm" && !(await isAdmin())) redirect("/staff");
  const a = await getAnalytics();
  const max = Math.max(1, ...a.perDay.map((d) => d.electrician + d.plumber));
  const tot = a.perDay.reduce((s, d) => ({ e: s.e + d.electrician, p: s.p + d.plumber }), { e: 0, p: 0 });
  const card = (n: number, l: string) => (<div className="rounded-xl border bg-white p-4"><div className="text-2xl font-semibold">{n}</div><div className="text-sm text-slate-500">{l}</div></div>);

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-6">
      <SocietyHeader right={<Link href="/staff" className="underline text-slate-500">Back</Link>} />
      <h2 className="mb-4 text-center text-lg font-bold uppercase tracking-wide">Service request analytics</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {card(a.today.raised, "Raised today")}{card(a.today.open, "Open now")}{card(a.today.acknowledged, "Acknowledged")}{card(a.today.on_hold, "On hold")}{card(a.today.in_progress, "In progress now")}{card(a.today.closed_today, "Closed today")}
      </div>

      <section className="mb-6 rounded-xl border bg-white p-4">
        <h3 className="mb-1 font-semibold">Requests per day (last 30 days)</h3>
        <p className="mb-3 text-xs text-slate-500">
          <span style={{ color: EL }}>■</span> Electrician {tot.e} · <span style={{ color: PL }}>■</span> Plumber {tot.p}
        </p>
        <div role="img" aria-label={`Requests per day for the last 30 days. Electrician ${tot.e}, plumber ${tot.p}.`} className="flex h-40 items-end gap-[3px]">
          {a.perDay.map((d) => (
            <div key={d.day} title={`${d.label}: ${d.electrician} electrician, ${d.plumber} plumber`} className="flex h-full flex-1 flex-col justify-end">
              <div style={{ height: `${(d.plumber / max) * 100}%`, background: PL }} />
              <div style={{ height: `${(d.electrician / max) * 100}%`, background: EL }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{a.perDay[0]?.label}</span><span>{a.perDay.at(-1)?.label}</span></div>
      </section>

      <section className="mb-6 rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Response &amp; resolution time (last 30 days)</h3>
        <table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-1">Type</th><th>Requests</th><th>Avg. to acknowledge</th><th>Avg. to attend</th><th>Avg. to close</th></tr></thead>
          <tbody>{a.times.map((t) => (<tr key={t.kind} className="border-t"><td className="py-1.5">{KIND_LABEL[t.kind]}</td><td>{t.total}</td>
            <td>{t.avg_ack_min == null ? "–" : fmtAge(t.avg_ack_min)}</td><td>{t.avg_response_min == null ? "–" : fmtAge(t.avg_response_min)}</td><td>{t.avg_resolution_min == null ? "–" : fmtAge(t.avg_resolution_min)}</td></tr>))}
            {!a.times.length && <tr><td colSpan={5} className="py-3 text-slate-500">No data yet.</td></tr>}</tbody></table>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-white p-4"><h3 className="mb-2 font-semibold">By block (30 days)</h3>
          <ul className="text-sm">{a.byBlock.map((b) => <li key={b.block} className="flex justify-between border-t py-1.5"><span>Block {b.block}</span><b>{b.n}</b></li>)}
            {!a.byBlock.length && <li className="text-slate-500">No data yet.</li>}</ul></section>
        <section className="rounded-xl border bg-white p-4"><h3 className="mb-2 font-semibold">Most frequent flats (30 days)</h3>
          <ul className="text-sm">{a.topFlats.map((f) => <li key={f.flat} className="flex justify-between border-t py-1.5"><span>{f.flat}</span><b>{f.n}</b></li>)}
            {!a.topFlats.length && <li className="text-slate-500">No data yet.</li>}</ul></section>
      </div>
    </main>
  );
}
