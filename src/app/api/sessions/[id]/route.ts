import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studySessions, flashcards, cardProgress } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    const [session] = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.id, sessionId));

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const cards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.sessionId, sessionId))
      .orderBy(flashcards.orderIndex);

    const progress = await db
      .select()
      .from(cardProgress)
      .where(eq(cardProgress.sessionId, sessionId));

    return NextResponse.json({ session, cards, progress });
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    await db.delete(studySessions).where(eq(studySessions.id, sessionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    const body = await request.json();
    const { cardId, isKnown } = body;

    // Upsert card progress
    const existing = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.cardId, cardId),
          eq(cardProgress.sessionId, sessionId)
        )
      );

    if (existing.length > 0) {
      await db
        .update(cardProgress)
        .set({
          isKnown,
          attempts: existing[0].attempts + 1,
          lastReviewedAt: new Date(),
        })
        .where(
          and(
            eq(cardProgress.cardId, cardId),
            eq(cardProgress.sessionId, sessionId)
          )
        );
    } else {
      await db.insert(cardProgress).values({
        cardId,
        sessionId,
        isKnown,
        attempts: 1,
        lastReviewedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
