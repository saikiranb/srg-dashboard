"use client";
import { useActionState, useState } from "react";
import { raiseResidentRequest } from "@/app/resident-actions";

export default function ResidentRaise({ flats }: { flats: string[] }) {
  const [state, action, pending] = useActionState(raiseResidentRequest, null);
  const [flat, setFlat] = useState(flats[0]);
  return (
    <form action={action} className="rounded-2xl border bg-white p-4">
      <input type="hidden" name="flat" value={flat} />
      {flats.length > 1 ? (
        <label className="mb-3 block text-sm font-medium">Which flat?
          <select value={flat} onChange={(e) => setFlat(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-base">
            {flats.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
      ) : (
        <p className="mb-3 text-sm text-slate-600">Request for flat <b>{flat}</b></p>
      )}
      <p className="mb-2 text-sm font-medium">Who do you need?</p>
      <div className="grid grid-cols-2 gap-3">
        <button name="kind" value="electrician" disabled={pending} className="rounded-2xl bg-amber-500 p-5 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50">⚡ Electrician</button>
        <button name="kind" value="plumber" disabled={pending} className="rounded-2xl bg-blue-600 p-5 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50">🚰 Plumber</button>
      </div>
      {pending && <p className="mt-3 text-sm text-slate-500">Sending…</p>}
      {state && "error" in state && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state && "ok" in state && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{state.ok}</p>}
    </form>
  );
}
