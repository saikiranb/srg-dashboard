"use client";
import { useActionState, useEffect, useState } from "react";
import { endCommonWork, startCommonWork } from "@/app/service-actions";
import type { Engagement } from "@/lib/service";

type Kind = "electrician" | "plumber";
const PRESETS: Record<Kind, string[]> = {
  plumber: ["Main pipeline repair", "Water leakage in society pipeline", "Overhead / sump tank", "STP / WTP work", "Drainage blockage"],
  electrician: ["Generator (DG) work", "Power transformer", "HT / LT panel", "Common area lighting", "Lift / motor / pump"],
};

function Card({ kind, current }: { kind: Kind; current?: Engagement }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(current?.note ?? "");
  const [state, action, pending] = useActionState(startCommonWork, null);
  useEffect(() => { if (state && "ok" in state) setEditing(false); }, [state]);
  const label = kind === "electrician" ? "⚡ Electrician" : "🚰 Plumber";

  return (
    <div className={`rounded-xl border p-3 ${current ? "border-orange-300 bg-orange-50" : "bg-white"}`}>
      <div className="flex items-center gap-2">
        <b className="flex-1">{label}</b>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${current ? "bg-orange-200 text-orange-900" : "bg-emerald-100 text-emerald-800"}`}>
          {current ? "On society work" : "Available"}
        </span>
      </div>
      {current && !editing && (
        <div className="mt-1 text-sm">
          {current.note}
          <div className="text-xs text-slate-600">Since {current.since}{current.until && ` · expected free by ${current.until}`}</div>
        </div>
      )}
      {!editing ? (
        <div className="mt-2 flex gap-2">
          {current && (
            <form action={endCommonWork} className="flex-1"><input type="hidden" name="kind" value={kind} />
              <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Mark available</button></form>
          )}
          <button onClick={() => { setNote(current?.note ?? ""); setEditing(true); }} className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold">
            {current ? "Edit" : "Mark busy with society work"}
          </button>
        </div>
      ) : (
        <form action={action} className="mt-2 space-y-2">
          <input type="hidden" name="kind" value={kind} />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS[kind].map((p) => (
              <button type="button" key={p} onClick={() => setNote(p)}
                className={`rounded-full border px-2.5 py-1 text-xs ${note === p ? "bg-slate-900 text-white" : "bg-white"}`}>{p}</button>
            ))}
          </div>
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} required maxLength={120}
            placeholder="What work? e.g. Main pipeline leakage near B block" className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-xs text-slate-600">Expected free by (optional)
            <input type="time" name="until" className="rounded-lg border bg-white px-2 py-1 text-sm" /></label>
          {state && "error" in state && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
          <div className="flex gap-2">
            <button disabled={pending} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function CommonWorkPanel({ engagements }: { engagements: Engagement[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 font-bold">Society common work</h2>
      <p className="mb-3 text-xs text-slate-500">Mark the electrician or plumber as busy (main pipeline, leakage, DG, transformer…). Residents see this on their screens.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card kind="electrician" current={engagements.find((e) => e.kind === "electrician")} />
        <Card kind="plumber" current={engagements.find((e) => e.kind === "plumber")} />
      </div>
    </section>
  );
}
