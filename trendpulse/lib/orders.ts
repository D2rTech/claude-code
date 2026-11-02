import { db } from "./db";

/** Idempotently marks an order paid and decrements inventory. */
export function fulfillOrder(orderId: number) {
  const d = db();
  d.transaction(() => {
    const o = d.prepare("SELECT status FROM orders WHERE id=?").get(orderId) as { status: string } | undefined;
    if (!o || o.status !== "pending") return;
    d.prepare("UPDATE orders SET status='paid' WHERE id=?").run(orderId);
    const items = d.prepare("SELECT product_id, qty FROM order_items WHERE order_id=?").all(orderId) as { product_id: number; qty: number }[];
    const dec = d.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id=?");
    items.forEach((i) => dec.run(i.qty, i.product_id));
  })();
}
