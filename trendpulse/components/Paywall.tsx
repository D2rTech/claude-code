import Link from "next/link";
export function UpgradeBanner({ what }: { what: string }) {
  return (
    <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:flex-row sm:items-center">
      <div><p className="font-semibold text-brand-900">Unlock {what}</p>
        <p className="text-sm text-brand-700">Upgrade to Pro to see the full dataset and insights.</p></div>
      <Link href="/dashboard/billing" className="btn-primary">Upgrade to Pro</Link>
    </div>
  );
}
export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "indigo" | "amber" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700",
    indigo: "bg-brand-50 text-brand-700", amber: "bg-amber-50 text-amber-700" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
