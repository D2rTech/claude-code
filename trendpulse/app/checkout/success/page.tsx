import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function Success({ searchParams }: { searchParams: { order?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const orderId = Number(searchParams.order) || 0;
  const order = db().prepare("SELECT id,status,total_cents FROM orders WHERE id=? AND user_id=?").get(orderId, user.id) as { id: number; status: string } | undefined;
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{order?.status === "paid" ? "Thank you! 🎉" : "Processing your order…"}</h1>
      <p className="mt-3 text-slate-600">{order ? `Order #${order.id} is ${order.status}.` : "We couldn't find that order."}</p>
      <Link href="/account/orders" className="btn-primary mt-8">View my orders</Link>
    </div>
  );
}
