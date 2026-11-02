import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeEvents, storeIsViewable, storeProducts } from "@/lib/stores";
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
