import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ads, adInsight, competitors, isPro, FREE_LIMIT } from "@/lib/analytics";
import { AreaChart } from "@/components/Sparkline";
import { compact, pct, usd } from "@/lib/format";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function CompetitorPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const all = competitors();
  const idx = all.findIndex((c) => c.id === Number(params.id));
  if (idx < 0) notFound();
  if (!isPro(user) && idx >= FREE_LIMIT) redirect("/dashboard/billing");
  const c = all[idx];
  const theirAds = ads().filter((a) => a.competitor_id === c.id);
  const stats = [["Monthly visits", compact(c.monthly_visits)], ["Est. revenue", usd(c.est_revenue)], ["Growth", pct(c.growth_pct)],
    ["Products", String(c.product_count)], ["Active ads", String(c.active_ads)], ["Avg. price", usd(c.avg_price)]];
  return (
    <div>
      <Link href="/dashboard/competitors" className="text-sm text-brand-600">← All competitors</Link>
      <h1 className="mt-2 text-2xl font-bold">{c.name}</h1>
      <p className="text-sm text-slate-500">{c.domain} · {c.niche} · {c.platform}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map(([k, v]) => <div key={k} className="card p-4"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}
      </div>
      <div className="card mt-6 p-5"><h2 className="font-semibold">Traffic, last 12 months</h2><AreaChart data={JSON.parse(c.traffic_series)} labels={months} /></div>
      <h2 className="mt-8 font-semibold">Their ads</h2>
      <div className="mt-3 space-y-3">
        {theirAds.map((a) => (
          <div key={a.id} className="card p-4"><p className="font-medium">“{a.hook}”</p>
            <p className="mt-1 text-sm text-slate-600">{a.copy}</p>
            <p className="mt-2 text-xs text-slate-500">{a.platform} · {a.format} · {a.days_running} days · {usd(a.est_spend)} est. spend</p>
            {isPro(user) && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm text-brand-900"><b>Why it works:</b> {adInsight(a)}</p>}</div>))}
      </div>
    </div>
  );
}
