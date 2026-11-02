import Link from "next/link";
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} TrendPulse. Ecommerce intelligence, simplified.</p>
        <nav className="flex gap-5"><Link href="/shop">Shop</Link><Link href="/#pricing">Pricing</Link><Link href="/login">Log in</Link></nav>
      </div>
    </footer>
  );
}
