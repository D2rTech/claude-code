import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { fulfillOrder } from "@/lib/orders";
import { setPlan } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = stripe();
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !whsec) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", whsec);
  } catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      if (cs.metadata?.kind === "order" && cs.payment_status === "paid") fulfillOrder(Number(cs.metadata.order_id));
      if (cs.metadata?.kind === "subscription") {
        setPlan(Number(cs.metadata.user_id), "pro", cs.customer as string, cs.subscription as string);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(sub.status);
      const u = db().prepare("SELECT id FROM users WHERE stripe_customer_id=?").get(sub.customer as string) as { id: number } | undefined;
      if (u) setPlan(u.id, active ? "pro" : "free", sub.customer as string, sub.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
