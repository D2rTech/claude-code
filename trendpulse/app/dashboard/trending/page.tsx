import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/analytics";
import { listCategoryTrends, listTrending, trendingComputedAt } from "@/lib/stores";
import { Badge, UpgradeBanner } from "@/components/Paywall";
import { money } from "@/lib/format";

export const metadata = { title: "Trending products" };
export const dynamic = "force-dynamic";

export default async function Trending() {
  const user = await requireUser("/dashboard/trending");
  const rows = listTrending(user), cats = listCategoryTrends(), at = trendingComputedAt();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Trending products</h1><Badge tone="green">Real data</Badge></div>
      <p className="text-sm text-slate-500">Scored daily from tracked stores: recent launches, sell-outs and restocks, similar products at several stores, and active ads. Every score lists its reasons.</p>
      {rows.length === 0 ? (
        <div className="card mt-6 p-6 text-sm text-slate-600">Nothing trending yet. Trends appear after tracked stores have been synced at least twice and show real changes.
          <Link href="/dashboard/stores" className="ml-1 text-brand-600">Add stores →</Link></div>) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => { const reasons = JSON.parse(r.reasons) as string[]; const delta = r.prev_score != null ? r.score - r.prev_score : null; return (
            <li key={r.product_id} className={`card flex gap-4 p-4 ${r.locked ? "select-none blur-[5px]" : ""}`} aria-hidden={r.locked}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.image ? <img src={r.image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl bg-slate-100 object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-100" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.locked ? r.title : <a href={`https://${r.domain}/products/${encodeURIComponent(r.handle)}`} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{r.title}</a>}</p>
                <p className="text-xs text-slate-400">{r.store_name} · {r.domain}{r.price_cents > 0 && ` · ${money(r.price_cents)}`}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{reasons.map((x) => <Badge key={x} tone="indigo">{x}</Badge>)}</div>
              </div>
              <div className="text-right"><p className="text-2xl font-extrabold text-brand-600">{r.score}</p>
                <p className="text-xs text-slate-400">momentum</p>
                {delta != null && delta !== 0 && <p className={`text-xs font-medium ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}</p>}</div>
            </li>); })}
        </ul>)}
      {!isPro(user) && rows.some((r) => r.locked) && <UpgradeBanner what="every trending product and its reasons" />}
      {cats.length > 0 && (
        <div className="card mt-8 p-5"><h2 className="font-semibold">Category momentum <span className="text-xs font-normal text-slate-400">launches in last 14 days vs the 14 before</span></h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">{cats.map((c) => (
            <li key={c.product_type} className="flex justify-between py-2"><span className="capitalize">{c.product_type}</span>
              <span><b>{c.launches_recent}</b> <span className="text-slate-400">vs {c.launches_prev} · {c.stores} store{c.stores > 1 ? "s" : ""}</span></span></li>))}</ul></div>)}
      {at && <p className="mt-6 text-xs text-slate-400">Scores last computed {new Date(at).toLocaleString()}. Scores are heuristics, not sales data.</p>}
    </div>
  );
}
