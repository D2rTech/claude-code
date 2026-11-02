import { fetchText, type Fetcher } from "./net";

export type ParsedProduct = {
  remoteId: string; handle: string; title: string; vendor: string | null; productType: string | null; image: string | null;
  priceCents: number; compareAtCents: number | null; available: boolean; publishedAt: string | null;
};
export const PAGE_SIZE = 250;
export const MAX_PAGES = 40; // 10,000 products per store

const cents = (v: unknown) => { const n = Math.round(parseFloat(String(v)) * 100); return Number.isFinite(n) && n >= 0 ? n : null; };
const str = (v: unknown, max = 300) => (typeof v === "string" && v ? v.slice(0, max) : null);

export function parseProduct(p: Record<string, unknown>): ParsedProduct | null {
  const variants = Array.isArray(p.variants) ? (p.variants as Record<string, unknown>[]) : [];
  const prices = variants.map((v) => cents(v.price)).filter((x): x is number => x !== null);
  if (p.id == null || !str(p.handle) || !str(p.title) || !prices.length) return null;
  const compare = variants.map((v) => cents(v.compare_at_price)).filter((x): x is number => !!x);
  const img = Array.isArray(p.images) && p.images[0] ? str((p.images[0] as Record<string, unknown>).src, 600) : null;
  return {
    remoteId: String(p.id), handle: str(p.handle)!, title: str(p.title)!, vendor: str(p.vendor, 120), productType: str(p.product_type, 120),
    image: img && img.startsWith("https://") ? img : null, priceCents: Math.min(...prices),
    compareAtCents: compare.length ? Math.max(...compare) : null,
    available: variants.length ? variants.some((v) => v.available !== false) : true, publishedAt: str(p.published_at, 40),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Downloads a store's public catalog. `complete` is false if we stopped early (so callers must not infer removals). */
export async function fetchCatalog(domain: string, fetcher: Fetcher = fetchText, delayMs = 500): Promise<{ products: ParsedProduct[]; complete: boolean }> {
  const seen = new Map<string, ParsedProduct>();
  let complete = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res;
    try { res = await fetcher(`https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`); }
    catch (e) { if (page === 1) throw e; break; }
    if (res.status !== 200) {
      if (page === 1) throw new Error(res.status === 404 || res.status === 403 ? `No public catalog (HTTP ${res.status}) — store may not be Shopify or blocks products.json` : `HTTP ${res.status}`);
      break;
    }
    let json: { products?: unknown };
    try { json = JSON.parse(res.body); } catch { if (page === 1) throw new Error("Response was not JSON — not a Shopify catalog"); break; }
    if (!Array.isArray(json.products)) { if (page === 1) throw new Error("Unexpected response shape — not a Shopify catalog"); break; }
    for (const raw of json.products) { const p = raw && typeof raw === "object" ? parseProduct(raw as Record<string, unknown>) : null; if (p) seen.set(p.remoteId, p); }
    if (json.products.length < PAGE_SIZE) { complete = true; break; }
    if (page < MAX_PAGES) await sleep(delayMs);
  }
  return { products: [...seen.values()], complete };
}
