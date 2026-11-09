import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documentTutorMessages, savedDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

async function getOwnedDocumentId(rawId: string, userId: string): Promise<number | null> {
  const documentId = Number(rawId);
  if (!Number.isSafeInteger(documentId) || documentId < 1) return null;

  const [document] = await db
    .select({ id: savedDocuments.id })
    .from(savedDocuments)
    .where(and(eq(savedDocuments.id, documentId), eq(savedDocuments.userId, userId)));
  return document?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const documentId = await getOwnedDocumentId(rawId, guard.user.id);
    if (!documentId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const messages = await db
      .select({
        role: documentTutorMessages.role,
        content: documentTutorMessages.content,
      })
      .from(documentTutorMessages)
      .where(eq(documentTutorMessages.documentId, documentId))
      .orderBy(asc(documentTutorMessages.id));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/side-by-side/documents/[id]/conversation error:", error);
    return NextResponse.json({ error: "Failed to load tutor conversation" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const documentId = await getOwnedDocumentId(rawId, guard.user.id);
    if (!documentId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await db
      .delete(documentTutorMessages)
      .where(eq(documentTutorMessages.documentId, documentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/side-by-side/documents/[id]/conversation error:", error);
    return NextResponse.json({ error: "Failed to delete tutor conversation" }, { status: 500 });
  }
}
