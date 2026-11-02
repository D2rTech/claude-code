import { db } from "../db";

/** Transparent, assumption-based model. Every constant is exposed so the UI can show it. */
export const ASSUMPTIONS = {
  conversion: { low: 0.008, mid: 0.015, high: 0.03 },   // ecommerce visit→order rates (typical industry range ~1–3%)
  itemsPerOrder: { low: 1.0, mid: 1.25, high: 1.6 },
};

export type Estimate = { visits: number; aovLow: number; aovMid: number; aovHigh: number; revLow: number; revMid: number; revHigh: number; ordersMid: number; productsUsed: number };

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** revenue = visits × conversion × (median product price × items per order). Returns null without visits or priced products. */
export function computeEstimate(visits: number | null, pricesCents: number[]): Estimate | null {
  if (!visits || visits <= 0 || pricesCents.length === 0) return null;
  const p = median(pricesCents), A = ASSUMPTIONS;
  const aov = (k: "low" | "mid" | "high") => Math.round(p * A.itemsPerOrder[k]);
  const rev = (k: "low" | "mid" | "high") => Math.round((visits * A.conversion[k] * aov(k)) / 100); // dollars
  return { visits, aovLow: aov("low"), aovMid: aov("mid"), aovHigh: aov("high"), revLow: rev("low"), revMid: rev("mid"), revHigh: rev("high"),
    ordersMid: Math.round(visits * A.conversion.mid), productsUsed: pricesCents.length };
}

export function runEstimates(now = new Date()) {
  const d = db(), day = now.toISOString().slice(0, 10);
  const stores = d.prepare("SELECT store_id, monthly_visits FROM store_job_state WHERE monthly_visits IS NOT NULL").all() as { store_id: number; monthly_visits: number }[];
  const up = d.prepare(`INSERT INTO store_estimates (store_id,day,visits,aov_low,aov_mid,aov_high,rev_low,rev_mid,rev_high,orders_mid,products_used)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(store_id,day) DO UPDATE SET visits=excluded.visits,aov_low=excluded.aov_low,aov_mid=excluded.aov_mid,aov_high=excluded.aov_high,
    rev_low=excluded.rev_low,rev_mid=excluded.rev_mid,rev_high=excluded.rev_high,orders_mid=excluded.orders_mid,products_used=excluded.products_used`);
  let n = 0;
  for (const s of stores) {
    const prices = (d.prepare("SELECT price_cents FROM store_products WHERE store_id=? AND removed_at IS NULL AND available=1 AND price_cents>0").all(s.store_id) as { price_cents: number }[]).map((r) => r.price_cents);
    const e = computeEstimate(s.monthly_visits, prices);
    if (e) { up.run(s.store_id, day, e.visits, e.aovLow, e.aovMid, e.aovHigh, e.revLow, e.revMid, e.revHigh, e.ordersMid, e.productsUsed); n++; }
  }
  return { stores: stores.length, estimated: n };
}

export function latestEstimate(storeId: number) {
  return db().prepare("SELECT * FROM store_estimates WHERE store_id=? ORDER BY day DESC LIMIT 1").get(storeId) as
    { day: string; visits: number; aov_low: number; aov_mid: number; aov_high: number; rev_low: number; rev_mid: number; rev_high: number; orders_mid: number; products_used: number } | undefined;
}
