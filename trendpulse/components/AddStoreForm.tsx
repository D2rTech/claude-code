"use client";
import { useFormState, useFormStatus } from "react-dom";
import { addStore } from "@/app/ingest-actions";

function Btn() { const { pending } = useFormStatus(); return <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Track store"}</button>; }

export default function AddStoreForm({ canAdd }: { canAdd: boolean }) {
  const [state, action] = useFormState(addStore, undefined);
  if (!canAdd) return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Tracking your own competitor stores is a Pro feature.</p>;
  return (
    <form action={action} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="flex-1"><label className="label" htmlFor="domain">Shopify store domain</label>
        <input id="domain" name="domain" required placeholder="allbirds.com" className="input" autoComplete="off" /></div>
      <div className="sm:w-48"><label className="label" htmlFor="niche">Niche (optional)</label>
        <input id="niche" name="niche" maxLength={60} placeholder="Footwear" className="input" /></div>
      <Btn />
      {state?.error && <p role="alert" className="text-sm text-red-600 sm:basis-full">{state.error}</p>}
    </form>
  );
}
