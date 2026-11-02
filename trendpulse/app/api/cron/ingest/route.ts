import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDue } from "@/lib/ingest/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Call on a schedule (e.g. every 6h): POST with `Authorization: Bearer $CRON_SECRET`. Only stores that are due are synced. */
export async function POST(req: Request) {
  const ok = authorized(req);
  if (ok === null) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out = await runDue();
  return NextResponse.json({ synced: out.results.length, skipped: out.skipped, results: out.results });
}
