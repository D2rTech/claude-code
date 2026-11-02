import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export default function Summary() {
  const d = db();
  const one = <T,>(sql: string) => d.prepare(sql).get() as T;
  const rev = one<{ v: number }>("SELECT COALESCE(SUM(total_cents),0) v FROM orders WHERE status IN ('paid','shipped')").v;
  const orders = one<{ v: number }>("SELECT COUNT(*) v FROM orders").v;
  const users = one<{ v: number }>("SELECT COUNT(*) v FROM users").v;
  const pro = one<{ v: number }>("SELECT COUNT(*) v FROM users WHERE plan='pro'").v;
  const low = d.prepare("SELECT name, stock FROM products WHERE active=1 AND stock<10 ORDER BY stock").all() as { name: string; stock: number }[];
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Shop revenue", money(rev)], ["Orders", orders], ["Users", users], ["Pro subscribers", pro]].map(([k, v]) => (
          <div key={k as string} className="card p-4"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>))}
      </div>
      <div className="card mt-6 p-5"><h2 className="font-semibold">Low stock</h2>
        {low.length === 0 ? <p className="mt-2 text-sm text-slate-500">All products are well stocked.</p> :
          <ul className="mt-2 text-sm">{low.map((p) => <li key={p.name} className="flex justify-between py-1"><span>{p.name}</span><span className="font-medium text-amber-600">{p.stock} left</span></li>)}</ul>}
      </div>
    </div>
  );
}
