import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studySessions, flashcards, cardProgress } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth-guard";

/**
 * Load a session only if it belongs to the signed-in user.
 * Returns [null, errorResponse] when missing or not owned, so a foreign
 * deck is indistinguishable from a nonexistent one.
 */
async function loadOwnedSession(
  sessionId: number,
  userId: string
): Promise<[typeof studySessions.$inferSelect | null, NextResponse | null]> {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.id, sessionId));

  if (!session || session.userId !== userId) {
    return [null, NextResponse.json({ error: "Session not found" }, { status: 404 })];
  }
  return [session, null];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const [session, notFound] = await loadOwnedSession(sessionId, guard.user.id);
    if (notFound) return notFound;
    // Unreachable at runtime (a null session always comes with a 404),
    // but required so the handler's return type stays Response.
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const [cards, progress] = await Promise.all([
      db
        .select()
        .from(flashcards)
        .where(eq(flashcards.sessionId, sessionId))
        .orderBy(flashcards.orderIndex),
      db
        .select()
        .from(cardProgress)
        .where(eq(cardProgress.sessionId, sessionId)),
    ]);

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
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const [, notFound] = await loadOwnedSession(sessionId, guard.user.id);
    if (notFound) return notFound;

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
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const [, notFound] = await loadOwnedSession(sessionId, guard.user.id);
    if (notFound) return notFound;

    const body = await request.json();
    const { cardId, isKnown } = body;

    if (!Number.isInteger(cardId) || typeof isKnown !== "boolean") {
      return NextResponse.json(
        { error: "cardId (integer) and isKnown (boolean) are required" },
        { status: 400 }
      );
    }

    // The card must belong to this session — otherwise progress would be
    // written with a mismatched session id.
    const [card] = await db
      .select({ sessionId: flashcards.sessionId })
      .from(flashcards)
      .where(eq(flashcards.id, cardId));

    if (!card || card.sessionId !== sessionId) {
      return NextResponse.json({ error: "Card not found in this session" }, { status: 404 });
    }

    // Atomic upsert — one row per (card, session), guaranteed by the
    // card_progress_card_session_key unique index.
    await db
      .insert(cardProgress)
      .values({
        cardId,
        sessionId,
        isKnown,
        attempts: 1,
        lastReviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [cardProgress.cardId, cardProgress.sessionId],
        set: {
          isKnown,
          attempts: sql`${cardProgress.attempts} + 1`,
          lastReviewedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
