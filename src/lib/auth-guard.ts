import { NextResponse } from "next/server";
import { auth } from "@/auth";

export interface AuthedUser {
  id: string;
  name: string | null;
  image: string | null;
}

export type RequireUserResult =
  | { user: AuthedUser }
  | NextResponse;

/**
 * Guard for API routes: resolves to the signed-in user, or a ready-made
 * 401 response when the request is anonymous.
 *
 *   const guard = await requireUser();
 *   if (guard instanceof NextResponse) return guard;
 *   const user = guard.user;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      user: {
        id: session.user.id,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
      },
    };
  }
  return NextResponse.json(
    { error: "Please sign in to continue" },
    { status: 401 }
  );
}
