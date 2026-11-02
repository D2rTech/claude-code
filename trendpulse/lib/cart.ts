import { cookies } from "next/headers";
import { db } from "./db";

export type Product = { id: number; slug: string; name: string; description: string; price_cents: number;
  image: string | null; category_id: number | null; stock: number; active: number; category_name?: string; category_slug?: string };
export type CartLine = { product: Product; qty: number };

export function readCart(): Record<string, number> {
  try { return JSON.parse(cookies().get("cart")?.value || "{}"); } catch { return {}; }
}
export function writeCart(c: Record<string, number>) {
  cookies().set("cart", JSON.stringify(c), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
}
export function cartLines(): CartLine[] {
  const cart = readCart();
  const ids = Object.keys(cart).map(Number).filter(Number.isFinite);
  if (!ids.length) return [];
  const rows = db().prepare(`SELECT * FROM products WHERE active=1 AND id IN (${ids.map(() => "?").join(",")})`).all(...ids) as Product[];
  return rows.map((p) => ({ product: p, qty: Math.max(1, Math.min(cart[p.id], p.stock)) })).filter((l) => l.product.stock > 0);
}
export const cartCount = () => Object.values(readCart()).reduce((a, b) => a + b, 0);
export const cartTotal = (l: CartLine[]) => l.reduce((s, x) => s + x.product.price_cents * x.qty, 0);
