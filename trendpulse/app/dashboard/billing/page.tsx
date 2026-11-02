import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/analytics";
import { manageBilling, subscribePro } from "@/app/actions";
import { PRO_PRICE_CENTS, stripe } from "@/lib/stripe";
import { setPlan } from "@/lib/billing";
import { Badge } from "@/components/Paywall";

export const metadata = { title: "Billing" };

export default async function Billing({ searchParams }: { searchParams: { session_id?: string; upgraded?: string; demo?: string } }) {
  let user = await requireUser("/dashboard/billing");
  const s = stripe();
  // Return from Stripe Checkout: verify the session directly so the plan updates even before the webhook arrives.
  if (s && searchParams.session_id?.startsWith("cs_")) {
    try {
      const cs = await s.checkout.sessions.retrieve(searchParams.session_id);
      if (cs.status === "complete" && cs.metadata?.kind === "subscription" && Number(cs.metadata.user_id) === user.id) {
        setPlan(user.id, "pro", cs.customer as string, cs.subscription as string);
        user = (await requireUser("/dashboard/billing"));
      }
    } catch { /* ignore; webhook will reconcile */ }
  }
  const pro = isPro(user);
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Billing</h1>
      {!s && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Demo mode: Stripe keys are not set, so upgrades are simulated. See the README to enable Stripe test mode.</p>}
      {pro && searchParams.session_id && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">You’re on Pro. Thanks!</p>}
      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Current plan</h2><Badge tone={pro ? "indigo" : "slate"}>{pro ? "Pro" : "Free"}</Badge></div>
        {user.role === "admin" && <p className="mt-2 text-sm text-slate-500">Admins always have Pro access.</p>}
        {pro ? (
          <form action={manageBilling} className="mt-4"><button className="btn-ghost">{s ? "Manage subscription" : "Downgrade (demo)"}</button></form>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">Pro unlocks unlimited competitors, trends, the full ad library and “why it works” insights.</p>
            <p className="mt-3 text-3xl font-extrabold">${PRO_PRICE_CENTS / 100}<span className="text-base font-medium text-slate-500">/month</span></p>
            <form action={subscribePro} className="mt-4"><button className="btn-primary">Upgrade to Pro</button></form>
            {s && <p className="mt-3 text-xs text-slate-400">Test mode: use card 4242 4242 4242 4242, any future date, any CVC.</p>}
          </>)}
      </div>
    </div>
  );
}
