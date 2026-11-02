import Stripe from "stripe";
let client: Stripe | null | undefined;
export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
}
export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const PRO_PRICE_CENTS = 2900;
