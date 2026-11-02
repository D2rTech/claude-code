import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { seedAnalytics, seedProducts } from "./seed-data";

const g = globalThis as unknown as { __db?: Database.Database };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL, image TEXT,
  category_id INTEGER REFERENCES categories(id), stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', total_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL,
  unit_cents INTEGER NOT NULL, qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, domain TEXT NOT NULL, niche TEXT NOT NULL,
  platform TEXT NOT NULL, monthly_visits INTEGER NOT NULL, est_revenue INTEGER NOT NULL,
  product_count INTEGER NOT NULL, active_ads INTEGER NOT NULL, growth_pct REAL NOT NULL,
  traffic_series TEXT NOT NULL, top_channel TEXT NOT NULL, avg_price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT NOT NULL, niche TEXT NOT NULL,
  score INTEGER NOT NULL, growth_pct REAL NOT NULL, avg_price INTEGER NOT NULL,
  stores_selling INTEGER NOT NULL, active_ads INTEGER NOT NULL, series TEXT NOT NULL, why TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL UNIQUE, name TEXT NOT NULL, niche TEXT NOT NULL DEFAULT '',
  added_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL,
  last_synced_at TEXT, last_attempt_at TEXT, last_error TEXT,
  baselined INTEGER NOT NULL DEFAULT 0, product_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS store_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL, handle TEXT NOT NULL, title TEXT NOT NULL, vendor TEXT, product_type TEXT, image TEXT,
  price_cents INTEGER NOT NULL, compare_at_cents INTEGER, available INTEGER NOT NULL DEFAULT 1,
  published_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, removed_at TEXT,
  UNIQUE(store_id, remote_id)
);
CREATE TABLE IF NOT EXISTS store_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES store_products(id) ON DELETE CASCADE,
  type TEXT NOT NULL, old_cents INTEGER, new_cents INTEGER, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_store_at ON store_events(store_id, at);
CREATE TABLE IF NOT EXISTS store_job_state (
  store_id INTEGER PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  ads_synced_at TEXT, ads_attempt_at TEXT, ads_error TEXT,
  monthly_visits INTEGER, visits_source TEXT, visits_updated_at TEXT
);
CREATE TABLE IF NOT EXISTS store_ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL UNIQUE, platforms TEXT, body TEXT, title TEXT, caption TEXT, snapshot_url TEXT,
  started_at TEXT, stopped_at TEXT, active INTEGER NOT NULL DEFAULT 1, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_ads_store ON store_ads(store_id, active);
CREATE TABLE IF NOT EXISTS store_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day TEXT NOT NULL, visits INTEGER NOT NULL, aov_low INTEGER NOT NULL, aov_mid INTEGER NOT NULL, aov_high INTEGER NOT NULL,
  rev_low INTEGER NOT NULL, rev_mid INTEGER NOT NULL, rev_high INTEGER NOT NULL, orders_mid INTEGER NOT NULL, products_used INTEGER NOT NULL,
  UNIQUE(store_id, day)
);
CREATE TABLE IF NOT EXISTS product_trends (
  product_id INTEGER PRIMARY KEY REFERENCES store_products(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL, score INTEGER NOT NULL, prev_score INTEGER, reasons TEXT NOT NULL, stores_selling INTEGER NOT NULL, computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS category_trends (
  product_type TEXT PRIMARY KEY, launches_recent INTEGER NOT NULL, launches_prev INTEGER NOT NULL, stores INTEGER NOT NULL, computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, ok INTEGER, summary TEXT
);
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, competitor_id INTEGER NOT NULL REFERENCES competitors(id),
  platform TEXT NOT NULL, format TEXT NOT NULL, hook TEXT NOT NULL, copy TEXT NOT NULL,
  cta TEXT NOT NULL, days_running INTEGER NOT NULL, est_spend INTEGER NOT NULL, engagement INTEGER NOT NULL
);
`;

export function db(): Database.Database {
  if (g.__db) return g.__db;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  bootstrap(d);
  g.__db = d;
  return d;
}

function bootstrap(d: Database.Database) {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  if (!d.prepare("SELECT 1 FROM users WHERE email=?").get(email)) {
    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD must be set in production");
    d.prepare("INSERT INTO users (email,password_hash,role,plan) VALUES (?,?,?,?)").run(
      email, bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin12345", 10), "admin", "pro");
  }
  if (!d.prepare("SELECT 1 FROM categories LIMIT 1").get()) seedProducts(d);
  if (!d.prepare("SELECT 1 FROM competitors LIMIT 1").get()) seedAnalytics(d);
}
