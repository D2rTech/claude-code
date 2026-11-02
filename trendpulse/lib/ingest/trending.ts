import { db } from "../db";

export type TProduct = { id: number; store_id: number; title: string; product_type: string | null; published_at: string | null; first_seen_at: string; available: number };
export type TAd = { store_id: number; text: string; days: number };
export type TEvent = { product_id: number; type: string; at: string };
export type Scored = { productId: number; storeId: number; score: number; reasons: string[]; storesSelling: number };

const DAY = 86400_000;
const STOP = new Set(["the", "and", "with", "for", "set", "kit", "pack", "new", "pro", "mini", "black", "white", "blue", "red", "green", "pink", "gray", "grey", "size", "small", "medium", "large", "of", "in", "a"]);
export const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)));
const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; a.forEach((x) => b.has(x) && i++); return i / (a.size + b.size - i || 1); };

/** Pure scoring so it can be unit-tested. Every point awarded comes with a human-readable reason. */
export function scoreProducts(products: TProduct[], events: TEvent[], ads: TAd[], now = Date.now()): Scored[] {
  const evByProduct = new Map<number, TEvent[]>();
  events.forEach((e) => evByProduct.set(e.product_id, [...(evByProduct.get(e.product_id) ?? []), e]));
  const toks = new Map(products.map((p) => [p.id, tokens(p.title)]));

  // Similar products sold by *other* stores (same product type, title token Jaccard >= 0.75).
  const buckets = new Map<string, TProduct[]>();
  products.forEach((p) => { const k = (p.product_type ?? "").toLowerCase(); buckets.set(k, [...(buckets.get(k) ?? []), p]); });
  const selling = new Map<number, Set<number>>();
  buckets.forEach((list) => {
    const l = list.length > 800 ? list.slice(0, 800) : list;
    for (const p of l) {
      const set = new Set<number>([p.store_id]), tp = toks.get(p.id)!;
      if (tp.size >= 2) for (const q of l) if (q.store_id !== p.store_id && jaccard(tp, toks.get(q.id)!) >= 0.75) set.add(q.store_id);
      selling.set(p.id, set);
    }
  });

  const out: Scored[] = [];
  for (const p of products) {
    let score = 0; const why: string[] = [];
    const launched = p.published_at ? Date.parse(p.published_at) : NaN;
    const evs = evByProduct.get(p.id) ?? [];
    const newEv = evs.find((e) => e.type === "new");
    const age = !Number.isNaN(launched) ? (now - launched) / DAY : newEv ? (now - Date.parse(newEv.at)) / DAY : Infinity;
    if (age <= 14) { score += 25; why.push(`Launched ${Math.max(0, Math.round(age))}d ago`); }
    else if (age <= 30) { score += 12; why.push(`Launched ${Math.round(age)}d ago`); }
    if (evs.some((e) => e.type === "restocked")) { score += 25; why.push("Restocked after selling out"); }
    else if (evs.some((e) => e.type === "sold_out")) { score += 20; why.push("Sold out recently (possible demand)"); }
    const n = selling.get(p.id)?.size ?? 1;
    if (n >= 2) { score += Math.min(n - 1, 3) * 10; why.push(`Similar product at ${n} tracked stores`); }
    const title = p.title.toLowerCase();
    const adMatch = title.length >= 5 ? ads.filter((a) => a.store_id === p.store_id && a.text.includes(title)) : [];
    if (adMatch.length) { const longest = Math.max(...adMatch.map((a) => a.days)); score += 20 + (longest >= 30 ? 10 : 0); why.push(`Advertised (${adMatch.length} active ad${adMatch.length > 1 ? "s" : ""}${longest >= 30 ? `, running ${Math.round(longest)}d` : ""})`); }
    if (score >= 25) out.push({ productId: p.id, storeId: p.store_id, score: Math.min(100, score), reasons: why, storesSelling: n });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 200);
}

export function categoryMomentum(products: TProduct[], now = Date.now()) {
  const m = new Map<string, { recent: number; prev: number; stores: Set<number> }>();
  for (const p of products) {
    const t = p.product_type?.trim().toLowerCase(); if (!t || !p.published_at) continue;
    const age = (now - Date.parse(p.published_at)) / DAY;
    const e = m.get(t) ?? { recent: 0, prev: 0, stores: new Set() };
    if (age >= 0 && age <= 14) { e.recent++; e.stores.add(p.store_id); } else if (age > 14 && age <= 28) e.prev++;
    m.set(t, e);
  }
  return [...m.entries()].filter(([, v]) => v.recent >= 2).map(([type, v]) => ({ type, recent: v.recent, prev: v.prev, stores: v.stores.size }))
    .sort((a, b) => b.recent - b.prev - (a.recent - a.prev)).slice(0, 25);
}

export function runTrending(now = new Date()) {
  const d = db(), t = now.getTime(), iso = now.toISOString();
  const products = d.prepare(`SELECT id,store_id,title,product_type,published_at,first_seen_at,available FROM store_products WHERE removed_at IS NULL`).all() as TProduct[];
  const events = d.prepare("SELECT product_id,type,at FROM store_events WHERE at>=? AND product_id IS NOT NULL").all(new Date(t - 14 * DAY).toISOString()) as TEvent[];
  const ads = (d.prepare("SELECT store_id, lower(coalesce(title,'')||' '||coalesce(body,'')) text, started_at FROM store_ads WHERE active=1").all() as { store_id: number; text: string; started_at: string | null }[])
    .map((a) => ({ store_id: a.store_id, text: a.text, days: a.started_at ? (t - Date.parse(a.started_at)) / DAY : 0 }));
  const scored = scoreProducts(products, events, ads, t);
  const prev = new Map((d.prepare("SELECT product_id, score FROM product_trends").all() as { product_id: number; score: number }[]).map((r) => [r.product_id, r.score]));
  const cats = categoryMomentum(products, t);
  d.transaction(() => {
    d.prepare("DELETE FROM product_trends").run();
    const ins = d.prepare("INSERT INTO product_trends (product_id,store_id,score,prev_score,reasons,stores_selling,computed_at) VALUES (?,?,?,?,?,?,?)");
    scored.forEach((s) => ins.run(s.productId, s.storeId, s.score, prev.get(s.productId) ?? null, JSON.stringify(s.reasons), s.storesSelling, iso));
    d.prepare("DELETE FROM category_trends").run();
    const ic = d.prepare("INSERT INTO category_trends (product_type,launches_recent,launches_prev,stores,computed_at) VALUES (?,?,?,?,?)");
    cats.forEach((c) => ic.run(c.type, c.recent, c.prev, c.stores, iso));
  })();
  return { products: products.length, trending: scored.length, categories: cats.length };
}
