import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { stripe, appUrl } from "@/lib/stripe";
import { fulfillOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Stripe success_url lands here: verify payment, fulfil the order (idempotent), clear the cart, then show the result. */
export async function GET(req: Request) {
  const user = await getUser();
  const base = appUrl();
  if (!user) return NextResponse.redirect(`${base}/login`);
  const sid = new URL(req.url).searchParams.get("session_id") ?? "";
  const s = stripe();
  let orderId = 0;
  if (s && sid.startsWith("cs_")) {
    const cs = await s.checkout.sessions.retrieve(sid);
    if (cs.payment_status === "paid" && cs.metadata?.kind === "order") {
      orderId = Number(cs.metadata.order_id);
      fulfillOrder(orderId);
      cookies().set("cart", "{}", { path: "/", maxAge: 0 });
    }
  }
  return NextResponse.redirect(`${base}/checkout/success${orderId ? `?order=${orderId}` : ""}`);
}
