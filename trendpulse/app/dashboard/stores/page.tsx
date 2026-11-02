import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/analytics";
import { listStores } from "@/lib/stores";
import AddStoreForm from "@/components/AddStoreForm";
import { Badge, UpgradeBanner } from "@/components/Paywall";
import { syncNow } from "@/app/ingest-actions";

export const metadata = { title: "Live stores" };
export const dynamic = "force-dynamic";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${Math.max(m, 1)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default async function Stores() {
  const user = await requireUser("/dashboard/stores");
  const pro = isPro(user);
  const rows = listStores(user);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Live stores</h1><Badge tone="green">Real data</Badge></div>
      <p className="text-sm text-slate-500">Public Shopify catalogs, re-checked about once a day. We detect new products, price changes, sell-outs and removals.</p>
      <div className="mt-6"><AddStoreForm canAdd={pro} /></div>
      {rows.length === 0 ? <p className="mt-10 text-center text-slate-500">No stores tracked yet. Add one above.</p> : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200"><tr>{["Store", "Products", "New (7d)", "Price changes (7d)", "Removed (7d)", "Last synced"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className={s.locked ? "select-none blur-[5px]" : "hover:bg-slate-50"} aria-hidden={s.locked}>
                  <td className="td font-medium">{s.locked ? s.name : <Link href={`/dashboard/stores/${s.id}`} className="text-brand-700 hover:underline">{s.name}</Link>}
                    <div className="text-xs font-normal text-slate-400">{s.domain}{s.niche && ` · ${s.niche}`}</div></td>
                  <td className="td">{s.product_count}</td>
                  <td className="td">{s.baselined ? s.new_7d : "—"}</td><td className="td">{s.baselined ? s.price_7d : "—"}</td><td className="td">{s.baselined ? s.removed_7d : "—"}</td>
                  <td className="td text-sm">
                    {s.last_error ? <span className="text-red-600" title={s.last_error}>Failed: {s.last_error.slice(0, 40)}</span>
                      : s.last_synced_at ? ago(s.last_synced_at) : <span className="text-amber-600">Syncing…</span>}
                    {user.role === "admin" && !s.locked && (
                      <form action={syncNow} className="mt-1"><input type="hidden" name="storeId" value={s.id} /><button className="text-xs text-brand-600 underline">Sync now</button></form>)}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
      {!pro && rows.some((r) => r.locked) && <UpgradeBanner what="all tracked stores and the ability to add your own" />}
      <p className="mt-6 text-xs text-slate-400">Data comes from each store’s public <code>/products.json</code>. Changes appear after the second sync (the first one sets the baseline).</p>
    </div>
  );
}
