import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documentHighlights, savedDocuments } from "@/db/schema";
import {
  isValidSideBySideHighlightRects,
  SIDE_BY_SIDE_HIGHLIGHT_MAX_LENGTH,
} from "@/lib/side-by-side";
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

    const highlights = await db
      .select()
      .from(documentHighlights)
      .where(eq(documentHighlights.documentId, documentId))
      .orderBy(asc(documentHighlights.createdAt), asc(documentHighlights.id));

    return NextResponse.json({ highlights });
  } catch (error) {
    console.error("GET /api/side-by-side/documents/[id]/highlights error:", error);
    return NextResponse.json({ error: "Failed to load document highlights" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const documentId = await getOwnedDocumentId(rawId, guard.user.id);
    if (!documentId) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid highlight" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid highlight" }, { status: 400 });
    }

    const highlight = body as Record<string, unknown>;
    const quote = typeof highlight.quote === "string" ? highlight.quote.trim() : "";
    if (!quote || quote.length > SIDE_BY_SIDE_HIGHLIGHT_MAX_LENGTH) {
      return NextResponse.json({ error: "Select a passage up to 5,000 characters long" }, { status: 400 });
    }
    if (!isValidSideBySideHighlightRects(highlight.rects)) {
      return NextResponse.json({ error: "Highlight position is invalid" }, { status: 400 });
    }

    const [saved] = await db
      .insert(documentHighlights)
      .values({ documentId, quote, rects: highlight.rects })
      .returning();

    return NextResponse.json({ highlight: saved }, { status: 201 });
  } catch (error) {
    console.error("POST /api/side-by-side/documents/[id]/highlights error:", error);
    return NextResponse.json({ error: "Failed to save document highlight" }, { status: 500 });
  }
}
