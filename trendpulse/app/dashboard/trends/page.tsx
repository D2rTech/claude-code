import { requireUser } from "@/lib/auth";
import { isPro, trends, FREE_LIMIT } from "@/lib/analytics";
import Sparkline from "@/components/Sparkline";
import { Badge, UpgradeBanner } from "@/components/Paywall";
import { pct, usd } from "@/lib/format";

export const metadata = { title: "Trends" };

export default async function Trends() {
  const user = await requireUser();
  const pro = isPro(user);
  const rows = trends(user);
  return (
    <div>
      <h1 className="text-2xl font-bold">Trend radar</h1>
      <p className="text-sm text-slate-500">Products gaining momentum. Fewer sellers + rising ads = opportunity.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((t) => {
          const locked = !!t.locked;
          const saturation = t.stores_selling > 180 ? "High" : t.stores_selling > 100 ? "Medium" : "Low";
          return (
            <div key={t.id} className={`card relative p-5 ${locked ? "select-none blur-[5px]" : ""}`} aria-hidden={locked}>
              <div className="flex items-start justify-between">
                <div><h2 className="font-semibold">{t.product}</h2><p className="text-xs text-slate-400">{t.niche} · avg {usd(t.avg_price)}</p></div>
                <div className="text-right"><p className="text-2xl font-extrabold text-brand-600">{t.score}</p><p className="text-xs text-slate-400">score</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Sparkline data={JSON.parse(t.series)} w={150} h={40} color="#059669" />
                <div className="space-y-1 text-right text-xs">
                  <Badge tone="green">{pct(t.growth_pct)}</Badge><br />
                  <Badge tone={saturation === "High" ? "red" : saturation === "Medium" ? "amber" : "green"}>{saturation} saturation</Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{t.stores_selling} stores selling · {t.active_ads} active ads</p>
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700"><b>Why:</b> {t.why}</p>
            </div>);
        })}
      </div>
      {!pro && <UpgradeBanner what={`${rows.filter((r) => r.locked).length} more trending products`} />}
    </div>
  );
}
