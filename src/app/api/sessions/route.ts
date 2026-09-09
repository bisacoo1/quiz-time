import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studySessions, flashcards } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const sessions = await db
      .select()
      .from(studySessions)
      .orderBy(desc(studySessions.createdAt));

    // Get card counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const cards = await db
          .select()
          .from(flashcards)
          .where(eq(flashcards.sessionId, session.id));
        return {
          ...session,
          cardCount: cards.length,
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithCounts });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, sourceType, sourceText, cards } = body;

    if (!title || !cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [session] = await db
      .insert(studySessions)
      .values({
        title,
        sourceType: sourceType || "text",
        sourceText: sourceText || null,
      })
      .returning();

    const cardValues = cards.map((card: { question: string; answer: string; hint?: string; difficulty?: string }, idx: number) => ({
      sessionId: session.id,
      question: card.question,
      answer: card.answer,
      hint: card.hint || null,
      difficulty: card.difficulty || "medium",
      orderIndex: idx,
    }));

    const insertedCards = await db
      .insert(flashcards)
      .values(cardValues)
      .returning();

    return NextResponse.json({
      success: true,
      session: { ...session, cardCount: insertedCards.length },
      cards: insertedCards,
    });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
