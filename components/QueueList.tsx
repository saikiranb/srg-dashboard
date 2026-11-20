import type { Kind, Req } from "@/lib/service";
import { KIND_LABEL, fmtAge, getEngagements, getJobMinutes, planQueue } from "@/lib/service";
import { ROUTE, type Planned } from "@/lib/route";
import { acknowledgeRequest, attendRequest, cancelRequest, closeRequest, requeueRequest, resumeRequest } from "@/app/service-actions";
import HoldForm from "@/components/HoldForm";

export type Mode = "public" | "fm" | "technician" | Kind; // who is looking

const ICON: Record<Kind, string> = { electrician: "⚡", plumber: "🚰" };
const pill: Record<string, string> = {
  Open: "bg-amber-100 text-amber-800",
  Acknowledged: "bg-violet-100 text-violet-800",
  "In Progress": "bg-blue-100 text-blue-800",
  "On Hold": "bg-rose-100 text-rose-800",
  Closed: "bg-emerald-100 text-emerald-800",
};
const btn = "rounded-lg px-4 py-2 text-sm font-semibold text-white";

function Row({ r, pos, mode, plan, showEta }: { r: Req; pos?: number; mode: Mode; plan?: Planned<Req>; showEta?: boolean }) {
  const canWork = mode === r.kind || mode === "technician"; // electrician/plumber looking at their own queue
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white p-3">
      <div className={`w-8 shrink-0 text-center text-sm font-semibold ${pos === 1 ? "text-emerald-600" : "text-slate-400"}`}>{pos ? `#${pos}` : r.status === "On Hold" ? "⏸" : r.status === "In Progress" ? "🔧" : "✓"}</div>
      <div className="min-w-0 flex-1 basis-32">
        <div className="text-lg font-bold tracking-wide">{r.flat}</div>
        <div className="text-xs text-slate-500">
          Raised {r.created}
          {(r.status === "Open" || r.status === "Acknowledged") && ` · waiting ${fmtAge(r.age_min)}`}
          {r.status === "Acknowledged" && r.acked && ` · acknowledged ${r.acked}`}
          {r.status === "In Progress" && r.attended && ` · attended ${r.attended}`}
          {r.status === "Closed" && r.closed && ` · closed ${r.closed}`}
        </div>
        {plan && (
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            {pos === 1 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">Next</span>}
            <span className={`rounded-full px-2 py-0.5 font-medium ${plan.priority ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{plan.reason}</span>
            {showEta && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{plan.etaMin < 3 ? "starting soon" : `~${fmtAge(plan.etaMin)} to start`}</span>}
          </div>
        )}
        {r.status === "On Hold" && (
          <div className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-900">
            ⏸ {r.hold_kind === "material" ? "Waiting for material" : r.hold_kind === "unavailable" ? "Resident not available" : "On hold"}
            {r.hold_reason && mode !== "public" && <>: <b>{r.hold_reason}</b></>}
            {r.held && <span className="text-rose-700"> · since {r.held}</span>}
          </div>
        )}
        {r.resumed && <div className="mt-1 text-xs font-medium text-emerald-700">✅ Material ready — back in the queue</div>}
        {r.who && (
          <div className="text-xs text-slate-600">🏠 {r.who}{r.mobile && <> · <a href={`tel:${r.mobile}`} className="underline">{r.mobile}</a></>}</div>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${pill[r.status]}`}>{r.status === "Open" ? "Open" : r.status}</span>
      <div className="flex w-full gap-2 empty:hidden sm:w-auto">
      {(mode !== "public") && r.status === "Open" && (
        <form className="flex-1 sm:flex-none" action={acknowledgeRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-violet-600`}>Acknowledge</button></form>
      )}
      {canWork && (r.status === "Open" || r.status === "Acknowledged") && (
        <form className="flex-1 sm:flex-none" action={attendRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-blue-600`}>Attend</button></form>
      )}
      {canWork && r.status === "On Hold" && (
        <form className="flex-1 sm:flex-none" action={resumeRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-blue-600`}>Resume work</button></form>
      )}
      {(canWork || mode === "fm") && r.status === "On Hold" && (
        <form className="flex-1 sm:flex-none" action={requeueRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-emerald-600`}>Material ready</button></form>
      )}
      {canWork && r.status === "In Progress" && (
        <div className="w-full sm:w-auto"><HoldForm id={r.id} /></div>
      )}
      {canWork && r.status === "In Progress" && (
        <form className="flex-1 sm:flex-none" action={closeRequest}><input type="hidden" name="id" value={r.id} /><button className={`${btn} w-full bg-emerald-600`}>Close</button></form>
      )}
      {(mode === "fm" || (canWork && r.mine)) && (r.status === "Open" || r.status === "Acknowledged" || r.status === "On Hold") && (
        <form className="flex-1 sm:flex-none" action={cancelRequest}><input type="hidden" name="id" value={r.id} />
          <button className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600" title="Cancel this request (raised by mistake)">Cancel</button></form>
      )}
      </div>
    </li>
  );
}

export default async function QueueSection({ kind, reqs, mode }: { kind: Kind; reqs: Req[]; mode: Mode }) {
  const mine = reqs.filter((r) => r.kind === kind);
  const prog = mine.filter((r) => r.status === "In Progress");
  const held = mine.filter((r) => r.status === "On Hold");
  const closed = mine.filter((r) => r.status === "Closed").reverse();
  const [jobs, busy] = await Promise.all([getJobMinutes().catch(() => null), getEngagements().catch(() => [])]);
  const { plan, at } = planQueue(kind, reqs, jobs?.[kind] ?? ROUTE.DEFAULT_JOB_MIN);
  const onSocietyWork = busy.some((e) => e.kind === kind); // ETAs are meaningless while on common work
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>{ICON[kind]}</span> {KIND_LABEL[kind]}
        <span className="ml-auto text-xs font-normal text-slate-500">{plan.length} waiting · {prog.length} in progress{held.length ? ` · ${held.length} on hold` : ""} · {closed.length} closed today</span>
      </h2>
      {!prog.length && !plan.length && !held.length && <p className="rounded-xl border bg-white p-4 text-center text-sm text-slate-500">No pending requests 🎉</p>}
      {prog.length > 0 && (<><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">In progress</h3>
        <ul className="mb-4 space-y-2">{prog.map((r) => <Row key={r.id} r={r} mode={mode} />)}</ul></>)}
      {held.length > 0 && (<><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">On hold</h3>
        <ul className="mb-4 space-y-2">{held.map((r) => <Row key={r.id} r={r} mode={mode} />)}</ul></>)}
      {plan.length > 0 && (<>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting — smart order</h3>
        <p className="mb-2 text-xs text-slate-500">
          {at ? <>📍 {KIND_LABEL[kind]} is at <b>{at}</b>. Nearby flats go first; </> : <>Oldest request first; </>}
          nobody waits more than {ROUTE.MAX_WAIT_MIN / 60} hours because of this order.
        </p>
        <ul className="mb-4 space-y-2">{plan.map((p) => <Row key={p.item.id} r={p.item} pos={p.position} mode={mode} plan={p} showEta={!onSocietyWork} />)}</ul></>)}
      {closed.length > 0 && (<details className="text-sm"><summary className="cursor-pointer text-slate-500">Closed today ({closed.length})</summary>
        <ul className="mt-2 space-y-2">{closed.map((r) => <Row key={r.id} r={r} mode={mode} />)}</ul></details>)}
    </section>
  );
}
