import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { Badge } from "@/components/Paywall";

export const metadata = { title: "My orders" };
type O = { id: number; status: string; total_cents: number; created_at: string };

export default async function MyOrders() {
  const user = await requireUser("/account/orders");
  const orders = db().prepare("SELECT id,status,total_cents,created_at FROM orders WHERE user_id=? ORDER BY id DESC").all(user.id) as O[];
  const items = db().prepare("SELECT name, qty FROM order_items WHERE order_id=?");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">My orders</h1>
      {orders.length === 0 ? <p className="mt-6 text-slate-500">No orders yet.</p> : (
        <ul className="mt-6 space-y-3">{orders.map((o) => (
          <li key={o.id} className="card p-4"><div className="flex items-center justify-between"><span className="font-medium">Order #{o.id}</span>
            <Badge tone={o.status === "paid" || o.status === "shipped" ? "green" : "amber"}>{o.status}</Badge></div>
            <p className="mt-1 text-sm text-slate-500">{(items.all(o.id) as { name: string; qty: number }[]).map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
            <p className="mt-1 text-sm">{money(o.total_cents)} · {o.created_at}</p></li>))}</ul>)}
    </div>
  );
}
