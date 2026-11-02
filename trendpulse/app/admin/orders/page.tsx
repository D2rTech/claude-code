import { db } from "@/lib/db";
import { setOrderStatus } from "@/app/actions";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
type O = { id: number; email: string; status: string; total_cents: number; created_at: string; items: string };

export default function AdminOrders() {
  const orders = db().prepare(`SELECT o.*, (SELECT group_concat(qty||'× '||name, ', ') FROM order_items WHERE order_id=o.id) AS items
    FROM orders o ORDER BY o.id DESC`).all() as O[];
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px]"><thead className="border-b border-slate-200"><tr>
        {["#", "Customer", "Items", "Total", "Date", "Status"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {orders.length === 0 && <tr><td colSpan={6} className="td text-slate-500">No orders yet.</td></tr>}
          {orders.map((o) => (
            <tr key={o.id}><td className="td">{o.id}</td><td className="td">{o.email}</td><td className="td text-slate-600">{o.items}</td>
              <td className="td font-medium">{money(o.total_cents)}</td><td className="td text-slate-500">{o.created_at}</td>
              <td className="td"><form action={setOrderStatus} className="flex gap-2"><input type="hidden" name="orderId" value={o.id} />
                <select name="status" defaultValue={o.status} className="input w-32 py-1" aria-label="Status">
                  {["pending", "paid", "shipped", "cancelled", "refunded"].map((s) => <option key={s}>{s}</option>)}</select>
                <button className="btn-ghost px-3 py-1">Set</button></form></td></tr>))}
        </tbody></table>
    </div>
  );
}
