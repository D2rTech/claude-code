import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { signup } from "@/app/actions";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Sign up" };

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="signup" action={signup} next={searchParams.next ?? "/dashboard"} />;
}
