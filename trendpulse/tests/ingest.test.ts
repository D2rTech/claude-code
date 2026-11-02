import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tp-")), "t.db");
process.env.ADMIN_PASSWORD = "test-password";

import { isPrivateIp, normalizeDomain, fetchText } from "../lib/ingest/net";
import { fetchCatalog, parseProduct, PAGE_SIZE, type ParsedProduct } from "../lib/ingest/shopify";

test("isPrivateIp blocks internal ranges and allows public ones", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.255", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("normalizeDomain accepts public hostnames only", () => {
  assert.equal(normalizeDomain("https://Allbirds.com/products/x?y=1"), "allbirds.com");
  assert.equal(normalizeDomain("shop.example.co.uk"), "shop.example.co.uk");
  for (const bad of ["localhost", "127.0.0.1", "http://169.254.169.254/", "foo.internal", "a.local", "user@evil.com", "evil.com:8080", "[::1]", "", "no_tld", "-bad-.com"])
    assert.equal(normalizeDomain(bad), null, bad);
});

test("fetchText refuses loopback, IP literals, non-https and odd ports", async () => {
  await assert.rejects(fetchText("https://localhost/products.json"), /Blocked|ENOTFOUND|EAI_AGAIN/);
  await assert.rejects(fetchText("https://127.0.0.1/"), /IP-address/);
  await assert.rejects(fetchText("https://[::1]/"), /IP-address/);
  await assert.rejects(fetchText("http://example.com/"), /https/);
  await assert.rejects(fetchText("https://example.com:8443/"), /port 443/);
});

const prod = (id: number, price: string, extra: Record<string, unknown> = {}) => ({
  id, handle: `p-${id}`, title: `Product ${id}`, vendor: "V", product_type: "T", published_at: "2025-01-01T00:00:00Z",
  images: [{ src: "https://cdn.example.com/a.jpg" }], variants: [{ price, compare_at_price: null, available: true }], ...extra,
});

test("parseProduct takes min price, max compare-at, availability; rejects junk", () => {
  const p = parseProduct(prod(1, "20.00", { variants: [{ price: "25.00", compare_at_price: "40.00", available: false }, { price: "19.99", compare_at_price: "30.00", available: false }] }))!;
  assert.equal(p.priceCents, 1999); assert.equal(p.compareAtCents, 4000); assert.equal(p.available, false);
  assert.equal(parseProduct({ id: 1 }), null);
  assert.equal(parseProduct(prod(2, "x")), null);
  assert.equal(parseProduct(prod(3, "5.00", { images: [{ src: "http://insecure/x.jpg" }] }))!.image, null);
});

test("fetchCatalog paginates, dedupes, and flags incomplete results", async () => {
  const pages: Record<number, unknown[]> = { 1: Array.from({ length: PAGE_SIZE }, (_, i) => prod(i + 1, "10.00")), 2: [prod(PAGE_SIZE, "10.00"), prod(9999, "11.00")] };
  const f = async (url: string) => ({ status: 200, body: JSON.stringify({ products: pages[Number(new URL(url).searchParams.get("page"))] ?? [] }) });
  const r = await fetchCatalog("x.com", f, 0);
  assert.equal(r.complete, true); assert.equal(r.products.length, PAGE_SIZE + 1);
  // second page errors -> keep page 1 but mark incomplete
  const flaky = async (url: string) => (url.includes("page=2") ? { status: 429, body: "" } : f(url));
  const r2 = await fetchCatalog("x.com", flaky, 0);
  assert.equal(r2.complete, false); assert.equal(r2.products.length, PAGE_SIZE);
  // first page not Shopify
  await assert.rejects(fetchCatalog("x.com", async () => ({ status: 200, body: "<html>" }), 0), /not JSON/);
  await assert.rejects(fetchCatalog("x.com", async () => ({ status: 404, body: "" }), 0), /No public catalog/);
});

test("applyCatalog: silent baseline, then new / price / sold-out / removed / relisted events", async () => {
  const { db } = await import("../lib/db");
  const { applyCatalog } = await import("../lib/ingest/sync");
  const d = db();
  const id = Number(d.prepare("INSERT INTO stores (domain,name,created_at) VALUES ('t.com','T',?)").run(new Date().toISOString()).lastInsertRowid);
  const row = () => d.prepare("SELECT id,domain,name,baselined,last_attempt_at FROM stores WHERE id=?").get(id) as never;
  const P = (n: number, price: number, available = true): ParsedProduct => ({ remoteId: String(n), handle: `p${n}`, title: `P${n}`, vendor: null, productType: null, image: null, priceCents: price, compareAtCents: null, available, publishedAt: null });
  const types = () => (d.prepare("SELECT type FROM store_events WHERE store_id=? ORDER BY id").all(id) as { type: string }[]).map((e) => e.type);

  assert.equal(applyCatalog(d, row(), [P(1, 1000), P(2, 2000), P(3, 3000)], true, "2025-01-01T00:00:00Z"), 0); // baseline: no events
  assert.deepEqual(types(), []);

  applyCatalog(d, row(), [P(1, 800), P(2, 2000, false), P(4, 500)], true, "2025-01-02T00:00:00Z");
  assert.deepEqual(types().sort(), ["new", "price_change", "removed", "sold_out"]);
  const pc = d.prepare("SELECT old_cents,new_cents FROM store_events WHERE type='price_change'").get() as { old_cents: number; new_cents: number };
  assert.deepEqual(pc, { old_cents: 1000, new_cents: 800 });

  // incomplete fetch must NOT mark missing products removed
  const before = types().length;
  applyCatalog(d, row(), [P(1, 800)], false, "2025-01-03T00:00:00Z");
  assert.equal(types().length, before);

  // idempotent re-run: no duplicate events
  applyCatalog(d, row(), [P(1, 800), P(2, 2000, false), P(4, 500)], true, "2025-01-04T00:00:00Z");
  const removed = (d.prepare("SELECT COUNT(*) c FROM store_events WHERE type='removed'").get() as { c: number }).c;
  assert.equal(removed, 1); // product 3 only once

  // product 3 comes back + product 2 restocked
  applyCatalog(d, row(), [P(1, 800), P(2, 2000), P(3, 3000), P(4, 500)], true, "2025-01-05T00:00:00Z");
  assert.ok(types().includes("relisted") && types().includes("restocked"));
  assert.equal((d.prepare("SELECT product_count c FROM stores WHERE id=?").get(id) as { c: number }).c, 4);
});
