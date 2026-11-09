import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const [document] = await db
      .select({
        storagePath: savedDocuments.storagePath,
        originalName: savedDocuments.originalName,
        mimeType: savedDocuments.mimeType,
        sizeBytes: savedDocuments.sizeBytes,
      })
      .from(savedDocuments)
      .where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, guard.user.id)));
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const blob = await get(document.storagePath, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "The saved file is unavailable" }, { status: 404 });
    }

    const encodedName = encodeURIComponent(document.originalName).replace(/['()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
    return new NextResponse(blob.stream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(document.sizeBytes),
        "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/side-by-side/documents/[id]/file error:", error);
    return NextResponse.json({ error: "Failed to open the saved document" }, { status: 500 });
  }
}
