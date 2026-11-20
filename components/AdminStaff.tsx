"use client";
import { useActionState } from "react";
import { addStaff, resetStaffPassword, setStaffActive } from "@/app/actions";
import type { StaffRow } from "@/lib/service";

const inp = "rounded-lg border px-3 py-2 bg-white w-full";
const ROLE = { fm: "Facility Manager", electrician: "Electrician", plumber: "Plumber" } as Record<string, string>;

function Reset({ id }: { id: number }) {
  const [s, a, p] = useActionState(resetStaffPassword, null);
  return (
    <form action={a} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="password" name="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="New password (min 8)" className="rounded-lg border px-2 py-1.5 text-sm" />
      <button disabled={p} className="rounded-lg border px-3 py-1.5 text-sm">Reset password</button>
      {s && "ok" in s && <span className="text-xs text-emerald-700">{s.ok}</span>}
      {s && "error" in s && <span className="text-xs text-red-600">{s.error}</span>}
    </form>
  );
}

export default function AdminStaff({ staff }: { staff: StaffRow[] }) {
  const [s, a, p] = useActionState(addStaff, null);
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-1 font-semibold">Staff logins (FM, Electrician, Plumber)</h2>
      <p className="mb-3 text-xs text-slate-500">Username is the 10-digit mobile number. Staff sign in at /staff.</p>
      <form action={a} className="grid gap-2 sm:grid-cols-2">
        <input name="name" required maxLength={80} placeholder="Full name" className={inp} />
        <input name="mobile" required inputMode="numeric" maxLength={14} placeholder="Mobile number (username)" className={inp} />
        <select name="role" required defaultValue="" className={inp}>
          <option value="" disabled>Role…</option>
          <option value="fm">Facility Manager</option><option value="electrician">Electrician</option><option value="plumber">Plumber</option>
        </select>
        <input type="password" name="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="Password (min 8 chars)" className={inp} />
        <div className="sm:col-span-2 flex items-center gap-3">
          <button disabled={p} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Add staff</button>
          {s && "ok" in s && <span className="text-sm text-emerald-700">{s.ok}</span>}
          {s && "error" in s && <span className="text-sm text-red-600">{s.error}</span>}
        </div>
      </form>
      <ul className="mt-4 space-y-3">
        {staff.map((u) => (
          <li key={u.id} className={`rounded-lg border p-3 ${u.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{ROLE[u.role]} · {u.mobile}{u.active ? "" : " · DISABLED"}</div></div>
              <form action={setStaffActive}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.active ? "0" : "1"} />
                <button className="rounded-lg border px-3 py-1.5 text-sm">{u.active ? "Disable" : "Enable"}</button></form>
            </div>
            <Reset id={u.id} />
          </li>
        ))}
        {!staff.length && <li className="text-sm text-slate-500">No staff yet.</li>}
      </ul>
    </section>
  );
}
