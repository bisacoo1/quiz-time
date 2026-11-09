import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documentTutorMessages, savedDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const documentId = Number(rawId);
    if (!Number.isSafeInteger(documentId) || documentId < 1) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const [document] = await db
      .select({ id: savedDocuments.id })
      .from(savedDocuments)
      .where(and(eq(savedDocuments.id, documentId), eq(savedDocuments.userId, guard.user.id)));
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

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
