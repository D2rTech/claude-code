import { db } from "../db";
import { fetchText, type Fetcher } from "./net";

export type ParsedAd = { adId: string; platforms: string; body: string | null; title: string | null; caption: string | null;
  snapshotUrl: string | null; startedAt: string | null; stoppedAt: string | null };

export const adsEnabled = () => !!process.env.META_ADS_ACCESS_TOKEN;
const GRAPH = "graph.facebook.com";
const FIELDS = "id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,publisher_platforms";
// The Ad Library API returns ads delivered in the EU/UK (and political ads elsewhere), not ordinary commercial ads in other regions.
export const adCountries = () => (process.env.META_ADS_COUNTRIES || "GB,DE,FR,IT,ES,NL,IE,SE,PL,BE").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

export class AdsFatalError extends Error {} // token problems / rate limits: stop the whole run

const first = (v: unknown, max = 1000) => (Array.isArray(v) && typeof v[0] === "string" ? v[0].slice(0, max) : null);
const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export function parseAd(a: Record<string, unknown>): ParsedAd | null {
  if (typeof a.id !== "string") return null;
  const snap = typeof a.ad_snapshot_url === "string" && /^https:\/\/(www\.)?facebook\.com\//.test(a.ad_snapshot_url) ? a.ad_snapshot_url.replace(/access_token=[^&]*&?/, "").replace(/[?&]$/, "") : null;
  return { adId: a.id, platforms: Array.isArray(a.publisher_platforms) ? a.publisher_platforms.filter((x) => typeof x === "string").join(",") : "",
    body: first(a.ad_creative_bodies), title: first(a.ad_creative_link_titles, 200), caption: first(a.ad_creative_link_captions, 200),
    snapshotUrl: snap, startedAt: iso(a.ad_delivery_start_time) ?? iso(a.ad_creation_time), stoppedAt: iso(a.ad_delivery_stop_time) };
}

/** Precision over recall: keep only ads whose link caption/title/body actually mention the store's domain. */
export function mentionsDomain(ad: ParsedAd, domain: string) {
  const d = domain.replace(/^www\./, "").toLowerCase();
  return [ad.caption, ad.title, ad.body].some((t) => t?.toLowerCase().includes(d));
}

export async function fetchStoreAds(domain: string, fetcher: Fetcher = fetchText, delayMs = 1000): Promise<{ ads: ParsedAd[]; complete: boolean }> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) throw new AdsFatalError("META_ADS_ACCESS_TOKEN is not set");
  const ver = process.env.META_API_VERSION || "v21.0";
  let url: string | null = `https://${GRAPH}/${ver}/ads_archive?` + new URLSearchParams({ search_terms: domain, ad_type: "ALL", ad_active_status: "ALL",
    ad_reached_countries: JSON.stringify(adCountries()), fields: FIELDS, limit: "100", access_token: token });
  const out = new Map<string, ParsedAd>();
  let complete = false;
  for (let page = 0; page < 5 && url; page++) {
    const res = await fetcher(url);
    let json: { data?: unknown[]; paging?: { next?: string }; error?: { message?: string; code?: number } };
    try { json = JSON.parse(res.body); } catch { throw new Error(`Meta API returned non-JSON (HTTP ${res.status})`); }
    if (json.error) {
      const code = json.error.code ?? 0, msg = String(json.error.message ?? "error").replace(token, "***").slice(0, 200);
      if ([190, 102, 4, 17, 32, 613, 10, 200].includes(code)) throw new AdsFatalError(`Meta API: ${msg} (code ${code})`);
      throw new Error(`Meta API: ${msg} (code ${code})`);
    }
    for (const raw of json.data ?? []) { const ad = raw && typeof raw === "object" ? parseAd(raw as Record<string, unknown>) : null; if (ad && mentionsDomain(ad, domain)) out.set(ad.adId, ad); }
    const next = json.paging?.next;
    if (!next) { complete = true; break; }
    try { url = new URL(next).hostname === GRAPH ? next : null; } catch { url = null; }
    if (url) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ads: [...out.values()], complete };
}

export function applyAds(storeId: number, ads: ParsedAd[], complete: boolean, now = new Date().toISOString()) {
  const d = db();
  d.transaction(() => {
    const up = d.prepare(`INSERT INTO store_ads (store_id,ad_id,platforms,body,title,caption,snapshot_url,started_at,stopped_at,active,first_seen_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(ad_id) DO UPDATE SET platforms=excluded.platforms, body=excluded.body, title=excluded.title,
      caption=excluded.caption, snapshot_url=excluded.snapshot_url, started_at=excluded.started_at, stopped_at=excluded.stopped_at, active=excluded.active, last_seen_at=excluded.last_seen_at`);
    for (const a of ads) up.run(storeId, a.adId, a.platforms, a.body, a.title, a.caption, a.snapshotUrl, a.startedAt, a.stoppedAt, a.stoppedAt ? 0 : 1, now, now);
    if (complete) d.prepare("UPDATE store_ads SET active=0 WHERE store_id=? AND last_seen_at<?").run(storeId, now);
    d.prepare(`INSERT INTO store_job_state (store_id,ads_synced_at,ads_attempt_at,ads_error) VALUES (?,?,?,NULL)
      ON CONFLICT(store_id) DO UPDATE SET ads_synced_at=excluded.ads_synced_at, ads_attempt_at=excluded.ads_attempt_at, ads_error=NULL`).run(storeId, now, now);
  })();
}

function markError(storeId: number, msg: string) {
  db().prepare(`INSERT INTO store_job_state (store_id,ads_attempt_at,ads_error) VALUES (?,?,?)
    ON CONFLICT(store_id) DO UPDATE SET ads_attempt_at=excluded.ads_attempt_at, ads_error=excluded.ads_error`).run(storeId, new Date().toISOString(), msg);
}

export type AdsRun = { enabled: boolean; stores: number; ads: number; errors: number; stoppedEarly?: string };

/** Syncs ads for stores whose last attempt is >22h ago. Skips cleanly when no token is configured. */
export async function runAds(opts: { budgetMs?: number; fetcher?: Fetcher; delayMs?: number } = {}): Promise<AdsRun> {
  if (!adsEnabled() && !opts.fetcher) return { enabled: false, stores: 0, ads: 0, errors: 0 };
  const cutoff = new Date(Date.now() - 22 * 3600_000).toISOString();
  const due = db().prepare(`SELECT s.id, s.domain FROM stores s LEFT JOIN store_job_state j ON j.store_id=s.id
    WHERE s.baselined=1 AND (j.ads_attempt_at IS NULL OR j.ads_attempt_at < ?) ORDER BY j.ads_attempt_at IS NOT NULL, j.ads_attempt_at`).all(cutoff) as { id: number; domain: string }[];
  const end = Date.now() + (opts.budgetMs ?? 120_000);
  const run: AdsRun = { enabled: true, stores: 0, ads: 0, errors: 0 };
  for (const s of due) {
    if (Date.now() > end) { run.stoppedEarly = "time budget"; break; }
    try {
      const { ads, complete } = await fetchStoreAds(s.domain, opts.fetcher, opts.delayMs);
      applyAds(s.id, ads, complete);
      run.stores++; run.ads += ads.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      markError(s.id, msg); run.errors++;
      if (e instanceof AdsFatalError) { run.stoppedEarly = msg; break; }
    }
  }
  return run;
}
