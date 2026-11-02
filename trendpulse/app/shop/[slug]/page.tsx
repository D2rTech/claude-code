import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { addToCart } from "@/app/actions";
import type { Product } from "@/lib/cart";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ProductPage({ params }: { params: { slug: string } }) {
  const p = db().prepare(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.slug=? AND p.active=1`).get(params.slug) as Product | undefined;
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/shop" className="text-sm text-brand-600">← Back to shop</Link>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image ?? "/products/1.png"} alt={p.name} className="aspect-square w-full rounded-2xl bg-slate-100 object-cover" />
        <div>
          <p className="text-sm text-slate-400">{p.category_name}</p>
          <h1 className="mt-1 text-3xl font-bold">{p.name}</h1>
          <p className="mt-3 text-2xl font-semibold">{money(p.price_cents)}</p>
          <p className="mt-4 text-slate-600">{p.description}</p>
          <p className={`mt-4 text-sm ${p.stock > 0 ? (p.stock < 10 ? "text-amber-600" : "text-emerald-600") : "text-red-600"}`}>
            {p.stock > 0 ? (p.stock < 10 ? `Only ${p.stock} left` : "In stock") : "Sold out"}</p>
          {p.stock > 0 && <form action={addToCart} className="mt-6"><input type="hidden" name="productId" value={p.id} /><button className="btn-primary px-8 py-3">Add to cart</button></form>}
        </div>
      </div>
    </div>
  );
}
