import { db } from "@/lib/db";
import { runJobNow } from "@/app/ingest-actions";
import { JOBS } from "@/lib/ingest/jobs";
import { adsEnabled } from "@/lib/ingest/ads";
import { Badge } from "@/components/Paywall";

export const dynamic = "force-dynamic";
type R = { id: number; job: string; started_at: string; finished_at: string | null; ok: number | null; summary: string | null };

export default function Jobs() {
  const runs = db().prepare("SELECT * FROM job_runs ORDER BY id DESC LIMIT 40").all() as R[];
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        {JOBS.map((j) => (
          <form key={j} action={runJobNow} className="card p-4"><input type="hidden" name="job" value={j} />
            <p className="font-medium capitalize">{j}</p>
            <p className="text-xs text-slate-400">{j === "ads" ? (adsEnabled() ? "Meta token set" : "No META_ADS_ACCESS_TOKEN — will skip") : j === "sync" ? "Due stores only" : "Recomputes from stored data"}</p>
            <button className="btn-ghost mt-3 w-full">Run now</button></form>))}
      </div>
      <p className="mt-3 text-xs text-slate-400">Scheduled runs: POST /api/cron/ingest (see README). “Run now” on <b>sync</b> only fetches stores that are due.</p>
      <div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[640px]">
        <thead className="border-b border-slate-200"><tr>{["Job", "Started", "Took", "Result"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {runs.length === 0 && <tr><td colSpan={4} className="td text-slate-500">No runs yet.</td></tr>}
          {runs.map((r) => (
            <tr key={r.id}><td className="td capitalize">{r.job}</td><td className="td text-slate-500">{new Date(r.started_at).toLocaleString()}</td>
              <td className="td">{r.finished_at ? `${Math.max(0, Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000))}s` : "running…"}</td>
              <td className="td"><Badge tone={r.ok === 0 ? "red" : "green"}>{r.ok === 0 ? "failed" : "ok"}</Badge><code className="ml-2 break-all text-xs text-slate-500">{r.summary}</code></td></tr>))}
        </tbody></table></div>
    </div>
  );
}
