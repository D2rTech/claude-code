"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, getUser, requireAdmin, requireUser } from "@/lib/auth";
import { cartLines, cartTotal, readCart, writeCart } from "@/lib/cart";
import { fulfillOrder } from "@/lib/orders";
import { setPlan } from "@/lib/billing";
import { appUrl, PRO_PRICE_CENTS, stripe } from "@/lib/stripe";

export type FormState = { error?: string } | undefined;
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");

// ---------- auth ----------
const creds = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128) });

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const p = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = db();
  if (d.prepare("SELECT 1 FROM users WHERE email=?").get(p.data.email)) return { error: "An account with that email already exists" };
  const r = d.prepare("INSERT INTO users (email,password_hash) VALUES (?,?)").run(p.data.email, bcrypt.hashSync(p.data.password, 10));
  await createSession(Number(r.lastInsertRowid));
  redirect(safeNext(fd.get("next")));
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const p = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: "Invalid email or password" };
  const u = db().prepare("SELECT id,password_hash FROM users WHERE email=?").get(p.data.email) as { id: number; password_hash: string } | undefined;
  // Compare against a dummy hash when the user is missing to keep timing similar.
  const ok = bcrypt.compareSync(p.data.password, u?.password_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!u || !ok) return { error: "Invalid email or password" };
  await createSession(u.id);
  redirect(safeNext(fd.get("next")));
}

export async function logout() { destroySession(); redirect("/"); }

// ---------- cart ----------
export async function addToCart(fd: FormData) {
  const id = Number(fd.get("productId"));
  const p = db().prepare("SELECT stock FROM products WHERE id=? AND active=1").get(id) as { stock: number } | undefined;
  if (!p) return;
  const cart = readCart();
  cart[id] = Math.min((cart[id] || 0) + 1, p.stock);
  writeCart(cart);
  revalidatePath("/", "layout");
}
export async function setQty(fd: FormData) {
  const id = String(Number(fd.get("productId")));
  const qty = Math.floor(Number(fd.get("qty")));
  const cart = readCart();
  if (qty > 0) cart[id] = qty; else delete cart[id];
  writeCart(cart);
  revalidatePath("/", "layout");
}

// ---------- checkout (shop) ----------
export async function checkout() {
  const user = await requireUser("/cart");
  const lines = cartLines();
  if (!lines.length) redirect("/cart");
  const d = db();
  const total = cartTotal(lines);
  const orderId = d.transaction(() => {
    const r = d.prepare("INSERT INTO orders (user_id,email,total_cents) VALUES (?,?,?)").run(user.id, user.email, total);
    const ins = d.prepare("INSERT INTO order_items (order_id,product_id,name,unit_cents,qty) VALUES (?,?,?,?,?)");
    lines.forEach((l) => ins.run(r.lastInsertRowid, l.product.id, l.product.name, l.product.price_cents, l.qty));
    return Number(r.lastInsertRowid);
  })();

  const s = stripe();
  if (!s) { // demo mode: simulate a successful payment
    fulfillOrder(orderId);
    writeCart({});
    redirect(`/checkout/success?order=${orderId}&demo=1`);
  }
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: lines.map((l) => ({ quantity: l.qty,
      price_data: { currency: "usd", unit_amount: l.product.price_cents, product_data: { name: l.product.name } } })),
    metadata: { order_id: String(orderId), kind: "order" },
    success_url: `${appUrl()}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/cart`,
  });
  d.prepare("UPDATE orders SET stripe_session_id=? WHERE id=?").run(session.id, orderId);
  redirect(session.url!);
}

// ---------- subscription ----------
export async function subscribePro() {
  const user = await requireUser("/dashboard/billing");
  const s = stripe();
  if (!s) { setPlan(user.id, "pro"); revalidatePath("/dashboard", "layout"); redirect("/dashboard/billing?upgraded=1&demo=1"); }
  const price = process.env.STRIPE_PRO_PRICE_ID;
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: user.stripe_customer_id ?? undefined,
    customer_email: user.stripe_customer_id ? undefined : user.email,
    line_items: [price ? { price, quantity: 1 } : { quantity: 1, price_data: { currency: "usd", unit_amount: PRO_PRICE_CENTS,
      recurring: { interval: "month" }, product_data: { name: "TrendPulse Pro" } } }],
    metadata: { user_id: String(user.id), kind: "subscription" },
    subscription_data: { metadata: { user_id: String(user.id) } },
    success_url: `${appUrl()}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function manageBilling() {
  const user = await requireUser("/dashboard/billing");
  const s = stripe();
  if (!s) { setPlan(user.id, "free"); revalidatePath("/dashboard", "layout"); redirect("/dashboard/billing?demo=1"); }
  if (!user.stripe_customer_id) redirect("/dashboard/billing");
  const p = await s.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${appUrl()}/dashboard/billing` });
  redirect(p.url);
}

// ---------- admin ----------
export async function saveProduct(fd: FormData) {
  await requireAdmin();
  const p = z.object({
    id: z.coerce.number().optional(), name: z.string().trim().min(1), description: z.string().default(""),
    price: z.coerce.number().min(0), stock: z.coerce.number().int().min(0),
    category_id: z.coerce.number().int().optional(), image: z.string().trim().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const v = p.data; const cents = Math.round(v.price * 100); const active = fd.get("active") ? 1 : 0;
  const d = db();
  if (v.id) {
    d.prepare("UPDATE products SET name=?,description=?,price_cents=?,stock=?,category_id=?,image=COALESCE(NULLIF(?, ''),image),active=? WHERE id=?")
      .run(v.name, v.description, cents, v.stock, v.category_id ?? null, v.image ?? "", active, v.id);
  } else {
    let slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
    if (d.prepare("SELECT 1 FROM products WHERE slug=?").get(slug)) slug += "-" + Date.now().toString(36);
    d.prepare("INSERT INTO products (slug,name,description,price_cents,stock,category_id,image,active) VALUES (?,?,?,?,?,?,?,?)")
      .run(slug, v.name, v.description, cents, v.stock, v.category_id ?? null, v.image || null, active);
  }
  revalidatePath("/", "layout");
}
export async function setOrderStatus(fd: FormData) {
  await requireAdmin();
  const status = z.enum(["pending", "paid", "shipped", "cancelled", "refunded"]).safeParse(fd.get("status"));
  if (!status.success) return;
  db().prepare("UPDATE orders SET status=? WHERE id=?").run(status.data, Number(fd.get("orderId")));
  revalidatePath("/admin/orders");
}
export async function whoami() { return getUser(); }
