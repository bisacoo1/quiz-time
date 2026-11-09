import { BlobNotFoundError, head } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { savedDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import {
  completeDocumentUpload,
  getDocumentStorageUsage,
  StorageQuotaExceededError,
  UploadReservationError,
} from "@/lib/side-by-side-storage";
import {
  getSideBySideMimeType,
  SIDE_BY_SIDE_MAX_FILE_BYTES,
  SIDE_BY_SIDE_STORAGE_LIMIT_BYTES,
  sanitizeDocumentName,
} from "@/lib/side-by-side";

export async function GET() {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const documents = await db
      .select({
        id: savedDocuments.id,
        originalName: savedDocuments.originalName,
        mimeType: savedDocuments.mimeType,
        sizeBytes: savedDocuments.sizeBytes,
        lastPage: savedDocuments.lastPage,
        lastScrollTop: savedDocuments.lastScrollTop,
        createdAt: savedDocuments.createdAt,
        updatedAt: savedDocuments.updatedAt,
      })
      .from(savedDocuments)
      .where(eq(savedDocuments.userId, guard.user.id))
      .orderBy(desc(savedDocuments.updatedAt));
    const storageUsage = await getDocumentStorageUsage(guard.user.id);

    return NextResponse.json({
      documents,
      storageUsage: {
        ...storageUsage,
        limitBytes: SIDE_BY_SIDE_STORAGE_LIMIT_BYTES,
      },
    });
  } catch (error) {
    console.error("GET /api/side-by-side/documents error:", error);
    return NextResponse.json({ error: "Failed to load saved documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid document details" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid document details" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : "";
    const originalName = sanitizeDocumentName(
      typeof payload.originalName === "string" ? payload.originalName : ""
    );
    const mimeType = getSideBySideMimeType(originalName);
    const ownerPrefix = `side-by-side/${encodeURIComponent(guard.user.id)}/`;
    if (!storagePath.startsWith(ownerPrefix) || !originalName || !mimeType) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let blob;
    try {
      blob = await head(storagePath);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return NextResponse.json({ error: "The uploaded document could not be found" }, { status: 404 });
      }
      throw error;
    }
    if (
      !blob ||
      blob.size < 1 ||
      blob.size > SIDE_BY_SIDE_MAX_FILE_BYTES ||
      blob.contentType !== mimeType
    ) {
      return NextResponse.json({ error: "The uploaded document failed validation" }, { status: 400 });
    }

    await completeDocumentUpload({
      userId: guard.user.id,
      originalName,
      storagePath,
      mimeType,
      sizeBytes: blob.size,
    });

    const [document] = await db
      .select({
        id: savedDocuments.id,
        originalName: savedDocuments.originalName,
        mimeType: savedDocuments.mimeType,
        sizeBytes: savedDocuments.sizeBytes,
        lastPage: savedDocuments.lastPage,
        lastScrollTop: savedDocuments.lastScrollTop,
        createdAt: savedDocuments.createdAt,
        updatedAt: savedDocuments.updatedAt,
      })
      .from(savedDocuments)
      .where(and(eq(savedDocuments.storagePath, storagePath), eq(savedDocuments.userId, guard.user.id)));

    if (!document) {
      return NextResponse.json({ error: "Failed to save the uploaded document" }, { status: 500 });
    }
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("POST /api/side-by-side/documents error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof StorageQuotaExceededError || error instanceof UploadReservationError
            ? error.message
            : "Failed to save the uploaded document",
      },
      {
        status:
          error instanceof StorageQuotaExceededError
            ? 413
            : error instanceof UploadReservationError
              ? 400
              : 500,
      }
    );
  }
}
