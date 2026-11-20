"use client";
import { useActionState } from "react";
import { staffLoginAction } from "@/app/service-actions";

export default function StaffLogin() {
  const [state, action, pending] = useActionState(staffLoginAction, null);
  return (
    <form action={action} className="mx-auto max-w-sm space-y-3 rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Staff login</h2>
      <p className="text-xs text-slate-500">For the Facility Manager, Electrician and Plumber.</p>
      <input name="mobile" required inputMode="numeric" autoComplete="username" maxLength={14} placeholder="Mobile number" className="w-full rounded-lg border px-3 py-2" />
      <input type="password" name="password" required maxLength={200} autoComplete="current-password" placeholder="Password" className="w-full rounded-lg border px-3 py-2" />
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
