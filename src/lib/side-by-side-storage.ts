import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  documentUploadReservations,
  savedDocuments,
  users,
} from "@/db/schema";
import {
  hasSideBySideStorageCapacity,
  SIDE_BY_SIDE_MAX_FILE_BYTES,
} from "@/lib/side-by-side";

const RESERVATION_TTL_MS = 2 * 60 * 60 * 1000;

export class StorageQuotaExceededError extends Error {}
export class UploadReservationError extends Error {}

export interface CompleteDocumentUploadInput {
  userId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

export async function reserveDocumentUpload(
  userId: string,
  storagePath: string,
  reservedBytes: number
): Promise<void> {
  if (
    !Number.isSafeInteger(reservedBytes) ||
    reservedBytes < 1 ||
    reservedBytes > SIDE_BY_SIDE_MAX_FILE_BYTES
  ) {
    throw new UploadReservationError("The requested upload size is invalid.");
  }

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (!user) throw new UploadReservationError("Your account is unavailable. Please sign in again.");

    const now = new Date();
    await tx
      .delete(documentUploadReservations)
      .where(
        and(
          eq(documentUploadReservations.userId, userId),
          lte(documentUploadReservations.expiresAt, now)
        )
      );

    const [existingDocument] = await tx
      .select({ id: savedDocuments.id })
      .from(savedDocuments)
      .where(eq(savedDocuments.storagePath, storagePath));
    if (existingDocument) {
      throw new UploadReservationError("This document has already been uploaded.");
    }

    const [existingReservation] = await tx
      .select({
        userId: documentUploadReservations.userId,
        reservedBytes: documentUploadReservations.reservedBytes,
      })
      .from(documentUploadReservations)
      .where(eq(documentUploadReservations.storagePath, storagePath));
    if (existingReservation && existingReservation.userId !== userId) {
      throw new UploadReservationError("The upload path is already in use.");
    }

    const [used] = await tx
      .select({
        bytes: sql<number>`coalesce(sum(${savedDocuments.sizeBytes}), 0)`,
      })
      .from(savedDocuments)
      .where(eq(savedDocuments.userId, userId));
    const [reserved] = await tx
      .select({
        bytes: sql<number>`coalesce(sum(${documentUploadReservations.reservedBytes}), 0)`,
      })
      .from(documentUploadReservations)
      .where(
        and(
          eq(documentUploadReservations.userId, userId),
          gt(documentUploadReservations.expiresAt, now)
        )
      );
    const totalBytes =
      Number(used?.bytes ?? 0) +
      Number(reserved?.bytes ?? 0) -
      Number(existingReservation?.reservedBytes ?? 0);

    if (!hasSideBySideStorageCapacity(totalBytes, 0, reservedBytes)) {
      throw new StorageQuotaExceededError(
        "Your 500 MB Side by Side storage is full. Delete a saved document before uploading another."
      );
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);
    await tx
      .insert(documentUploadReservations)
      .values({ userId, storagePath, reservedBytes, expiresAt })
      .onConflictDoUpdate({
        target: documentUploadReservations.storagePath,
        set: { reservedBytes, expiresAt },
      });
  });
}

export async function completeDocumentUpload(input: CompleteDocumentUploadInput): Promise<void> {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) {
    throw new UploadReservationError("The uploaded file size is invalid.");
  }

  await db.transaction(async (tx) => {
    const [existingDocument] = await tx
      .select({
        id: savedDocuments.id,
        userId: savedDocuments.userId,
      })
      .from(savedDocuments)
      .where(eq(savedDocuments.storagePath, input.storagePath));
    if (existingDocument) {
      if (existingDocument.userId !== input.userId) {
        throw new UploadReservationError("The uploaded document belongs to another account.");
      }
      await tx
        .delete(documentUploadReservations)
        .where(eq(documentUploadReservations.storagePath, input.storagePath));
      return;
    }

    const [reservation] = await tx
      .select()
      .from(documentUploadReservations)
      .where(
        and(
          eq(documentUploadReservations.storagePath, input.storagePath),
          eq(documentUploadReservations.userId, input.userId),
          gt(documentUploadReservations.expiresAt, new Date())
        )
      );
    if (!reservation || input.sizeBytes > reservation.reservedBytes) {
      throw new UploadReservationError("The upload reservation expired or did not match this file.");
    }

    await tx
      .insert(savedDocuments)
      .values({
        userId: input.userId,
        originalName: input.originalName,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .onConflictDoNothing({ target: savedDocuments.storagePath });
    await tx
      .delete(documentUploadReservations)
      .where(
        and(
          eq(documentUploadReservations.storagePath, input.storagePath),
          eq(documentUploadReservations.userId, input.userId)
        )
      );
  });
}

export async function getDocumentStorageUsage(
  userId: string
): Promise<{ usedBytes: number; reservedBytes: number }> {
  const now = new Date();
  const [used] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${savedDocuments.sizeBytes}), 0)`,
    })
    .from(savedDocuments)
    .where(eq(savedDocuments.userId, userId));
  const [reserved] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${documentUploadReservations.reservedBytes}), 0)`,
    })
    .from(documentUploadReservations)
    .where(
      and(
        eq(documentUploadReservations.userId, userId),
        gt(documentUploadReservations.expiresAt, now)
      )
    );
  return {
    usedBytes: Number(used?.bytes ?? 0),
    reservedBytes: Number(reserved?.bytes ?? 0),
  };
}
