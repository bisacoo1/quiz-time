import { NextResponse } from "next/server";
import { auth } from "@/auth";

// The client calls this on load to decide which screen to show
// (setup / sign-in prompt / normal app). Reads env at request time —
// never statically evaluate it.
export const dynamic = "force-dynamic";

export async function GET() {
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  );
  const session = await auth();
  return NextResponse.json({
    hasApiKey,
    signedIn: Boolean(session?.user?.id),
  });
}
