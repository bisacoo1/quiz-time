import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, type AuthedUser } from "@/lib/auth-guard";
import {
  completeDocumentUpload,
  reserveDocumentUpload,
  StorageQuotaExceededError,
  UploadReservationError,
} from "@/lib/side-by-side-storage";
import {
  getSideBySideMimeType,
  isSideBySideMimeType,
  sanitizeDocumentName,
  SIDE_BY_SIDE_ALLOWED_MIME_TYPES,
  SIDE_BY_SIDE_MAX_FILE_BYTES,
} from "@/lib/side-by-side";

interface UploadTokenPayload {
  userId: string;
  originalName: string;
  mimeType: string;
  reservedBytes: number;
}

class UploadValidationError extends Error {}

function readUploadTokenPayload(raw: string | null | undefined): UploadTokenPayload | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const payload = value as Record<string, unknown>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.originalName !== "string" ||
      typeof payload.mimeType !== "string" ||
      typeof payload.reservedBytes !== "number" ||
      !Number.isSafeInteger(payload.reservedBytes) ||
      payload.reservedBytes < 1 ||
      !isSideBySideMimeType(payload.mimeType) ||
      !payload.userId
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      originalName: payload.originalName,
      mimeType: payload.mimeType,
      reservedBytes: payload.reservedBytes,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: HandleUploadBody;
    try {
      body = (await request.json()) as HandleUploadBody;
    } catch {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const eventType =
      body && typeof body === "object" && "type" in body
        ? (body as { type?: unknown }).type
        : undefined;
    let uploadUser: AuthedUser | null = null;
    if (eventType === "blob.generate-client-token") {
      const guard = await requireUser();
      if (guard instanceof NextResponse) return guard;
      uploadUser = guard.user;
    } else if (eventType !== "blob.upload-completed") {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!uploadUser) throw new UploadValidationError("Please sign in to upload a study document.");

        let requestedName = "";
        let requestedSize = 0;
        try {
          const parsed: unknown = JSON.parse(clientPayload ?? "");
          if (parsed && typeof parsed === "object") {
            if ("originalName" in parsed && typeof parsed.originalName === "string") {
              requestedName = parsed.originalName;
            }
            if ("sizeBytes" in parsed && typeof parsed.sizeBytes === "number") {
              requestedSize = parsed.sizeBytes;
            }
          }
        } catch {
          throw new UploadValidationError("The document name is invalid.");
        }

        const originalName = sanitizeDocumentName(requestedName);
        const mimeType = getSideBySideMimeType(originalName);
        const ownerPath = `side-by-side/${encodeURIComponent(uploadUser.id)}/`;
        const extension = mimeType === "application/pdf" ? "pdf" : "docx";
        const pathnameTail = pathname.startsWith(ownerPath) ? pathname.slice(ownerPath.length) : "";
        if (
          !originalName ||
          !mimeType ||
          !Number.isSafeInteger(requestedSize) ||
          requestedSize < 1 ||
          requestedSize > SIDE_BY_SIDE_MAX_FILE_BYTES ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|docx)$/i.test(pathnameTail) ||
          !pathnameTail.toLowerCase().endsWith(`.${extension}`)
        ) {
          throw new UploadValidationError("Only PDF or DOCX files up to 50 MB can be uploaded.");
        }

        await reserveDocumentUpload(uploadUser.id, pathname, requestedSize);
        return {
          allowedContentTypes: [...SIDE_BY_SIDE_ALLOWED_MIME_TYPES],
          maximumSizeInBytes: requestedSize,
          tokenPayload: JSON.stringify({
            userId: uploadUser.id,
            originalName,
            mimeType,
            reservedBytes: requestedSize,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = readUploadTokenPayload(tokenPayload);
        if (!payload) throw new UploadValidationError("The completed upload has invalid ownership metadata.");

        const expectedPrefix = `side-by-side/${encodeURIComponent(payload.userId)}/`;
        if (
          !blob.pathname.startsWith(expectedPrefix) ||
          !isSideBySideMimeType(payload.mimeType)
        ) {
          throw new UploadValidationError("The completed upload failed validation.");
        }
        const metadata = await head(blob.pathname);
        if (
          metadata.size < 1 ||
          metadata.size > SIDE_BY_SIDE_MAX_FILE_BYTES ||
          metadata.size > payload.reservedBytes ||
          metadata.contentType !== payload.mimeType
        ) {
          throw new UploadValidationError("The completed upload failed validation.");
        }

        await completeDocumentUpload({
          userId: payload.userId,
          originalName: payload.originalName,
          storagePath: blob.pathname,
          mimeType: payload.mimeType,
          sizeBytes: metadata.size,
        });
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/side-by-side/upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The document upload failed." },
      {
        status:
          error instanceof StorageQuotaExceededError
            ? 413
            : error instanceof UploadValidationError || error instanceof UploadReservationError
              ? 400
              : 500,
      }
    );
  }
}
