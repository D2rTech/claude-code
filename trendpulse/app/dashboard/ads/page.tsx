import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { adInsight, ads, isPro, FREE_LIMIT } from "@/lib/analytics";
import { Badge, UpgradeBanner } from "@/components/Paywall";
import { compact, usd } from "@/lib/format";

export const metadata = { title: "Ad library" };
const PLATFORMS = ["Meta", "TikTok", "Instagram", "YouTube"];

export default async function AdLibrary({ searchParams }: { searchParams: { platform?: string } }) {
  const user = await requireUser();
  const pro = isPro(user);
  const platform = PLATFORMS.includes(searchParams.platform ?? "") ? searchParams.platform : undefined;
  const rows = ads(platform, user);
  return (
    <div>
      <h1 className="text-2xl font-bold">Ad library</h1>
      <p className="mt-2 inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Demo data — sample numbers, not real measurements. See “Live stores” for real data.</p>
      <p className="text-sm text-slate-500">Sorted by longevity. Ads running 30+ days are probably profitable.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {[undefined, ...PLATFORMS].map((p) => (
          <Link key={p ?? "all"} href={p ? `/dashboard/ads?platform=${p}` : "/dashboard/ads"}
            className={`rounded-full border px-3 py-1 ${p === platform ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`}>{p ?? "All"}</Link>))}
      </div>
      <div className="mt-6 space-y-4">
        {rows.map((a) => {
          const locked = !!a.locked;
          return (
            <article key={a.id} className={`card p-5 ${locked ? "select-none blur-[5px]" : ""}`} aria-hidden={locked}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="indigo">{a.platform}</Badge><Badge>{a.format}</Badge>
                {a.days_running >= 30 && <Badge tone="green">Winner · {a.days_running}d</Badge>}
                <span className="text-slate-400">{a.competitor} · {a.niche}</span>
              </div>
              <h2 className="mt-2 font-semibold">“{a.hook}”</h2>
              <p className="mt-1 text-sm text-slate-600">{a.copy}</p>
              <p className="mt-2 text-xs text-slate-500">CTA: {a.cta} · {a.days_running} days live · {usd(a.est_spend)} est. spend · {compact(a.engagement)} engagements</p>
              {pro
                ? <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900"><b>Why it works:</b> {adInsight(a)}</p>
                : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">🔒 “Why it works” insight is a Pro feature.</p>}
            </article>);
        })}
      </div>
      {!pro && <UpgradeBanner what="the full ad library with insights" />}
    </div>
  );
}
