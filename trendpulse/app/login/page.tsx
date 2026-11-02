import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { login } from "@/app/actions";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="login" action={login} next={searchParams.next ?? "/dashboard"} />;
}
