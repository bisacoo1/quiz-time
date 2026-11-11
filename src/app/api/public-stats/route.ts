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
 * - cardsBeingStudied: total number of cards currently due for review (spaced repetition)
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

    // Cards currently being studied (due now in spaced repetition)
    const [studyingResult] = await db
      .select({ count: count() })
      .from(cardReviews)
      .where(sql`${cardReviews.dueAt} <= now()`);

    return NextResponse.json({
      students: Number(studentsResult?.count ?? 0),
      cardsCreated: Number(cardsResult?.count ?? 0),
      cardsBeingStudied: Number(studyingResult?.count ?? 0),
    });
  } catch (error) {
    console.error("GET /api/public-stats error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}