import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/Paywall";
import { isPro } from "@/lib/analytics";

const links = [["/dashboard", "Overview"], ["/dashboard/stores", "Live stores"], ["/dashboard/competitors", "Competitors (demo)"], ["/dashboard/trends", "Trends (demo)"],
  ["/dashboard/ads", "Ad library (demo)"], ["/dashboard/billing", "Billing"], ["/account/orders", "My orders"]];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
      <aside className="mb-6 lg:mb-0">
        <p className="truncate text-sm font-medium">{user.email}</p>
        <div className="mt-1"><Badge tone={isPro(user) ? "indigo" : "slate"}>{isPro(user) ? "Pro" : "Free plan"}</Badge></div>
        <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white hover:shadow-sm">{l}</Link>)}
          {user.role === "admin" && <Link href="/admin" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-white">Admin</Link>}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
