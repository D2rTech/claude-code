import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import { PRO_PRICE_CENTS } from "@/lib/stripe";

const features = [
  { t: "Competitor tracking", d: "See any store's estimated traffic, revenue, top channels and catalog growth in one view.", i: "M3 3v18h18M7 14l4-4 3 3 5-6" },
  { t: "Trend radar", d: "Catch winning products early with momentum scores, saturation signals and a plain-English 'why it works'.", i: "M13 2L3 14h9l-1 8 10-12h-9z" },
  { t: "Ad spy library", d: "Browse the ads rivals keep running. Long-running creative is proven creative — copy the angle, not the ad.", i: "M4 6h16M4 12h16M4 18h10" },
  { t: "Know why it works", d: "Every winner is annotated: hook type, format, price anchor and audience angle.", i: "M12 2a7 7 0 00-4 12.7V18h8v-3.3A7 7 0 0012 2zM9 21h6" },
];
const demo = [8, 11, 10, 15, 19, 18, 26, 31, 38, 52, 61, 74];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-slate-50" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">Ecommerce intelligence for lean teams</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              Know what sells in ecommerce — <span className="text-brand-600">and why.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Track competitors, spot trending products before they saturate, and decode the ads that
              keep running. Make decisions with data, not hunches.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">Start free</Link>
              <Link href="#features" className="btn-ghost px-6 py-3 text-base">See how it works</Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">Free plan forever · Upgrade any time · Cancel in one click</p>
          </div>
          <div className="card p-5 shadow-xl" aria-hidden>
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-slate-500">Trending now</p><p className="font-semibold">Portable neck fan</p></div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">+212% / 30d</span>
            </div>
            <div className="mt-4"><Sparkline data={demo} w={460} h={140} color="#4f46e5" /></div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[["Score", "94"], ["Stores", "143"], ["Active ads", "87"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold">{v}</p><p className="text-xs text-slate-500">{k}</p></div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
              <b>Why it works:</b> hands-free cooling is visible in 3 seconds of video — ideal for short-form ads.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">Everything you need to out-research the competition</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">One lean dashboard instead of six browser tabs and a spreadsheet.</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={f.i} /></svg>
              </span>
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-900 py-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 text-center sm:grid-cols-3">
          {[["1", "Pick your niche", "Choose categories and competitors to follow."], ["2", "Spot the signal", "Momentum, saturation and ad longevity — scored."], ["3", "Act with confidence", "Launch, price and advertise with proof."]].map(([n, t, d]) => (
            <div key={n}><p className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/15 font-bold">{n}</p>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1 text-sm text-brand-100">{d}</p></div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">Simple pricing</h2>
        <p className="mt-3 text-center text-slate-600">Start free. Upgrade when you need the full picture.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-8">
            <h3 className="font-semibold">Free</h3>
            <p className="mt-3 text-4xl font-extrabold">$0</p>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              {["Top 3 competitors", "Top 3 trending products", "Ad library preview", "Community support"].map((x) => <li key={x}>✓ {x}</li>)}
            </ul>
            <Link href="/signup" className="btn-ghost mt-8 w-full">Get started</Link>
          </div>
          <div className="card relative border-brand-500 p-8 ring-2 ring-brand-500">
            <span className="absolute -top-3 right-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
            <h3 className="font-semibold">Pro</h3>
            <p className="mt-3 text-4xl font-extrabold">${PRO_PRICE_CENTS / 100}<span className="text-base font-medium text-slate-500">/mo</span></p>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              {["Unlimited competitors & trends", "Full ad library with filters", "“Why it works” insights", "Revenue & traffic estimates", "Priority support"].map((x) => <li key={x}>✓ {x}</li>)}
            </ul>
            <Link href="/signup?next=/dashboard/billing" className="btn-primary mt-8 w-full">Go Pro</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-3">
          {[["Where does the data come from?", "This MVP ships with realistic demo data. Plug in your own sources (scrapers, third-party APIs) by writing to the competitors, trends and ads tables."],
            ["Can I cancel any time?", "Yes — manage or cancel from the billing page via the Stripe customer portal."],
            ["Is there a storefront too?", "Yes. The built-in shop has a catalog, cart, Stripe checkout, orders, inventory and an admin."]].map(([q, a]) => (
            <details key={q} className="card p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-slate-600">{a}</p></details>
          ))}
        </div>
      </section>
    </>
  );
}
