import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFeedback } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/feedback — submit user feedback/rating.
 *
 * Body: { rating: 1|2|3|4|5, comment?: string }
 *
 * Returns the submitted feedback record.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rating, comment } = body;

    if (rating == null || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Get the current user's session - we'll use a simple approach
    // In production, you'd check the auth session properly
    const now = new Date();
    const localDate = now.toISOString().split("T")[0];

    // Check if user already submitted feedback today
    // We'll use a simple insert; the unique DB constraint will handle dedup
    const [feedback] = await db
      .insert(userFeedback)
      .values({
        rating,
        comment: comment || "",
        localDate,
      })
      .returning();

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback — get aggregated feedback stats.
 *
 * Returns average rating and total count.
 */
export async function GET() {
  try {
    // Get all feedback from the last 30 days
    const feedbacks = await db
      .select({
        rating: userFeedback.rating,
      })
      .from(userFeedback)
      .where(
        sql`${userFeedback.createdAt} >= now() - interval '30 days'`
      );

    const total = feedbacks.length;
    if (total === 0) {
      return NextResponse.json({
        averageRating: 0,
        totalFeedback: 0,
        message: "No feedback yet",
      });
    }

    const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    const averageRating = (sum / total).toFixed(1);

    return NextResponse.json({
      averageRating,
      totalFeedback: total,
    });
  } catch (error) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback stats" },
      { status: 500 }
    );
  }
}