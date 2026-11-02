import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

export type User = { id: number; email: string; role: "user" | "admin"; plan: "free" | "pro";
  stripe_customer_id: string | null; stripe_subscription_id: string | null };

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return new TextEncoder().encode(s || "dev-only-insecure-secret-change-me");
};
const COOKIE = "session";

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("14d").sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 14 });
}
export function destroySession() { cookies().delete(COOKIE); }

export async function getUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (db().prepare("SELECT id,email,role,plan,stripe_customer_id,stripe_subscription_id FROM users WHERE id=?")
      .get(payload.uid as number) as User | undefined) ?? null;
  } catch { return null; }
}
export async function requireUser(next = "/dashboard") {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}
export async function requireAdmin() {
  const u = await requireUser("/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}
