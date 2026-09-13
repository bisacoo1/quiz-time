import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginPage } from "@/components/login-page";

export const metadata: Metadata = {
  title: "Sign in – QuizTime",
  description: "Sign in to QuizTime to create and study flashcards.",
};

/** Dedicated login route (also used as Auth.js `pages.signIn`). */
export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const { error } = await searchParams;
  return <LoginPage error={error} />;
}
