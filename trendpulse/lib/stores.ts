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

export type TrendRow = { product_id: number; store_id: number; score: number; prev_score: number | null; reasons: string; stores_selling: number;
  title: string; image: string | null; price_cents: number; handle: string; domain: string; store_name: string; locked?: boolean };

/** Free users see the top FREE_LIMIT rows; the rest are masked server-side. */
export function listTrending(user: User): TrendRow[] {
  const rows = db().prepare(`SELECT t.product_id,t.store_id,t.score,t.prev_score,t.reasons,t.stores_selling,p.title,p.image,p.price_cents,p.handle,s.domain,s.name store_name
    FROM product_trends t JOIN store_products p ON p.id=t.product_id JOIN stores s ON s.id=t.store_id ORDER BY t.score DESC, t.product_id LIMIT 30`).all() as TrendRow[];
  return isPro(user) ? rows : rows.map((r, i) => i < FREE_LIMIT ? r : ({ ...r, locked: true, title: "Locked product", image: null, price_cents: 0, handle: "", domain: "upgrade-to-view", store_name: "Locked", reasons: "[]", score: 50, prev_score: null, stores_selling: 1 }));
}
export const listCategoryTrends = () => db().prepare("SELECT product_type,launches_recent,launches_prev,stores FROM category_trends ORDER BY launches_recent-launches_prev DESC LIMIT 10").all() as
  { product_type: string; launches_recent: number; launches_prev: number; stores: number }[];
export const trendingComputedAt = () => (db().prepare("SELECT MAX(computed_at) c FROM product_trends").get() as { c: string | null }).c;

export type AdRow = { ad_id: string; platforms: string | null; body: string | null; title: string | null; snapshot_url: string | null; started_at: string | null; stopped_at: string | null; active: number };
export const storeAds = (id: number) => db().prepare("SELECT ad_id,platforms,body,title,snapshot_url,started_at,stopped_at,active FROM store_ads WHERE store_id=? ORDER BY active DESC, started_at ASC LIMIT 30").all(id) as AdRow[];
export const storeJobState = (id: number) => db().prepare("SELECT ads_synced_at,ads_error,monthly_visits,visits_source FROM store_job_state WHERE store_id=?").get(id) as
  { ads_synced_at: string | null; ads_error: string | null; monthly_visits: number | null; visits_source: string | null } | undefined;
