import type Database from "better-sqlite3";
import { db } from "../db";
import { fetchCatalog, type ParsedProduct } from "./shopify";
import type { Fetcher } from "./net";

export type StoreRow = { id: number; domain: string; name: string; baselined: number; last_attempt_at: string | null };
export type SyncResult = { storeId: number; domain: string; ok: boolean; products?: number; events?: number; complete?: boolean; error?: string };

type Existing = { id: number; remote_id: string; price_cents: number; available: number; removed_at: string | null };

/** Diffs a freshly fetched catalog against the DB, recording events. The first successful sync is a silent baseline. */
export function applyCatalog(d: Database.Database, store: StoreRow, products: ParsedProduct[], complete: boolean, now = new Date().toISOString()): number {
  let events = 0;
  d.transaction(() => {
    const existing = new Map((d.prepare("SELECT id,remote_id,price_cents,available,removed_at FROM store_products WHERE store_id=?").all(store.id) as Existing[]).map((r) => [r.remote_id, r]));
    const ev = d.prepare("INSERT INTO store_events (store_id,product_id,type,old_cents,new_cents,at) VALUES (?,?,?,?,?,?)");
    const emit = (pid: number, type: string, o: number | null, n: number | null) => { if (store.baselined) { ev.run(store.id, pid, type, o, n, now); events++; } };
    const ins = d.prepare(`INSERT INTO store_products (store_id,remote_id,handle,title,vendor,product_type,image,price_cents,compare_at_cents,available,published_at,first_seen_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const upd = d.prepare(`UPDATE store_products SET handle=?,title=?,vendor=?,product_type=?,image=?,price_cents=?,compare_at_cents=?,available=?,published_at=?,last_seen_at=?,removed_at=NULL WHERE id=?`);
    const seen = new Set<string>();
    for (const p of products) {
      seen.add(p.remoteId);
      const ex = existing.get(p.remoteId);
      if (!ex) {
        const r = ins.run(store.id, p.remoteId, p.handle, p.title, p.vendor, p.productType, p.image, p.priceCents, p.compareAtCents, p.available ? 1 : 0, p.publishedAt, now, now);
        emit(Number(r.lastInsertRowid), "new", null, p.priceCents);
        continue;
      }
      upd.run(p.handle, p.title, p.vendor, p.productType, p.image, p.priceCents, p.compareAtCents, p.available ? 1 : 0, p.publishedAt, now, ex.id);
      if (ex.removed_at) emit(ex.id, "relisted", null, p.priceCents);
      if (ex.price_cents !== p.priceCents) emit(ex.id, "price_change", ex.price_cents, p.priceCents);
      if (ex.available && !p.available) emit(ex.id, "sold_out", null, null);
      if (!ex.available && p.available) emit(ex.id, "restocked", null, null);
    }
    if (complete) {
      for (const ex of existing.values()) {
        if (!seen.has(ex.remote_id) && !ex.removed_at) { d.prepare("UPDATE store_products SET removed_at=? WHERE id=?").run(now, ex.id); emit(ex.id, "removed", ex.price_cents, null); }
      }
    }
    const active = (d.prepare("SELECT COUNT(*) c FROM store_products WHERE store_id=? AND removed_at IS NULL").get(store.id) as { c: number }).c;
    d.prepare("UPDATE stores SET last_synced_at=?,last_attempt_at=?,last_error=NULL,baselined=1,product_count=? WHERE id=?").run(now, now, active, store.id);
  })();
  return events;
}

export async function syncStore(store: StoreRow, fetcher?: Fetcher, delayMs?: number): Promise<SyncResult> {
  const d = db();
  try {
    const { products, complete } = await fetchCatalog(store.domain, fetcher, delayMs);
    const events = applyCatalog(d, store, products, complete);
    return { storeId: store.id, domain: store.domain, ok: true, products: products.length, events, complete };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    d.prepare("UPDATE stores SET last_attempt_at=?,last_error=? WHERE id=?").run(new Date().toISOString(), msg, store.id);
    return { storeId: store.id, domain: store.domain, ok: false, error: msg };
  }
}

const g = globalThis as unknown as { __ingestRunning?: boolean };
export const SYNC_INTERVAL_HOURS = 20;

/** Syncs stores that are due (never tried, or last attempted > interval ago), within a time budget. */
export async function runDue(opts: { budgetMs?: number; concurrency?: number; force?: boolean } = {}): Promise<{ skipped?: string; results: SyncResult[] }> {
  if (g.__ingestRunning) return { skipped: "A sync run is already in progress", results: [] };
  g.__ingestRunning = true;
  try {
    const budget = Date.now() + (opts.budgetMs ?? 240_000);
    const cutoff = new Date(Date.now() - SYNC_INTERVAL_HOURS * 3600_000).toISOString();
    const due = db().prepare(`SELECT id,domain,name,baselined,last_attempt_at FROM stores
      WHERE ? OR last_attempt_at IS NULL OR last_attempt_at < ? ORDER BY last_attempt_at IS NOT NULL, last_attempt_at`).all(opts.force ? 1 : 0, cutoff) as StoreRow[];
    const results: SyncResult[] = [];
    const queue = [...due];
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        if (Date.now() > budget) return;
        results.push(await syncStore(s));
      }
    };
    await Promise.all(Array.from({ length: opts.concurrency ?? 3 }, worker));
    return { results };
  } finally { g.__ingestRunning = false; }
}
