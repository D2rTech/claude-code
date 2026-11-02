# TrendPulse

A lean ecommerce-intelligence SaaS (competitor tracking, trend radar, ad library) with a built-in
storefront (catalog, cart, Stripe checkout, orders, inventory, admin) and a paid **Pro** tier via Stripe.

**Stack:** Next.js 14 (App Router, server actions) · TypeScript · Tailwind · SQLite (`better-sqlite3`) · Stripe · `jose` + `bcryptjs` auth.

> **Origin.** The storefront catalog data, product/collection images and category structure are adapted from
> [chec/commercejs-nextjs-demo-store](https://github.com/chec/commercejs-nextjs-demo-store) (BSD-3-Clause — see
> `THIRD_PARTY_LICENSE_commercejs-demo-store.md`). The original code was *not* carried over: it targets Next 11,
> Redux and the hosted Commerce.js/Chec backend, which can't provide your own auth, subscriptions, inventory or admin.
> All Chec branding has been removed.

## What's in it

| Area | Routes | Notes |
|---|---|---|
| Landing | `/` | Hero, features, pricing, FAQ |
| Auth | `/signup`, `/login` | Email + password (bcrypt), signed HTTP-only JWT cookie |
| Live stores | `/dashboard/stores` | Real Shopify catalog tracking, ads and revenue estimate per store (see below) |
| Trending products | `/dashboard/trending` | Scored from real tracked-store data, with reasons |
| Analytics (demo) | `/dashboard`, `/dashboard/competitors`, `/dashboard/trends`, `/dashboard/ads` | **Free** sees top 3 rows; **Pro** sees everything + "why it works" insights. Gating is enforced server-side (locked rows are masked before they reach the browser). |
| Billing | `/dashboard/billing` | Stripe Checkout subscription ($29/mo) + customer portal |
| Storefront | `/shop`, `/shop/[slug]`, `/cart` | Search, categories, sorting, cookie cart, stock checks |
| Checkout | server action → Stripe Checkout | Order created `pending`, marked `paid` + stock decremented on payment (idempotent) |
| Orders | `/account/orders`, `/admin/orders` | Customers see theirs; admin updates status |
| Admin | `/admin`, `/admin/products` | Summary, low-stock, product create/edit, inventory, active flag |
| Webhook | `POST /api/stripe/webhook` | Signature-verified; handles orders + subscription lifecycle |

### Live data: store tracking (real)
**Live stores** (`/dashboard/stores`) is real. Pro users add a Shopify store domain; a crawler reads its public
`/products.json` about once a day and records **new products, price changes, sell-outs/restocks, removals and relistings**.
The first sync is a silent baseline, so changes show up from the second sync onward.

