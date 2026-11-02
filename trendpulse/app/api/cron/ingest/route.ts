import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { JOBS, runAll, runJob, type JobName } from "@/lib/ingest/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * POST /api/cron/ingest[?job=sync|ads|estimates|trending]  with `Authorization: Bearer $CRON_SECRET`.
 * No `job` runs the whole pipeline in order. Each job only does work that is due, so calling this often is cheap.
 */
export async function POST(req: Request) {
  const ok = authorized(req);
  if (ok === null) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = new URL(req.url).searchParams.get("job");
  if (job && !(JOBS as readonly string[]).includes(job)) return NextResponse.json({ error: `Unknown job. Use one of: ${JOBS.join(", ")}` }, { status: 400 });
  const results = job ? [await runJob(job as JobName)] : await runAll();
  return NextResponse.json({ results });
}
