import { db } from "./db";
export function setPlan(userId: number, plan: "free" | "pro", customer?: string | null, sub?: string | null) {
  db().prepare("UPDATE users SET plan=?, stripe_customer_id=COALESCE(?,stripe_customer_id), stripe_subscription_id=? WHERE id=?")
    .run(plan, customer ?? null, plan === "pro" ? sub ?? null : null, userId);
}
