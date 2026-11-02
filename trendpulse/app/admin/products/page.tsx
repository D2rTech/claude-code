import { db } from "@/lib/db";
import { saveProduct } from "@/app/actions";
import type { Product } from "@/lib/cart";

export const dynamic = "force-dynamic";

function Fields({ p, cats }: { p?: Product; cats: { id: number; name: string }[] }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" required defaultValue={p?.name} placeholder="Name" className="input min-w-40 flex-1" aria-label="Name" />
      <input name="price" type="number" step="0.01" min="0" required defaultValue={p ? p.price_cents / 100 : ""} placeholder="Price" className="input w-24" aria-label="Price" />
      <input name="stock" type="number" min="0" required defaultValue={p?.stock ?? 0} placeholder="Stock" className="input w-20" aria-label="Stock" />
      <select name="category_id" defaultValue={p?.category_id ?? ""} className="input w-36" aria-label="Category">
        <option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input name="image" defaultValue="" placeholder="Image URL/path (optional)" className="input w-48" aria-label="Image" />
      <input type="hidden" name="description" value={p?.description ?? ""} />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} /> Active</label>
    </>
  );
}

export default function AdminProducts() {
  const d = db();
  const cats = d.prepare("SELECT id,name FROM categories ORDER BY name").all() as { id: number; name: string }[];
  const products = d.prepare("SELECT * FROM products ORDER BY id").all() as Product[];
  return (
    <div>
      <h2 className="font-semibold">Add product</h2>
      <form action={saveProduct} className="card mt-2 flex flex-wrap items-center gap-2 p-3"><Fields cats={cats} />
        <input name="description" placeholder="Description" className="input w-full" aria-label="Description" />
        <button className="btn-primary">Create</button></form>
      <h2 className="mt-8 font-semibold">Inventory ({products.length})</h2>
      <div className="mt-2 space-y-2">
        {products.map((p) => (
          <form key={p.id} action={saveProduct} className="card flex flex-wrap items-center gap-2 p-3"><Fields p={p} cats={cats} /><button className="btn-ghost">Save</button></form>))}
      </div>
    </div>
  );
}
