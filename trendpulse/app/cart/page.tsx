import Link from "next/link";
import { cartLines, cartTotal } from "@/lib/cart";
import { checkout, setQty } from "@/app/actions";
import { money } from "@/lib/format";
import { stripe } from "@/lib/stripe";

export const metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

export default function Cart() {
  const lines = cartLines();
  if (!lines.length) return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1>
      <Link href="/shop" className="btn-primary mt-6">Browse the shop</Link></div>);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <ul className="card mt-6 divide-y divide-slate-100">
        {lines.map(({ product: p, qty }) => (
          <li key={p.id} className="flex items-center gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image ?? ""} alt="" className="h-16 w-16 rounded-lg bg-slate-100 object-cover" />
            <div className="min-w-0 flex-1"><Link href={`/shop/${p.slug}`} className="font-medium">{p.name}</Link><p className="text-sm text-slate-500">{money(p.price_cents)}</p></div>
            <form action={setQty} className="flex items-center gap-2">
              <input type="hidden" name="productId" value={p.id} />
              <input type="number" name="qty" min={0} max={p.stock} defaultValue={qty} className="input w-16" aria-label={`Quantity for ${p.name}`} />
              <button className="btn-ghost px-3 py-1.5">Update</button>
            </form>
            <p className="w-20 text-right font-medium">{money(p.price_cents * qty)}</p>
          </li>))}
      </ul>
      <div className="mt-6 flex items-center justify-between"><span className="text-lg font-semibold">Total</span><span className="text-2xl font-bold">{money(cartTotal(lines))}</span></div>
      <form action={checkout} className="mt-6"><button className="btn-primary w-full py-3 text-base">Checkout{stripe() ? "" : " (demo payment)"}</button></form>
      {!stripe() && <p className="mt-2 text-center text-xs text-slate-400">Stripe keys not set — payment will be simulated.</p>}
    </div>
  );
}
