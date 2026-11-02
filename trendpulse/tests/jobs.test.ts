import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tp2-")), "t.db");
process.env.ADMIN_PASSWORD = "test-password";
process.env.META_ADS_ACCESS_TOKEN = "TOKEN123";

import { parseAd, mentionsDomain, fetchStoreAds, runAds, AdsFatalError } from "../lib/ingest/ads";
import { computeEstimate } from "../lib/ingest/estimates";
import { scoreProducts, categoryMomentum, type TProduct } from "../lib/ingest/trending";

const rawAd = (id: string, extra: Record<string, unknown> = {}) => ({ id, ad_delivery_start_time: "2025-01-01", ad_creative_bodies: ["Shop now at sneakers.com"],
  ad_creative_link_captions: ["sneakers.com"], publisher_platforms: ["facebook", "instagram"], ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=1&access_token=SECRET", ...extra });

test("parseAd normalises fields and strips access tokens from snapshot URLs", () => {
  const a = parseAd(rawAd("1"))!;
  assert.equal(a.platforms, "facebook,instagram"); assert.equal(a.startedAt, "2025-01-01T00:00:00.000Z");
  assert.ok(!a.snapshotUrl!.includes("SECRET"));
  assert.equal(parseAd(rawAd("2", { ad_snapshot_url: "https://evil.com/x" }))!.snapshotUrl, null);
  assert.equal(parseAd({ nope: 1 }), null);
});

test("mentionsDomain keeps only ads that reference the store's domain", () => {
  assert.equal(mentionsDomain(parseAd(rawAd("1"))!, "www.sneakers.com"), true);
  assert.equal(mentionsDomain(parseAd(rawAd("2", { ad_creative_bodies: ["x"], ad_creative_link_captions: ["other.com"] }))!, "sneakers.com"), false);
});

test("fetchStoreAds paginates only to graph.facebook.com, filters, and never leaks the token in errors", async () => {
  const calls: string[] = [];
  const f = async (url: string) => {
    calls.push(url);
    if (calls.length === 1) return { status: 200, body: JSON.stringify({ data: [rawAd("1"), rawAd("2", { ad_creative_link_captions: ["unrelated.com"], ad_creative_bodies: ["x"] })], paging: { next: "https://graph.facebook.com/v21.0/ads_archive?page=2" } }) };
    return { status: 200, body: JSON.stringify({ data: [rawAd("3")], paging: { next: "https://evil.example.com/steal" } }) };
  };
  const r = await fetchStoreAds("sneakers.com", f, 0);
  assert.deepEqual(r.ads.map((a) => a.adId).sort(), ["1", "3"]);
  assert.equal(r.complete, false); // stopped at the untrusted next-link
  assert.ok(calls.every((u) => new URL(u).hostname === "graph.facebook.com"));
  await assert.rejects(fetchStoreAds("a.com", async () => ({ status: 400, body: JSON.stringify({ error: { code: 190, message: "Invalid token TOKEN123" } }) }), 0),
    (e: Error) => e instanceof AdsFatalError && !e.message.includes("TOKEN123"));
  await assert.rejects(fetchStoreAds("a.com", async () => ({ status: 400, body: JSON.stringify({ error: { code: 100, message: "bad param" } }) }), 0), (e: Error) => !(e instanceof AdsFatalError));
});

test("runAds stores ads, marks vanished ads inactive, and stops the run on a fatal token error", async () => {
  const { db } = await import("../lib/db");
  const d = db(), now = new Date().toISOString();
  const mk = (dom: string) => Number(d.prepare("INSERT INTO stores (domain,name,created_at,baselined) VALUES (?,?,?,1)").run(dom, dom, now).lastInsertRowid);
  const a = mk("sneakers.com"), b = mk("b.com");
  let phase = 1;
  const f = async (url: string) => {
    if (phase === 3) return { status: 400, body: JSON.stringify({ error: { code: 190, message: "expired" } }) };
    const q = new URL(url).searchParams.get("search_terms");
    if (q === "sneakers.com") return { status: 200, body: JSON.stringify({ data: phase === 1 ? [rawAd("1"), rawAd("2")] : [rawAd("1")] }) };
    return { status: 200, body: JSON.stringify({ data: [] }) };
  };
  let r = await runAds({ fetcher: f, delayMs: 0 });
  assert.equal(r.stores, 2); assert.equal(r.ads, 2);
  assert.equal((d.prepare("SELECT COUNT(*) c FROM store_ads WHERE store_id=? AND active=1").get(a) as { c: number }).c, 2);
  // force due again; ad 2 disappears
  d.prepare("UPDATE store_job_state SET ads_attempt_at='2000-01-01T00:00:00Z'").run(); phase = 2;
  await new Promise((r) => setTimeout(r, 5));
  r = await runAds({ fetcher: f, delayMs: 0 });
  assert.equal((d.prepare("SELECT COUNT(*) c FROM store_ads WHERE store_id=? AND active=1").get(a) as { c: number }).c, 1);
  // fatal error: first store records error, second is never attempted
  d.prepare("UPDATE store_job_state SET ads_attempt_at='2000-01-01T00:00:00Z'").run(); phase = 3;
  r = await runAds({ fetcher: f, delayMs: 0 });
  assert.equal(r.errors, 1); assert.ok(r.stoppedEarly);
  assert.ok((d.prepare("SELECT ads_error FROM store_job_state WHERE store_id=? OR store_id=? ORDER BY ads_error DESC").get(a, b) as { ads_error: string }).ads_error.includes("expired"));
  delete process.env.META_ADS_ACCESS_TOKEN;
  assert.equal((await runAds()).enabled, false);
});

test("computeEstimate: documented math, ordered range, null without inputs", () => {
  const e = computeEstimate(10_000, [2000, 4000, 6000])!; // median $40
  assert.equal(e.aovMid, 5000);                           // 40 × 1.25
  assert.equal(e.revMid, Math.round((10_000 * 0.015 * 5000) / 100)); // $7,500
  assert.equal(e.revMid, 7500);
  assert.ok(e.revLow < e.revMid && e.revMid < e.revHigh);
  assert.equal(computeEstimate(null, [1000]), null); assert.equal(computeEstimate(500, []), null); assert.equal(computeEstimate(0, [1000]), null);
});

const NOW = Date.parse("2025-06-30T00:00:00Z"), ago = (d: number) => new Date(NOW - d * 86400_000).toISOString();
const P = (id: number, store: number, title: string, type: string, pub: string | null): TProduct => ({ id, store_id: store, title, product_type: type, published_at: pub, first_seen_at: ago(60), available: 1 });

test("scoreProducts: explains every point; ignores old, quiet products; cross-store and ad signals count", () => {
  const products = [
    P(1, 1, "Portable Neck Fan", "Gadgets", ago(5)),      // new + at 2 stores + sold out + advertised
    P(2, 2, "Portable Neck Fan Deluxe", "Gadgets", ago(90)),
    P(3, 1, "Old Mug", "Home", ago(200)),                  // nothing going on
    P(4, 1, "Fresh Lamp", "Home", ago(20)),                // launched 20d ago only (12) -> below threshold
  ];
  const events = [{ product_id: 1, type: "sold_out", at: ago(2) }];
  const ads = [{ store_id: 1, text: "get the portable neck fan today", days: 45 }];
  const s = scoreProducts(products, events, ads, NOW);
  const top = s.find((x) => x.productId === 1)!;
  assert.equal(top.score, 25 + 20 + 10 + 30);             // launch + sold-out + 1 other store + advertised 30d+
  assert.equal(top.storesSelling, 2); assert.equal(top.reasons.length, 4);
  assert.ok(!s.find((x) => x.productId === 3) && !s.find((x) => x.productId === 4));
  assert.equal(s[0].productId, 1);
});

test("categoryMomentum needs >=2 recent launches and ranks by growth", () => {
  const ps = [P(1, 1, "a x", "Gadgets", ago(2)), P(2, 2, "b x", "Gadgets", ago(5)), P(3, 1, "c x", "Gadgets", ago(20)),
    P(4, 1, "d x", "Home", ago(1)), P(5, 1, "e x", "Pets", ago(1)), P(6, 2, "f x", "Pets", ago(2)), P(7, 2, "g x", "Pets", ago(3))];
  const c = categoryMomentum(ps, NOW);
  assert.deepEqual(c.map((x) => x.type), ["pets", "gadgets"]); assert.equal(c[0].recent, 3);
});
