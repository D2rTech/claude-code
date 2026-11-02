"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { isPro } from "@/lib/analytics";
import { normalizeDomain } from "@/lib/ingest/net";
import { runDue, syncStore, type StoreRow } from "@/lib/ingest/sync";
import { JOBS, runJob, type JobName } from "@/lib/ingest/jobs";
import { runEstimates } from "@/lib/ingest/estimates";
import type { FormState } from "./actions";

const MAX_TOTAL = Number(process.env.MAX_STORES || 300);
const MAX_PER_USER = Number(process.env.MAX_STORES_PER_USER || 25);

export async function addStore(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/stores");
  if (!isPro(user)) return { error: "Tracking your own stores is a Pro feature." };
  const domain = normalizeDomain(String(fd.get("domain") ?? ""));
  if (!domain) return { error: "Enter a public store domain, like allbirds.com" };
  const niche = z.string().trim().max(60).catch("").parse(fd.get("niche") ?? "");
  const d = db();
  if (d.prepare("SELECT 1 FROM stores WHERE domain=?").get(domain)) return { error: "That store is already being tracked." };
  const total = (d.prepare("SELECT COUNT(*) c FROM stores").get() as { c: number }).c;
  if (total >= MAX_TOTAL) return { error: "The tracker is at capacity. Contact support." };
  const mine = (d.prepare("SELECT COUNT(*) c FROM stores WHERE added_by=?").get(user.id) as { c: number }).c;
  if (user.role !== "admin" && mine >= MAX_PER_USER) return { error: `You can add up to ${MAX_PER_USER} stores.` };
  const name = domain.split(".")[domain.split(".").length > 2 ? 1 : 0].replace(/^./, (c) => c.toUpperCase());
  const r = d.prepare("INSERT INTO stores (domain,name,niche,added_by,created_at) VALUES (?,?,?,?,?)").run(domain, name, niche, user.id, new Date().toISOString());
  // Kick off the first (baseline) sync in the background; the page shows its status.
  void syncStore({ id: Number(r.lastInsertRowid), domain, name, baselined: 0, last_attempt_at: null });
  revalidatePath("/dashboard/stores");
  return undefined;
}

export async function syncNow(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("storeId"));
  const s = db().prepare("SELECT id,domain,name,baselined,last_attempt_at FROM stores WHERE id=?").get(id) as StoreRow | undefined;
  if (s) await syncStore(s);
  else await runDue({ force: true });
  revalidatePath("/dashboard/stores");
}

export async function removeStore(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM stores WHERE id=?").run(Number(fd.get("storeId")));
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/stores");
}

export async function setVisits(fd: FormData) {
  const user = await requireUser("/dashboard/stores");
  const id = Number(fd.get("storeId"));
  const s = db().prepare("SELECT added_by FROM stores WHERE id=?").get(id) as { added_by: number | null } | undefined;
  if (!s || !isPro(user) || (user.role !== "admin" && s.added_by !== user.id)) return;
  const raw = String(fd.get("visits") ?? "").replace(/[,\s]/g, "");
  const now = new Date().toISOString();
  if (raw === "") db().prepare("UPDATE store_job_state SET monthly_visits=NULL WHERE store_id=?").run(id);
  else {
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 100 || v > 2_000_000_000) return;
    db().prepare(`INSERT INTO store_job_state (store_id,monthly_visits,visits_source,visits_updated_at) VALUES (?,?,'manual',?)
      ON CONFLICT(store_id) DO UPDATE SET monthly_visits=excluded.monthly_visits, visits_source='manual', visits_updated_at=excluded.visits_updated_at`).run(id, v, now);
    runEstimates();
  }
  revalidatePath(`/dashboard/stores/${id}`);
}

export async function runJobNow(fd: FormData) {
  await requireAdmin();
  const job = String(fd.get("job"));
  if ((JOBS as readonly string[]).includes(job)) await runJob(job as JobName);
  revalidatePath("/admin/jobs");
}
