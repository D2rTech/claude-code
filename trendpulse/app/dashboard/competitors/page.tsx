import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { competitors, isPro, FREE_LIMIT } from "@/lib/analytics";
import Sparkline from "@/components/Sparkline";
import { Badge, UpgradeBanner } from "@/components/Paywall";
import { compact, pct, usd } from "@/lib/format";

export const metadata = { title: "Competitors" };

export default async function Competitors() {
  const user = await requireUser();
  const pro = isPro(user);
  const rows = competitors(user);
  return (
    <div>
      <h1 className="text-2xl font-bold">Competitors</h1>
      <p className="mt-2 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Demo data — sample numbers, not real measurements. See “Live stores” for real data.</p>
      <p className="text-sm text-slate-500">Estimated performance of tracked stores, ranked by revenue.</p>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200"><tr>
            {["Store", "Niche", "Visits/mo", "Est. revenue", "Growth", "Top channel", "12-mo traffic"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const locked = !!c.locked;
              return (
                <tr key={c.id} className={locked ? "select-none blur-[5px]" : "hover:bg-slate-50"} aria-hidden={locked}>
                  <td className="td font-medium">{locked ? c.name : <Link className="text-brand-700 hover:underline" href={`/dashboard/competitors/${c.id}`}>{c.name}</Link>}
                    <div className="text-xs font-normal text-slate-400">{c.domain}</div></td>
                  <td className="td">{c.niche}</td><td className="td">{compact(c.monthly_visits)}</td>
                  <td className="td font-medium">{usd(c.est_revenue)}</td>
                  <td className="td"><Badge tone={c.growth_pct >= 0 ? "green" : "red"}>{pct(c.growth_pct)}</Badge></td>
                  <td className="td">{c.top_channel}</td>
                  <td className="td"><Sparkline data={JSON.parse(c.traffic_series)} w={90} h={28} color={c.growth_pct >= 0 ? "#059669" : "#dc2626"} /></td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      {!pro && <UpgradeBanner what={`${rows.filter((r) => r.locked).length} more competitors`} />}
    </div>
  );
}
