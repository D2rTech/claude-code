import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeAds, storeEvents, storeIsViewable, storeJobState, storeProducts } from "@/lib/stores";
import { ASSUMPTIONS, latestEstimate } from "@/lib/ingest/estimates";
import { adsEnabled, adCountries } from "@/lib/ingest/ads";
import { isPro } from "@/lib/analytics";
import { setVisits } from "@/app/ingest-actions";
import { usd } from "@/lib/format";
import { Badge } from "@/components/Paywall";
import { money } from "@/lib/format";
import { removeStore } from "@/app/ingest-actions";

export const dynamic = "force-dynamic";

const LABEL: Record<string, [string, "green" | "red" | "amber" | "indigo" | "slate"]> = {
  new: ["New product", "green"], price_change: ["Price change", "indigo"], sold_out: ["Sold out", "amber"],
  restocked: ["Restocked", "green"], removed: ["Removed", "red"], relisted: ["Relisted", "slate"] };

export default async function StorePage({ params }: { params: { id: string } }) {
  const user = await requireUser("/dashboard/stores");
  const id = Number(params.id);
  const s = db().prepare("SELECT id,domain,name,niche,baselined,product_count,last_synced_at,last_error FROM stores WHERE id=?").get(id) as
    { id: number; domain: string; name: string; niche: string; baselined: number; product_count: number; last_synced_at: string | null; last_error: string | null } | undefined;
  if (!s) notFound();
  if (!storeIsViewable(user, id)) redirect("/dashboard/billing");
  const events = storeEvents(id), products = storeProducts(id);
  const pro = isPro(user);
  const st = storeJobState(id), est = pro ? latestEstimate(id) : undefined, ads = pro ? storeAds(id) : [];
  const owner = db().prepare("SELECT added_by FROM stores WHERE id=?").get(id) as { added_by: number | null };
  const canEditVisits = pro && (user.role === "admin" || owner.added_by === user.id);
  const days = (a: { started_at: string | null; stopped_at: string | null }) => a.started_at ? Math.max(0, Math.round(((a.stopped_at ? Date.parse(a.stopped_at) : Date.now()) - Date.parse(a.started_at)) / 86400000)) : 0;
  const link = (handle: string) => `https://${s.domain}/products/${encodeURIComponent(handle)}`;
  return (
    <div>
      <Link href="/dashboard/stores" className="text-sm text-brand-600">← All stores</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-slate-500"><a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{s.domain}</a> · {s.product_count} products{s.niche && ` · ${s.niche}`}</p></div>
        {user.role === "admin" && <form action={removeStore}><input type="hidden" name="storeId" value={s.id} /><button className="btn-ghost text-red-600">Stop tracking</button></form>}
      </div>
      {s.last_error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Last sync failed: {s.last_error}</p>}
      <h2 className="mt-8 font-semibold">Changes · last 30 days</h2>
      {events.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{s.baselined ? "No changes detected yet." : "First sync pending."}{" "}
          {s.baselined && "Baseline captured — new products and price changes show up after the next sync."}</p>
      ) : (
        <ul className="card mt-3 divide-y divide-slate-100">
          {events.map((e) => { const [label, tone] = LABEL[e.type] ?? [e.type, "slate" as const]; return (
            <li key={e.id} className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.image ? <img src={e.image} alt="" loading="lazy" className="h-12 w-12 rounded-lg bg-slate-100 object-cover" /> : <div className="h-12 w-12 rounded-lg bg-slate-100" />}
              <div className="min-w-0 flex-1"><a href={link(e.handle)} target="_blank" rel="noopener noreferrer nofollow" className="block truncate font-medium hover:underline">{e.title}</a>
                <p className="text-xs text-slate-400">{new Date(e.at).toLocaleDateString()}</p></div>
              <div className="text-right text-sm"><Badge tone={tone}>{label}</Badge>
                {e.type === "price_change" && e.old_cents != null && e.new_cents != null && <p className="mt-1 text-xs text-slate-500">{money(e.old_cents)} → <b className={e.new_cents < e.old_cents ? "text-emerald-600" : "text-red-600"}>{money(e.new_cents)}</b></p>}
                {e.type === "new" && e.new_cents != null && <p className="mt-1 text-xs text-slate-500">{money(e.new_cents)}</p>}</div>
            </li>); })}
        </ul>)}
      <h2 className="mt-8 font-semibold">Revenue estimate <Badge tone="amber">Estimate</Badge></h2>
      {!pro ? <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Revenue estimates are a Pro feature.</p> : (
        <div className="card mt-3 p-5">
          {est ? (
            <>
              <p className="text-3xl font-bold">{usd(est.rev_low)} – {usd(est.rev_high)}<span className="text-base font-medium text-slate-500"> / month</span></p>
              <p className="text-sm text-slate-500">Midpoint ≈ {usd(est.rev_mid)} · ~{est.orders_mid.toLocaleString()} orders · avg order ≈ {usd(est.aov_mid / 100)} · {est.visits.toLocaleString()} visits</p>
            </>) : <p className="text-sm text-slate-600">Enter this store’s monthly visits (e.g. from a traffic tool) to get an estimate.</p>}
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Model: visits × conversion ({ASSUMPTIONS.conversion.low * 100}–{ASSUMPTIONS.conversion.high * 100}%) × (median product price × {ASSUMPTIONS.itemsPerOrder.low}–{ASSUMPTIONS.itemsPerOrder.high} items).
            It is a rough range from stated assumptions, not a measurement{st?.visits_source === "manual" ? ", and the visit count was entered manually" : ""}. Real revenue can fall outside it.</p>
          {canEditVisits && (
            <form action={setVisits} className="mt-3 flex gap-2"><input type="hidden" name="storeId" value={s.id} />
              <input name="visits" inputMode="numeric" defaultValue={st?.monthly_visits ?? ""} placeholder="Monthly visits, e.g. 120000" className="input max-w-xs" aria-label="Monthly visits" />
              <button className="btn-ghost">Save</button></form>)}
        </div>)}
      <h2 className="mt-8 font-semibold">Ads (Meta Ad Library)</h2>
      {!pro ? <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Ad tracking is a Pro feature.</p>
        : !adsEnabled() ? <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Ad tracking isn’t enabled on this server (no Meta Ad Library token configured).</p>
        : st?.ads_error ? <p className="mt-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">Last ad sync failed: {st.ads_error}</p>
        : ads.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{st?.ads_synced_at ? `No ads mentioning ${s.domain} found. Meta’s library only exposes ads delivered in ${adCountries().join(", ")} (plus political ads), so many stores will show none.` : "Not synced yet."}</p>
        : (
        <ul className="card mt-3 divide-y divide-slate-100">
          {ads.map((a) => (
            <li key={a.ad_id} className="p-4"><div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={a.active ? "green" : "slate"}>{a.active ? "Active" : "Stopped"}</Badge>
              <Badge tone={days(a) >= 30 ? "indigo" : "slate"}>{days(a)}d {a.active ? "running" : "ran"}</Badge>
              {a.platforms && <span className="text-slate-400">{a.platforms.replaceAll(",", " · ")}</span>}</div>
              {a.title && <p className="mt-2 font-medium">{a.title}</p>}
              {a.body && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{a.body}</p>}
              {a.snapshot_url && <a href={a.snapshot_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-xs text-brand-600 hover:underline">View in Ad Library ↗</a>}</li>))}
        </ul>)}
      <h2 className="mt-8 font-semibold">Newest products</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {products.map((p) => (
          <a key={p.id} href={link(p.handle)} target="_blank" rel="noopener noreferrer nofollow" className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image ? <img src={p.image} alt={p.title} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" /> : <div className="aspect-square bg-slate-100" />}
            <div className="p-2 text-sm"><p className="truncate font-medium">{p.title}</p>
              <p className="text-xs text-slate-500">{money(p.price_cents)}{p.compare_at_cents && p.compare_at_cents > p.price_cents && <s className="ml-1 text-slate-400">{money(p.compare_at_cents)}</s>}{!p.available && <span className="ml-1 text-amber-600">sold out</span>}</p></div>
          </a>))}
      </div>
    </div>
  );
}
