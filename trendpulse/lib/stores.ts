import { db } from "./db";
import type { User } from "./auth";
import { FREE_LIMIT, isPro } from "./analytics";

export type StoreSummary = { id: number; domain: string; name: string; niche: string; product_count: number; last_synced_at: string | null;
  last_error: string | null; baselined: number; new_7d: number; price_7d: number; removed_7d: number; locked?: boolean };
export type StoreEvent = { id: number; type: string; old_cents: number | null; new_cents: number | null; at: string; title: string;
  handle: string; image: string | null; price_cents: number };

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

/** Free users get full detail for the first FREE_LIMIT stores; the rest are masked server-side. */
export function listStores(user: User): StoreSummary[] {
  const c = daysAgo(7);
  const rows = db().prepare(`SELECT s.id,s.domain,s.name,s.niche,s.product_count,s.last_synced_at,s.last_error,s.baselined,
    (SELECT COUNT(*) FROM store_events e WHERE e.store_id=s.id AND e.type='new' AND e.at>=?) new_7d,
    (SELECT COUNT(*) FROM store_events e WHERE e.store_id=s.id AND e.type='price_change' AND e.at>=?) price_7d,
    (SELECT COUNT(*) FROM store_events e WHERE e.store_id=s.id AND e.type='removed' AND e.at>=?) removed_7d
    FROM stores s ORDER BY s.id`).all(c, c, c) as StoreSummary[];
  return isPro(user) ? rows : rows.map((r, i) => i < FREE_LIMIT ? r :
    ({ ...r, locked: true, name: "Locked store", domain: "upgrade-to-view", niche: "", product_count: 0, last_synced_at: null, last_error: null, new_7d: 0, price_7d: 0, removed_7d: 0 }));
}

export function storeIsViewable(user: User, id: number) {
  if (isPro(user)) return true;
  const ids = (db().prepare("SELECT id FROM stores ORDER BY id LIMIT ?").all(FREE_LIMIT) as { id: number }[]).map((r) => r.id);
  return ids.includes(id);
}

export function storeEvents(id: number, days = 30): StoreEvent[] {
  return db().prepare(`SELECT e.id,e.type,e.old_cents,e.new_cents,e.at,p.title,p.handle,p.image,p.price_cents
    FROM store_events e JOIN store_products p ON p.id=e.product_id WHERE e.store_id=? AND e.at>=? ORDER BY e.at DESC, e.id DESC LIMIT 150`).all(id, daysAgo(days)) as StoreEvent[];
}
export function storeProducts(id: number) {
  return db().prepare(`SELECT id,title,handle,image,price_cents,compare_at_cents,available,first_seen_at FROM store_products
    WHERE store_id=? AND removed_at IS NULL ORDER BY first_seen_at DESC, id DESC LIMIT 48`).all(id) as
    { id: number; title: string; handle: string; image: string | null; price_cents: number; compare_at_cents: number | null; available: number; first_seen_at: string }[];
}
