import type { Kind, Req } from "@/lib/service";
import { KIND_LABEL, fmtAge } from "@/lib/service";
import { attendRequest, cancelRequest, closeRequest } from "@/app/service-actions";

export type Mode = "public" | "fm" | "technician" | Kind; // who is looking

const ICON: Record<Kind, string> = { electrician: "⚡", plumber: "🚰" };
const pill: Record<string, string> = {
  Open: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Closed: "bg-emerald-100 text-emerald-800",
};
const btn = "rounded-lg px-4 py-2 text-sm font-semibold text-white";

function Row({ r, pos, mode }: { r: Req; pos?: number; mode: Mode }) {
  const canWork = mode === r.kind || mode === "technician"; // electrician/plumber looking at their own queue
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white p-3">
      <div className="w-8 shrink-0 text-center text-sm font-semibold text-slate-400">{pos ? `#${pos}` : "✓"}</div>
      <div className="min-w-0 flex-1 basis-32">
        <div className="text-lg font-bold tracking-wide">{r.flat}</div>
        <div className="text-xs text-slate-500">
          Raised {r.created}
          {r.status === "Open" && ` · waiting ${fmtAge(r.age_min)}`}
          {r.status === "In Progress" && r.attended && ` · attended ${r.attended}`}
          {r.status === "Closed" && r.closed && ` · closed ${r.closed}`}
        </div>
        {r.who && (
          <div className="text-xs text-slate-600">🏠 {r.who}{r.mobile && <> · <a href={`tel:${r.mobile}`} className="underline">{r.mobile}</a></>}</div>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${pill[r.status]}`}>{r.status === "Open" ? "Open" : r.status}</span>
      <div className="flex w-full gap-2 empty:hidden sm:w-auto">
      {canWork && r.status === "Open" && (
        <form className="flex-1 sm:flex-none" action={attendRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-blue-600`}>Attend</button></form>
      )}
      {canWork && r.status === "In Progress" && (
        <form className="flex-1 sm:flex-none" action={closeRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-emerald-600`}>Close</button></form>
      )}
      {(mode === "fm" || (canWork && r.mine)) && r.status === "Open" && (
        <form className="flex-1 sm:flex-none" action={cancelRequest}><input type="hidden" name="id" value={r.id} />
          <button className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600" title="Cancel this request (raised by mistake)">Cancel</button></form>
      )}
      </div>
    </li>
  );
}

export default function QueueSection({ kind, reqs, mode }: { kind: Kind; reqs: Req[]; mode: Mode }) {
  const mine = reqs.filter((r) => r.kind === kind);
  const prog = mine.filter((r) => r.status === "In Progress");
  const open = mine.filter((r) => r.status === "Open");
  const closed = mine.filter((r) => r.status === "Closed").reverse();
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>{ICON[kind]}</span> {KIND_LABEL[kind]}
        <span className="ml-auto text-xs font-normal text-slate-500">{open.length} waiting · {prog.length} in progress · {closed.length} closed today</span>
      </h2>
      {!prog.length && !open.length && <p className="rounded-xl border bg-white p-4 text-center text-sm text-slate-500">No pending requests 🎉</p>}
      {prog.length > 0 && (<><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">In progress</h3>
        <ul className="mb-4 space-y-2">{prog.map((r) => <Row key={r.id} r={r} mode={mode} />)}</ul></>)}
      {open.length > 0 && (<><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting — first come, first served</h3>
        <ul className="mb-4 space-y-2">{open.map((r, i) => <Row key={r.id} r={r} pos={i + 1} mode={mode} />)}</ul></>)}
      {closed.length > 0 && (<details className="text-sm"><summary className="cursor-pointer text-slate-500">Closed today ({closed.length})</summary>
        <ul className="mt-2 space-y-2">{closed.map((r) => <Row key={r.id} r={r} mode={mode} />)}</ul></details>)}
    </section>
  );
}
