"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="max-w-sm mx-auto rounded-xl border bg-white p-6 space-y-3">
      <h1 className="font-semibold text-lg">Admin login</h1>
      <input type="password" name="password" required maxLength={200} autoComplete="current-password" placeholder="Password" className="rounded-lg border px-3 py-2 w-full" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded-lg bg-slate-900 text-white px-4 py-2 w-full">Sign in</button>
    </form>
  );
}
