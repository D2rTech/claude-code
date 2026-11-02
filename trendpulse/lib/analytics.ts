import { db } from "./db";
import type { User } from "./auth";

export const FREE_LIMIT = 3;
export type Competitor = { id: number; name: string; domain: string; niche: string; platform: string; monthly_visits: number;
  est_revenue: number; product_count: number; active_ads: number; growth_pct: number; traffic_series: string; top_channel: string; avg_price: number };
export type Trend = { id: number; product: string; niche: string; score: number; growth_pct: number; avg_price: number;
  stores_selling: number; active_ads: number; series: string; why: string };
export type Ad = { id: number; competitor_id: number; competitor: string; niche: string; platform: string; format: string; hook: string;
  copy: string; cta: string; days_running: number; est_spend: number; engagement: number };

export const isPro = (u: User) => u.plan === "pro" || u.role === "admin";

// Free-plan gating happens server-side: locked rows are replaced with placeholders so real data never reaches the browser.
export type Locked<T> = T & { locked?: boolean };
const SERIES = JSON.stringify([5, 6, 7, 6, 8, 9, 8, 10, 11, 10, 12, 13]);
const maskC = (c: Competitor): Locked<Competitor> => ({ ...c, locked: true, name: "Locked store", domain: "upgrade-to-view.com", niche: "••••",
  monthly_visits: 100000, est_revenue: 100000, growth_pct: 0, top_channel: "••••", traffic_series: SERIES });
const maskT = (t: Trend): Locked<Trend> => ({ ...t, locked: true, product: "Locked product", niche: "••••", score: 80, growth_pct: 50,
  avg_price: 25, stores_selling: 100, active_ads: 50, series: SERIES, why: "Upgrade to Pro to see why this product is trending." });
const maskA = (a: Ad): Locked<Ad> => ({ ...a, locked: true, competitor: "Locked store", niche: "••••", hook: "Upgrade to Pro to read this ad",
  copy: "The full ad copy and creative analysis are available on the Pro plan.", cta: "••••", days_running: 10, est_spend: 1000, engagement: 1000 });

export function competitors(user?: User): Locked<Competitor>[] {
  const rows = db().prepare("SELECT * FROM competitors ORDER BY est_revenue DESC").all() as Competitor[];
  return user && !isPro(user) ? rows.map((c, i) => (i >= FREE_LIMIT ? maskC(c) : c)) : rows;
}
export function trends(user?: User): Locked<Trend>[] {
  const rows = db().prepare("SELECT * FROM trends ORDER BY score DESC").all() as Trend[];
  return user && !isPro(user) ? rows.map((t, i) => (i >= FREE_LIMIT ? maskT(t) : t)) : rows;
}
export function ads(platform?: string, user?: User): Locked<Ad>[] {
  const rows = rawAds(platform);
  return user && !isPro(user) ? rows.map((a, i) => (i >= FREE_LIMIT ? maskA(a) : a)) : rows;
}
function rawAds(platform?: string): Ad[] {
  const q = `SELECT a.*, c.name AS competitor, c.niche FROM ads a JOIN competitors c ON c.id=a.competitor_id
    ${platform ? "WHERE a.platform = ?" : ""} ORDER BY a.days_running DESC`;
  return (platform ? db().prepare(q).all(platform) : db().prepare(q).all()) as Ad[];
}

/** Simple, explainable heuristic used for the "why it works" insight. */
export function adInsight(a: Ad): string {
  const parts: string[] = [];
  if (a.days_running >= 60) parts.push(`Running ${a.days_running} days — advertisers rarely fund losers this long, so it's likely profitable.`);
  else if (a.days_running >= 30) parts.push(`Survived ${a.days_running} days of testing — a promising winner.`);
  else parts.push("Still in testing — watch whether it passes 30 days.");
  if (/UGC|testimon|believe|switched/i.test(a.hook + a.copy)) parts.push("Leans on social proof / UGC to build trust.");
  if (/\$\d+|save|%/i.test(a.hook + a.copy)) parts.push("Uses a price or discount anchor.");
  if (/last chance|limited|urgency/i.test(a.hook + a.copy)) parts.push("Creates urgency with scarcity.");
  if (/second|watch|stop scrolling/i.test(a.hook + a.copy)) parts.push("Pattern-interrupt hook for short-form feeds.");
  return parts.join(" ");
}