- Code: `lib/ingest/` (`net.ts` safe fetcher, `shopify.ts` catalog parser, `sync.ts` diff + scheduler), `lib/stores.ts`, `app/api/cron/ingest/route.ts`.
- **Scheduling:** `POST /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET` syncs only stores that are due (>20h since last attempt), within a 4-minute budget. Call it every few hours from anything:
  - GitHub Actions: `.github/workflows/trendpulse-ingest.yml` is included. Add repo secrets `TRENDPULSE_URL` and `CRON_SECRET`.
  - Or any cron: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/ingest`
  - Locally: set `CRON_SECRET` in `.env.local`, add a store in the UI (it syncs immediately), and use the admin "Sync now" link.
- **Safety:** because users supply domains, the fetcher is SSRF-hardened: https/443 only, no IP literals, every DNS answer must be a public address (checked at connect time, so DNS rebinding is blocked), bounded redirects/size/time. Pro users are capped at `MAX_STORES_PER_USER`, the whole tracker at `MAX_STORES`.
- **Limits:** only Shopify stores that leave `/products.json` public (many do; some block it). Up to 10,000 products per store. This shows catalog changes, **not** sales or traffic. A removal or sell-out is a signal, not proof of sales.
- **Legal/ethical:** crawling is a gray area. Read each target's terms, keep the request rate low (the crawler is sequential per store with a delay), send an honest `INGEST_USER_AGENT` with a contact URL, and honor opt-out requests.
- Tests: `npm test` (SSRF guard, parser, pagination, event diffing, ads, estimates, trend scoring).

#### The four jobs
`POST /api/cron/ingest` runs the whole pipeline in order; add `?job=sync|ads|estimates|trending` to run one. Runs are logged and
visible (with "Run now" buttons) at **/admin/jobs**. Each job only does due work, so calling it every few hours is cheap.

| Job | What it does | Needs | Honest limits |
|---|---|---|---|
| `sync` | Crawls due stores' `/products.json`, records new / price / sold-out / restock / removed events | nothing | Shopify stores with a public catalog only |
| `ads` | Pulls each store's ads from the Meta Ad Library API, keeps ads whose caption/title/body mention the store's domain, tracks start date, stop date and **longevity** | `META_ADS_ACCESS_TOKEN` (create a Meta developer app and follow Meta's Ad Library API access steps). Skipped cleanly if unset; a token/rate-limit error stops the run and is shown in the UI and job log | As I understand Meta's policy, the API returns ads delivered in the **EU/UK** plus political ads — **not** ordinary US commercial ads, and it gives no spend/impressions for commercial ads. Many stores will show zero ads. Domain matching favours precision over recall. Not yet verified against the live API. |
| `estimates` | Daily revenue **range** per store: visits × conversion (0.8–3%) × (median price × 1–1.6 items). All constants are in `lib/ingest/estimates.ts` and shown in the UI | A monthly-visits number, entered on the store page by whoever added it (or an admin) | There is no public source for real revenue. This is a rough, assumption-based range and is labelled as such. Plug a traffic provider into `store_job_state.monthly_visits` to automate the input. |
| `trending` | Scores products 0–100 from real signals — recent launch, sell-out/restock, similar product at other tracked stores, active ads naming the product — and lists the reasons; also category launch momentum | The data above | A heuristic, not sales data. Quality scales with the number of stores tracked (the cross-store signal needs overlap), and scores start appearing after stores have synced twice. |

### ⚠️ About the *other* analytics pages
The Competitors / Trends / Ad library pages (labelled "demo" in the app) are **seeded demo data** (deterministic, see `lib/seed-data.ts`). There is no live
scraping. To make it real, write to the `competitors`, `trends` and `ads` tables from your own pipeline
(scrapers, SimilarWeb/Meta Ad Library/other APIs). Schema is in `lib/db.ts`. Revenue/traffic figures are
illustrative; don't present them as real measurements to customers. Also note the "why it works" insights are
simple rule-based heuristics (`adInsight` in `lib/analytics.ts`), not ML.

## Run locally

Requires Node 20+ (tested on 22).

```bash
cd trendpulse
npm install
cp .env.example .env.local      # then edit if you like
npm run dev                     # http://localhost:3000
```

The SQLite DB (`data/app.db`) is created and seeded on first request. Log in as the seeded admin
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `admin@example.com` / `admin12345`) — admins have Pro access and can open `/admin`.
Reset all data by stopping the server and deleting `data/app.db*`.

**Without Stripe keys the app runs in demo mode:** checkout and "Upgrade to Pro" are simulated so you can click through everything.

## Enable Stripe (test mode)

1. Create a Stripe account and stay in **Test mode**. Copy the secret key (`sk_test_…`) into `STRIPE_SECRET_KEY`.
2. Forward webhooks locally with the [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. (Optional) Create a recurring Price in the dashboard and set `STRIPE_PRO_PRICE_ID`; otherwise a $29/mo price is created inline.
4. Enable the **Customer portal** (Settings → Billing → Customer portal) so "Manage subscription" works.
5. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.

Even if a webhook is delayed, the success/return pages verify the Checkout Session directly, so users aren't left waiting.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | **prod** | Long random string used to sign login cookies (`openssl rand -hex 32`) |
| `APP_URL` | yes | Public base URL, used for Stripe redirect URLs (no trailing slash) |
| `DATABASE_PATH` | no | SQLite file path (default `./data/app.db`). Point at a persistent volume in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | **prod** (password) | Admin account created on first start |
| `STRIPE_SECRET_KEY` | no | Enables real payments; blank = demo mode |
| `STRIPE_WEBHOOK_SECRET` | with Stripe | Signing secret for `/api/stripe/webhook` |
| `STRIPE_PRO_PRICE_ID` | no | Existing recurring Price ID for Pro |
| `CRON_SECRET` | for ingestion | Bearer token for `/api/cron/ingest` (endpoint returns 503 if unset) |
| `INGEST_USER_AGENT`, `MAX_STORES`, `MAX_STORES_PER_USER` | no | Crawler identity and caps |

In production the app refuses to start without `SESSION_SECRET` and `ADMIN_PASSWORD`.

## Deploy

SQLite is a single file, so deploy to a host with a **persistent disk** and **one instance**. (Vercel/serverless
won't work as-is — see "Scaling" below.) A `Dockerfile` and `fly.toml` are included.

### Fly.io (recommended)
```bash
cd trendpulse
fly launch --no-deploy --copy-config          # pick an app name; keep the generated fly.toml settings
fly volumes create data --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD='a-strong-password' \
  APP_URL=https://<your-app>.fly.dev STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
fly deploy
```
Then in Stripe → Developers → Webhooks add endpoint `https://<your-app>.fly.dev/api/stripe/webhook` with events
`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and use its signing secret.

### Railway / Render / any Docker host
Deploy the `Dockerfile`, attach a volume mounted at `/data`, set the env vars above (`DATABASE_PATH=/data/app.db` is the image default), expose port 3000.

### Going live
Swap to live Stripe keys and a live webhook endpoint, set a real domain in `APP_URL`, back up the volume (`/data`),
and change the admin password.

### Scaling
For multiple instances or serverless, replace `lib/db.ts` with Postgres (Neon/Supabase/RDS). All SQL lives in `lib/*` and
`app/**` as plain prepared statements, so the swap is mechanical.

## Project layout
```
app/            routes (pages, server actions in actions.ts, Stripe webhook)
components/     Nav, charts, auth form, product card, paywall bits
lib/            db + schema, seed data, auth, cart, orders, billing, analytics queries
public/         product & collection images (from the Chec demo store)
```

## Known limitations (MVP)
- Competitors/Trends/Ads pages are still demo data. Only "Live stores" is real, and the crawler has been tested against Shopify's documented JSON format and mocks but **not yet against live stores** (it was built in a network-restricted sandbox). Add one real store and check it before relying on it.
- Ads, traffic and revenue data have no ingestion yet.
- No email (receipts, password reset, verification). Add Resend/Postmark if needed.
- No rate limiting on login/signup; add before public launch (e.g. at your proxy or with Upstash).
- Cancelling/refunding an order in the admin does not restock inventory or refund via Stripe.
- Checkout requires login; shipping address isn't collected.
- Stripe flows were verified with signed test events locally; run through real test-mode payments with your keys before launch.
