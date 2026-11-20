"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { raiseRequests } from "@/app/service-actions";
import { parseFlats, LAYOUT_HINT } from "@/lib/flats";

type Kind = "electrician" | "plumber";

export default function RaiseRequest({ allowed }: { allowed: Kind[] }) {
  const [kind, setKind] = useState<Kind | null>(allowed.length === 1 ? allowed[0] : null);
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(raiseRequests, null);
  const parsed = useMemo(() => parseFlats(text), [text]);
  useEffect(() => { if (state && "ok" in state) setText(""); }, [state]);

  const big = (k: Kind, label: string, cls: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
      className={`rounded-2xl p-5 text-lg font-bold text-white shadow ${cls} ${kind === k ? "ring-4 ring-slate-900" : "opacity-90"}`}>{label}</button>
  );
  return (
    <section className="mb-8 rounded-2xl border bg-white p-4">
      <h2 className="mb-3 font-bold">Raise a service request</h2>
      {allowed.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          {big("electrician", "⚡ Electrician", "bg-amber-500")}
          {big("plumber", "🚰 Plumber", "bg-blue-600")}
        </div>
      )}
      {kind && (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <label className="block text-sm font-medium">Flat numbers for the <b>{kind}</b>
            <textarea name="flats" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} autoFocus
              placeholder="e.g. b4g a10i bgg   (B-4G, A-10I, B-Ground-G)" className="mt-1 w-full rounded-lg border px-3 py-2 text-base uppercase" />
          </label>
          <p className="text-xs text-slate-500">Block + floor + flat letter, any style: <b>b4g</b>, <b>B 4 G</b>, <b>a6 i</b>, <b>A-6-I</b> · <b>bgg</b> = B block ground floor GG. Separate flats with a comma, space or new line. <span className="whitespace-nowrap">{LAYOUT_HINT}.</span></p>
          {(parsed.flats.length > 0 || parsed.invalid.length > 0) && (
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {parsed.flats.map((f) => <span key={f.code} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">{f.code}</span>)}
              {parsed.invalid.map((t, i) => <span key={i} className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">{t}?</span>)}
            </div>
          )}
          {state && "error" in state && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
          {state && "ok" in state && <p className="text-sm text-emerald-700">{state.ok}</p>}
          <button disabled={pending || !parsed.flats.length || parsed.invalid.length > 0} className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40">
            {pending ? "Adding…" : `Add ${parsed.flats.length || ""} to ${kind} queue`}
          </button>
        </form>
      )}
    </section>
  );
}
