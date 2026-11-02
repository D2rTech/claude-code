import Link from "next/link";
import { addToCart } from "@/app/actions";
import type { Product } from "@/lib/cart";
import { money } from "@/lib/format";

export default function ProductCard({ p }: { p: Product }) {
  const out = p.stock <= 0;
  return (
    <div className="card group flex flex-col overflow-hidden">
      <Link href={`/shop/${p.slug}`} className="block aspect-square overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image ?? "/products/1.png"} alt={p.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-slate-400">{p.category_name}</p>
        <Link href={`/shop/${p.slug}`} className="font-medium hover:text-brand-700">{p.name}</Link>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-semibold">{money(p.price_cents)}</span>
          {out ? <span className="text-xs font-medium text-red-600">Sold out</span> : (
            <form action={addToCart}><input type="hidden" name="productId" value={p.id} /><button className="btn-primary px-3 py-1.5">Add</button></form>)}
        </div>
      </div>
    </div>
  );
}
