import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ads, competitors, isPro, trends, FREE_LIMIT } from "@/lib/analytics";
import { AreaChart } from "@/components/Sparkline";
import { compact, pct, usd } from "@/lib/format";
import { UpgradeBanner } from "@/components/Paywall";

export const metadata = { title: "Dashboard" };
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Overview() {
  const user = await requireUser();
  const pro = isPro(user);
  const comps = competitors(), tr = trends(user), allAds = ads();
  const agg = months.map((_, i) => comps.reduce((s, c) => s + (JSON.parse(c.traffic_series) as number[])[i], 0));
  const kpis = [
    ["Tracked stores", String(comps.length)], ["Est. monthly revenue", usd(comps.reduce((s, c) => s + c.est_revenue, 0))],
    ["Trending products", String(tr.length)], ["Ads monitored", String(allAds.length)],
  ];
  const winners = allAds.filter((a) => a.days_running >= 30).length;
  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="text-sm text-slate-500">Market snapshot across tracked stores (demo dataset).</p>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([k, v]) => <div key={k} className="card p-4"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}
      </div>
      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Combined store traffic (12 mo)</h2>
          <span className="text-sm text-slate-500">{compact(agg[11])} visits last month</span></div>
        <AreaChart data={agg} labels={months} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Hottest products</h2><Link className="text-sm text-brand-600" href="/dashboard/trends">All trends →</Link></div>
          <ul className="mt-3 divide-y divide-slate-100">
            {tr.slice(0, pro ? 5 : FREE_LIMIT).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm"><span>{t.product}<span className="ml-2 text-xs text-slate-400">{t.niche}</span></span>
                <span className="font-semibold text-emerald-600">{pct(t.growth_pct)}</span></li>))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Ad signals</h2>
          <p className="mt-3 text-3xl font-bold">{winners}<span className="text-base font-medium text-slate-500"> / {allAds.length}</span></p>
          <p className="text-sm text-slate-500">ads have run 30+ days — likely profitable winners.</p>
          <Link href="/dashboard/ads" className="btn-ghost mt-4">Open ad library</Link>
        </div>
      </div>
      {!pro && <UpgradeBanner what="all competitors, trends and ad insights" />}
    </div>
  );
}
