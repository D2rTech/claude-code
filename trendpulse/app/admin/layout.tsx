import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-bold">Admin</h1>
        <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">Summary</Link>
        <Link href="/admin/products" className="text-sm text-slate-600 hover:text-slate-900">Products & inventory</Link>
        <Link href="/admin/orders" className="text-sm text-slate-600 hover:text-slate-900">Orders</Link>
      </div>
      {children}
    </div>
  );
}
