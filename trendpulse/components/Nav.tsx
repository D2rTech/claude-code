import Link from "next/link";
import { getUser } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { logout } from "@/app/actions";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /></svg>
      </span>
      TrendPulse
    </Link>
  );
}

export default async function Nav() {
  const user = await getUser();
  const count = cartCount();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm text-slate-600 sm:flex">
            <Link href="/#features" className="hover:text-slate-900">Features</Link>
            <Link href="/#pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/shop" className="hover:text-slate-900">Shop</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/cart" className="btn-ghost relative" aria-label="Cart">
            Cart{count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{count}</span>}
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="btn-primary">Dashboard</Link>
              <form action={logout}><button className="btn-ghost" type="submit">Log out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
              <Link href="/signup" className="btn-primary">Start free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
