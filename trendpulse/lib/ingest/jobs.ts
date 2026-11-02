import { db } from "../db";
import { runDue } from "./sync";
import { runAds } from "./ads";
import { runEstimates } from "./estimates";
import { runTrending } from "./trending";

export const JOBS = ["sync", "ads", "estimates", "trending"] as const;
export type JobName = (typeof JOBS)[number];
export type JobOutcome = { job: JobName; ok: boolean; summary: unknown };

const running = new Set<string>();

/** Runs one job and records it in job_runs (so /admin/jobs shows history and failures). */
export async function runJob(job: JobName): Promise<JobOutcome> {
  if (running.has(job)) return { job, ok: true, summary: { skipped: "already running" } };
  running.add(job);
  const d = db();
  const id = Number(d.prepare("INSERT INTO job_runs (job,started_at) VALUES (?,?)").run(job, new Date().toISOString()).lastInsertRowid);
  let ok = true, summary: unknown;
  try {
    if (job === "sync") { const r = await runDue({ budgetMs: 150_000 }); summary = { skipped: r.skipped, stores: r.results.length, failed: r.results.filter((x) => !x.ok).length, events: r.results.reduce((s, x) => s + (x.events ?? 0), 0) }; }
    else if (job === "ads") { summary = await runAds({ budgetMs: 90_000 }); }
    else if (job === "estimates") summary = runEstimates();
    else summary = runTrending();
  } catch (e) { ok = false; summary = { error: e instanceof Error ? e.message : String(e) }; }
  d.prepare("UPDATE job_runs SET finished_at=?, ok=?, summary=? WHERE id=?").run(new Date().toISOString(), ok ? 1 : 0, JSON.stringify(summary), id);
  running.delete(job);
  return { job, ok, summary };
}

/** Full pipeline in dependency order: fresh catalogs → ads → estimates → trending scores. */
export async function runAll(): Promise<JobOutcome[]> {
  const out: JobOutcome[] = [];
  for (const j of JOBS) out.push(await runJob(j));
  return out;
}
