import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, studySessions, flashcards, cardReviews } from "@/db/schema";
import { count, sql } from "drizzle-orm";

/**
 * GET /api/public-stats — public aggregate statistics for the landing page.
 *
 * No authentication required. Returns:
 * - students: total number of registered users
 * - cardsCreated: total number of flashcards across all users
 * - cardsBeingStudied: total number of cards in spaced repetition (tracked + due now)
 */
export async function GET() {
  try {
    // Total students (users)
    const [studentsResult] = await db
      .select({ count: count() })
      .from(users);

    // Total cards created
    const [cardsResult] = await db
      .select({ count: count() })
      .from(flashcards);

    // Cards in spaced repetition (tracked + currently due)
    const [studyingResult] = await db
      .select({
        tracked: sql<number>`count(*)::int`,
        dueNow: sql<number>`count(*) filter (where ${cardReviews.dueAt} <= now())::int`,
      })
      .from(cardReviews);

    // Use total tracked cards as "being studied" - more meaningful for landing page
    const tracked = Number(studyingResult?.tracked ?? 0);
    const dueNow = Number(studyingResult?.dueNow ?? 0);

    return NextResponse.json({
      students: Number(studentsResult?.count ?? 0),
      cardsCreated: Number(cardsResult?.count ?? 0),
      cardsBeingStudied: tracked, // total cards in spaced repetition system
      cardsDueNow: dueNow, // subset that are due right now
    });
  } catch (error) {
    console.error("GET /api/public-stats error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}