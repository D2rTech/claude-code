"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { FormState } from "@/app/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? "Please wait…" : label}</button>;
}

export default function AuthForm({ mode, action, next }: { mode: "login" | "signup";
  action: (s: FormState, fd: FormData) => Promise<FormState>; next: string }) {
  const [state, formAction] = useFormState(action, undefined);
  const login = mode === "login";
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="card p-6">
        <h1 className="text-xl font-bold">{login ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-500">{login ? "Log in to your dashboard." : "Free plan, no credit card needed."}</p>
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div><label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="input"
              autoComplete={login ? "current-password" : "new-password"} /></div>
          {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <Submit label={login ? "Log in" : "Sign up"} />
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">
        {login ? <>New here? <Link className="font-medium text-brand-600" href="/signup">Create an account</Link></>
          : <>Have an account? <Link className="font-medium text-brand-600" href="/login">Log in</Link></>}
      </p>
    </div>
  );
}
