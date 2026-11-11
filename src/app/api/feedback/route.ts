import { NextResponse } from "next/server";
import { db } from "@/db";
import { userFeedback } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/feedback — submit user feedback/rating.
 *
 * Body: { rating: 1|2|3|4|5, comment?: string }
 *
 * Returns the submitted feedback record.
 */
export async function POST(request: Request) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const body = await request.json();
    const { rating, comment } = body;

    if (rating == null || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const now = new Date();
    const localDate = now.toISOString().split("T")[0];

    // One feedback per user per day: the unique (userId, localDate) index
    // dedups, and onConflictDoNothing lets us answer with a clean 409.
    const [feedback] = await db
      .insert(userFeedback)
      .values({
        userId: guard.user.id,
        rating,
        comment: comment || "",
        localDate,
      })
      .onConflictDoNothing()
      .returning();

    if (!feedback) {
      return NextResponse.json(
        { error: "You've already submitted feedback today" },
        { status: 409 }
      );
    }

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