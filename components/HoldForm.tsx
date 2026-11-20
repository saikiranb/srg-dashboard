"use client";
import { useActionState, useEffect, useState } from "react";
import { holdRequest } from "@/app/service-actions";

const OPTIONS = [
  { v: "material", label: "Material needed", hint: "e.g. White cement 1 kg, 6A switch, 2 plugs" },
  { v: "unavailable", label: "Resident not available", hint: "Optional note" },
  { v: "other", label: "Other", hint: "Short reason" },
] as const;

// "Pause" a job: worker asks the resident to arrange material (or another reason).
export default function HoldForm({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof OPTIONS)[number]["v"]>("material");
  const [state, action, pending] = useActionState(holdRequest, null);
  useEffect(() => { if (state && "ok" in state) setOpen(false); }, [state]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold sm:w-auto">⏸ Pause</button>
  );
  return (
    <form action={action} className="w-full space-y-2 rounded-lg border bg-slate-50 p-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
        {OPTIONS.map((o) => (
          <label key={o.v} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${kind === o.v ? "bg-slate-900 text-white" : "bg-white"}`}>
            <input type="radio" name="hold_kind" value={o.v} checked={kind === o.v} onChange={() => setKind(o.v)} className="sr-only" />{o.label}
          </label>
        ))}
      </div>
      <textarea name="note" rows={2} maxLength={200} required={kind !== "unavailable"}
        placeholder={OPTIONS.find((o) => o.v === kind)!.hint} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
      {state && "error" in state && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{pending ? "Saving…" : "Pause job"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}
