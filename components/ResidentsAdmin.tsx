"use client";
import { useActionState, useMemo, useState } from "react";
import { addResident, deleteResident, importResidents } from "@/app/resident-admin-actions";

export type ResidentRow = { id: number; name: string; mobile: string; flat: string };
const inp = "w-full rounded-lg border bg-white px-3 py-2";

export default function ResidentsAdmin({ residents }: { residents: ResidentRow[] }) {
  const [imp, impAction, impPending] = useActionState(importResidents, null);
  const [add, addAction, addPending] = useActionState(addResident, null);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? residents.filter((r) => (r.name + r.mobile + r.flat).toLowerCase().includes(t)) : residents).slice(0, 200);
  }, [q, residents]);
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-1 font-semibold">Import from Excel</h2>
        <p className="mb-3 text-xs text-slate-500">Columns: <b>Name, Mobile, Flat Number, Block</b> (e.g. Ravi Kumar · 9876543210 · 4G · B). Existing numbers are updated.
          {" "}<a href="/residents-template.xlsx" className="underline">Download template</a></p>
        <form action={impAction} className="flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".xlsx" />
          <label className="text-sm"><input type="checkbox" name="replace" /> Replace the whole list</label>
          <button disabled={impPending} className="rounded-lg bg-slate-900 px-4 py-2 text-white">{impPending ? "Importing…" : "Import"}</button>
        </form>
        {imp && "ok" in imp && <p className="mt-2 text-sm text-emerald-700">{imp.ok}</p>}
        {imp && "error" in imp && <p className="mt-2 text-sm text-red-600">{imp.error}</p>}
        {imp && "problems" in imp && imp.problems && imp.problems.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">{imp.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Add one resident</h2>
        <form action={addAction} className="grid gap-2 sm:grid-cols-4">
          <input name="name" required maxLength={80} placeholder="Name" className={`${inp} sm:col-span-2`} />
          <input name="mobile" required inputMode="numeric" maxLength={16} placeholder="Mobile" className={inp} />
          <div className="flex gap-2">
            <input name="block" required maxLength={3} placeholder="Block" className={inp} />
            <input name="flat" required maxLength={6} placeholder="Flat" className={inp} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-4">
            <button disabled={addPending} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Save</button>
            {add && "ok" in add && <span className="text-sm text-emerald-700">{add.ok}</span>}
            {add && "error" in add && <span className="text-sm text-red-600">{add.error}</span>}
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-semibold">Residents ({residents.length})</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, flat…" className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm" />
        </div>
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border bg-white p-3 text-sm">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.mobile}</div></div>
              <span className="rounded bg-slate-100 px-2 py-1 font-semibold">{r.flat}</span>
              <form action={deleteResident}><input type="hidden" name="id" value={r.id} /><button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600">Remove</button></form>
            </li>
          ))}
          {!shown.length && <li className="text-sm text-slate-500">No residents found.</li>}
        </ul>
        {residents.length > shown.length && !q && <p className="mt-2 text-xs text-slate-500">Showing first 200 — use search to find others.</p>}
      </section>
    </div>
  );
}
