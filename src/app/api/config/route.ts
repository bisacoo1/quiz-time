import { NextResponse } from "next/server";

// The client calls this on load to decide whether to show the setup screen.
// Reads env at request time — never statically evaluate it.
export const dynamic = "force-dynamic";

export async function GET() {
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  );
  return NextResponse.json({ hasApiKey });
}
