import Link from "next/link";
import { db } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/cart";

export const metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default function Shop({ searchParams }: { searchParams: { q?: string; category?: string; sort?: string } }) {
  const d = db();
  const cats = d.prepare("SELECT * FROM categories ORDER BY name").all() as { id: number; slug: string; name: string; image: string }[];
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const cat = cats.find((c) => c.slug === searchParams.category);
  const order = { low: "p.price_cents ASC", high: "p.price_cents DESC", new: "p.created_at DESC" }[searchParams.sort ?? ""] ?? "p.name ASC";
  const where = ["p.active=1"]; const args: (string | number)[] = [];
  if (q) { where.push("(p.name LIKE ? OR p.description LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (cat) { where.push("p.category_id=?"); args.push(cat.id); }
  const products = d.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
    LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(" AND ")} ORDER BY ${order}`).all(...args) as Product[];
  const href = (c?: string) => `/shop?${new URLSearchParams({ ...(q && { q }), ...(c && { category: c }) })}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Shop</h1>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" role="search">
        <input name="q" defaultValue={q} placeholder="Search products…" className="input sm:max-w-sm" aria-label="Search products" />
        {cat && <input type="hidden" name="category" value={cat.slug} />}
        <select name="sort" defaultValue={searchParams.sort ?? ""} className="input sm:w-48" aria-label="Sort">
          <option value="">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="new">Newest</option>
        </select>
        <button className="btn-primary">Search</button>
      </form>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link href={href()} className={`rounded-full border px-3 py-1 ${!cat ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"}`}>All</Link>
        {cats.map((c) => <Link key={c.id} href={href(c.slug)} className={`rounded-full border px-3 py-1 ${cat?.id === c.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"}`}>{c.name}</Link>)}
      </div>
      {products.length === 0 ? <p className="mt-16 text-center text-slate-500">No products match your search.</p> : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>)}
    </div>
  );
}
