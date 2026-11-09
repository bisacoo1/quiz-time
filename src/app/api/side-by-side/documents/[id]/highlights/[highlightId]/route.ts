import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documentHighlights, savedDocuments } from "@/db/schema";
import { SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH } from "@/lib/side-by-side";
import { requireUser } from "@/lib/auth-guard";

async function getOwnedIds(
  rawDocumentId: string,
  rawHighlightId: string,
  userId: string
): Promise<{ documentId: number; highlightId: number } | null> {
  const documentId = Number(rawDocumentId);
  const highlightId = Number(rawHighlightId);
  if (
    !Number.isSafeInteger(documentId) ||
    documentId < 1 ||
    !Number.isSafeInteger(highlightId) ||
    highlightId < 1
  ) {
    return null;
  }

  const [document] = await db
    .select({ id: savedDocuments.id })
    .from(savedDocuments)
    .where(and(eq(savedDocuments.id, documentId), eq(savedDocuments.userId, userId)));
  if (!document) return null;

  return { documentId, highlightId };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawDocumentId, highlightId: rawHighlightId } = await params;
    const ownedIds = await getOwnedIds(rawDocumentId, rawHighlightId, guard.user.id);
    if (!ownedIds) return NextResponse.json({ error: "Highlight not found" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("note" in body) ||
      typeof body.note !== "string" ||
      body.note.length > SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH
    ) {
      return NextResponse.json({ error: "Notes must be 2,000 characters or fewer" }, { status: 400 });
    }

    const [updated] = await db
      .update(documentHighlights)
      .set({ note: body.note.trim(), updatedAt: new Date() })
      .where(
        and(
          eq(documentHighlights.id, ownedIds.highlightId),
          eq(documentHighlights.documentId, ownedIds.documentId)
        )
      )
      .returning();
    if (!updated) return NextResponse.json({ error: "Highlight not found" }, { status: 404 });

    return NextResponse.json({ highlight: updated });
  } catch (error) {
    console.error("PATCH /api/side-by-side/documents/[id]/highlights/[highlightId] error:", error);
    return NextResponse.json({ error: "Failed to save highlight note" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawDocumentId, highlightId: rawHighlightId } = await params;
    const ownedIds = await getOwnedIds(rawDocumentId, rawHighlightId, guard.user.id);
    if (!ownedIds) return NextResponse.json({ error: "Highlight not found" }, { status: 404 });

    const [deleted] = await db
      .delete(documentHighlights)
      .where(
        and(
          eq(documentHighlights.id, ownedIds.highlightId),
          eq(documentHighlights.documentId, ownedIds.documentId)
        )
      )
      .returning({ id: documentHighlights.id });
    if (!deleted) return NextResponse.json({ error: "Highlight not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/side-by-side/documents/[id]/highlights/[highlightId] error:", error);
    return NextResponse.json({ error: "Failed to delete document highlight" }, { status: 500 });
  }
}
