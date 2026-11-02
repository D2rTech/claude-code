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
| Analytics | `/dashboard`, `/dashboard/competitors`, `/dashboard/trends`, `/dashboard/ads` | **Free** sees top 3 rows; **Pro** sees everything + "why it works" insights. Gating is enforced server-side (locked rows are masked before they reach the browser). |
| Billing | `/dashboard/billing` | Stripe Checkout subscription ($29/mo) + customer portal |
| Storefront | `/shop`, `/shop/[slug]`, `/cart` | Search, categories, sorting, cookie cart, stock checks |
| Checkout | server action → Stripe Checkout | Order created `pending`, marked `paid` + stock decremented on payment (idempotent) |
| Orders | `/account/orders`, `/admin/orders` | Customers see theirs; admin updates status |
| Admin | `/admin`, `/admin/products` | Summary, low-stock, product create/edit, inventory, active flag |
| Webhook | `POST /api/stripe/webhook` | Signature-verified; handles orders + subscription lifecycle |

### ⚠️ About the analytics data
The competitor / trend / ad data is **seeded demo data** (deterministic, see `lib/seed-data.ts`). There is no live
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
- Analytics data is demo data (see above). No scraping/ingestion pipeline or admin UI for it yet.
- No email (receipts, password reset, verification). Add Resend/Postmark if needed.
- No rate limiting on login/signup; add before public launch (e.g. at your proxy or with Upstash).
- Cancelling/refunding an order in the admin does not restock inventory or refund via Stripe.
- Checkout requires login; shipping address isn't collected.
- Stripe flows were verified with signed test events locally; run through real test-mode payments with your keys before launch.
