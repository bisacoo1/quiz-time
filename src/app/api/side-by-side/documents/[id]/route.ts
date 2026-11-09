import { BlobNotFoundError, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

function parseDocumentId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const id = parseDocumentId(rawId);
    if (!id) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid progress update" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid progress update" }, { status: 400 });
    }

    const values: {
      lastPage?: number;
      lastScrollTop?: number;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    const progress = body as Record<string, unknown>;
    if (progress.lastPage !== undefined) {
      if (!Number.isSafeInteger(progress.lastPage) || (progress.lastPage as number) < 1) {
        return NextResponse.json({ error: "Page number must be a positive integer" }, { status: 400 });
      }
      values.lastPage = progress.lastPage as number;
    }
    if (progress.lastScrollTop !== undefined) {
      if (
        !Number.isSafeInteger(progress.lastScrollTop) ||
        (progress.lastScrollTop as number) < 0
      ) {
        return NextResponse.json({ error: "Scroll position must be a non-negative integer" }, { status: 400 });
      }
      values.lastScrollTop = progress.lastScrollTop as number;
    }
    if (values.lastPage === undefined && values.lastScrollTop === undefined) {
      return NextResponse.json({ error: "No progress values were provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(savedDocuments)
      .set(values)
      .where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, guard.user.id)))
      .returning({ id: savedDocuments.id });
    if (!updated) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/side-by-side/documents/[id] error:", error);
    return NextResponse.json({ error: "Failed to save study progress" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const id = parseDocumentId(rawId);
    if (!id) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const [document] = await db
      .select({
        id: savedDocuments.id,
        storagePath: savedDocuments.storagePath,
      })
      .from(savedDocuments)
      .where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, guard.user.id)));
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    try {
      await del(document.storagePath);
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
    await db
      .delete(savedDocuments)
      .where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, guard.user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/side-by-side/documents/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete the saved document" }, { status: 500 });
  }
}
