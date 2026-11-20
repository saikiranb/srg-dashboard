"use client";
import { useActionState } from "react";
import { residentLoginAction } from "@/app/resident-actions";

export default function ResidentLogin() {
  const [state, action, pending] = useActionState(residentLoginAction, null);
  return (
    <form action={action} className="mx-auto max-w-sm space-y-3 rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Raise a service request</h2>
      <p className="text-sm text-slate-600">Enter the mobile number registered with the society to continue.</p>
      <input name="mobile" required inputMode="numeric" autoComplete="tel" maxLength={16} placeholder="Your mobile number" className="w-full rounded-lg border px-3 py-3 text-lg" />
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white">{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}
