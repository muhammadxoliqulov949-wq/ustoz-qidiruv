import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import {
  MEDIA_DOCUMENTS_FROZEN_NOTE,
  MEDIA_UPLOAD_FAILED_NOTE,
  MAX_VERIFICATION_DOCUMENTS,
  MAX_VERIFICATION_TOTAL_BYTES,
  REQUIRED_VERIFICATION_DOCUMENT_TYPES,
  VISIBILITY_BY_PURPOSE,
  sanitizeDisplayFileName,
  validateUpload,
  type FilePurpose,
  type StorageVisibility,
  type VerificationDocumentType,
} from "@/lib/media";
import { buildStorageKey } from "./storage/keys";
import { getStorageProvider, storageStatus } from "./storage";
import { StorageConfigError, StorageOperationError } from "./storage/types";
import {
  CACHE_CONTROL_BY_VISIBILITY,
  PRIVATE_READ_SECONDS,
} from "./storage/policy";

/* -------------------------------------------------------------------------- */
/* File service — Phase 18.                                                    */
/*                                                                              */
/* THE ONLY MODULE THAT WRITES `file_assets`, and the only module that calls a   */
/* storage provider. Everything else asks it a PURPOSE-SHAPED question           */
/* ("set this teacher's profile image") and never supplies a visibility, a       */
/* storage key or an ownership id.                                              */
/*                                                                              */
/* ORDERING RULES (storage and Postgres cannot share a transaction):            */
/*   UPLOAD  — pending row → put object → VERIFY the object → activate.         */
/*   REPLACE — activate the new asset, supersede the old one in the SAME tx,   */
/*             then remove the old OBJECT afterwards (best effort).             */
/*   DELETE  — mark the row deleted first, then remove the object; a failed     */
/*             object delete leaves a repairable record for the cleanup CLI.    */
/* Nothing is ever activated before the provider has confirmed the object.      */
/* -------------------------------------------------------------------------- */

export type FileErrorCode =
  | "storage_disabled"
  | "unsupported_type"
  | "too_large"
  | "empty_file"
  | "content_mismatch"
  | "not_an_image"
  | "too_small"
  | "too_many_documents"
  | "total_too_large"
  | "not_found"
  | "forbidden"
  | "frozen"
  | "locked"
  | "storage_failed"
  | "server_error";

export type FileResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: FileErrorCode; message: string };

export interface UploadCandidate {
  bytes: Uint8Array;
  /** Original name, display only. Never a path, never a key. */
  fileName: string;
}

export interface StoredAssetView {
  id: string;
  purpose: FilePurpose;
  visibility: StorageVisibility;
  /** Signed (private) or public URL, ready for the browser. */
  url: string | null;
  mimeType: string;
  byteSize: number;
  originalFileName: string;
}

/* --------------------------------- helpers --------------------------------- */

function clippedFileName(name: string): string {
  return sanitizeDisplayFileName(name, 255) || "fayl";
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Public URL for an ACTIVE asset, or null when this deployment has none. */
function publicUrlFor(asset: { storageKey: string; visibility: StorageVisibility }): string | null {
  if (asset.visibility !== "public") return null;
  try {
    return getStorageProvider().getPublicUrl(asset.storageKey);
  } catch {
    return null;
  }
}

/**
 * The core write. Purpose-shaped callers supply identity + ownership; the
 * visibility, key namespace, content type and byte size are all derived here.
 */
async function storeAsset(input: {
  purpose: FilePurpose;
  ownerUserId: string;
  ownerScopeId: string;
  courseId?: string | null;
  documentType?: VerificationDocumentType | null;
  candidate: UploadCandidate;
  /** Row id to reuse (replacing an asset keeps the same id). Unused for now. */
}): Promise<FileResult<StoredAssetView>> {
  const status = storageStatus();
  if (!status.enabled) {
    return {
      ok: false,
      code: "storage_disabled",
      message:
        "Fayl yuklash bu muhitda sozlanmagan (storage env yo‘q). Administratorga murojaat qiling.",
    };
  }

  // CONTENT-AUTHORITATIVE validation: file name and browser MIME are ignored.
  const validated = validateUpload({ purpose: input.purpose, bytes: input.candidate.bytes });
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }

  const db = getDb();
  const assetId = newId("fa");
  const storageKey = buildStorageKey({
    purpose: input.purpose,
    ownerScopeId: input.ownerScopeId,
    assetId,
    extension: validated.extension,
  });
  const visibility = VISIBILITY_BY_PURPOSE[input.purpose];
  const provider = getStorageProvider();
  const checksum = sha256Hex(input.candidate.bytes);
  const fileName = clippedFileName(input.candidate.fileName);
  const now = new Date();

  // 1. PENDING ROW FIRST: if the process dies mid-upload, the cleanup command
  //    still knows which key may exist.
  await db.insert(schema.fileAssets).values({
    id: assetId,
    ownerUserId: input.ownerUserId,
    courseId: input.courseId ?? null,
    purpose: input.purpose,
    visibility,
    storageProvider: provider.name,
    storageKey,
    originalFileName: fileName,
    mimeType: validated.mimeType,
    byteSize: BigInt(validated.byteSize),
    checksumSha256: checksum,
    documentType: input.documentType ?? null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  try {
    // 2. OBJECT, with the explicit content type and cache policy.
    await provider.putObject({
      key: storageKey,
      visibility,
      body: input.candidate.bytes,
      contentType: validated.mimeType,
      cacheControl: CACHE_CONTROL_BY_VISIBILITY[visibility],
      metadata: { sha256: checksum, purpose: input.purpose },
    });

    // 3. VERIFY, never trust: the provider must report the object back with the
    //    size and type we asked for before the row becomes active.
    const head = await provider.headObject(storageKey, visibility);
    if (!head || head.byteSize !== validated.byteSize || head.contentType !== validated.mimeType) {
      await markDeleted(assetId);
      return {
        ok: false,
        code: "content_mismatch",
        message: MEDIA_UPLOAD_FAILED_NOTE,
      };
    }

    // 4. Activate (and, for single-slot purposes, supersede the previous one).
    const url = await db.transaction(async (tx) => {
      await supersedePrevious(tx, {
        purpose: input.purpose,
        ownerUserId: input.ownerUserId,
        courseId: input.courseId ?? null,
        keepAssetId: assetId,
        now,
      });
      await tx
        .update(schema.fileAssets)
        .set({ status: "active", activatedAt: now, updatedAt: now })
        .where(eq(schema.fileAssets.id, assetId));
      return publicUrlFor({ storageKey, visibility });
    });

    return {
      ok: true,
      data: {
        id: assetId,
        purpose: input.purpose,
        visibility,
        url,
        mimeType: validated.mimeType,
        byteSize: validated.byteSize,
        originalFileName: fileName,
      },
    };
  } catch (error) {
    /*
     * The object did not make it (network, permissions, provider outage). The
     * row is marked deleted so nothing references a half-written object, and
     * the caller gets an honest failure — never a success for a missing file.
     */
    console.error("storeAsset failed", {
      code: error instanceof StorageOperationError ? error.operation : "unknown",
      provider: provider.name,
    });
    await markDeleted(assetId);
    return { ok: false, code: "storage_failed", message: MEDIA_UPLOAD_FAILED_NOTE };
  }
}

async function markDeleted(assetId: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(schema.fileAssets)
      .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.fileAssets.id, assetId), sql`${schema.fileAssets.status} <> 'deleted'`));
  } catch {
    // Best effort: the row stays `pending` and the cleanup command picks it up.
  }
}

/**
 * Supersede the CURRENT active asset for a single-slot purpose. Runs inside the
 * activation transaction, so a replacement can never leave two active rows (the
 * partial unique index would refuse) nor zero.
 */
async function supersedePrevious(
  tx: Tx,
  input: {
    purpose: FilePurpose;
    ownerUserId: string;
    courseId: string | null;
    keepAssetId: string;
    now: Date;
  },
): Promise<void> {
  if (
    input.purpose !== "teacher_profile_image" &&
    input.purpose !== "course_cover_image"
  ) {
    return; // verification documents are a set, not a slot
  }
  const scope =
    input.purpose === "course_cover_image"
      ? eq(schema.fileAssets.courseId, input.courseId as string)
      : eq(schema.fileAssets.ownerUserId, input.ownerUserId);

  await tx
    .update(schema.fileAssets)
    .set({ status: "superseded", updatedAt: input.now })
    .where(
      and(
        eq(schema.fileAssets.purpose, input.purpose),
        eq(schema.fileAssets.status, "active"),
        sql`${schema.fileAssets.id} <> ${input.keepAssetId}`,
        scope,
      ),
    );
}

/** Best-effort object removal AFTER the row state is already settled. */
async function removeObjectQuietly(asset: {
  storageKey: string;
  visibility: StorageVisibility;
}): Promise<boolean> {
  try {
    const provider = getStorageProvider();
    await provider.deleteObject(asset.storageKey, asset.visibility);
    return true;
  } catch (error) {
    console.error("removeObjectQuietly failed", {
      operation: error instanceof StorageOperationError ? error.operation : "unknown",
    });
    return false;
  }
}

/* ------------------------- public media projections ------------------------- */

export interface PublicMediaIndex {
  teacherPhotos: Map<string, string>;
  courseCovers: Map<string, string>;
}

/**
 * Managed public URLs for a page's worth of entities, in ONE query.
 *
 * Only `active` assets with a PUBLIC purpose are considered, so a private
 * verification document cannot enter a marketplace projection even if a caller
 * asks for the wrong ids.
 */
export async function publicMediaIndex(input: {
  teacherUserIds?: string[];
  courseIds?: string[];
}): Promise<PublicMediaIndex> {
  const result: PublicMediaIndex = { teacherPhotos: new Map(), courseCovers: new Map() };
  if (!storageStatus().enabled) return result;

  const teacherIds = input.teacherUserIds ?? [];
  const courseIds = input.courseIds ?? [];
  if (teacherIds.length === 0 && courseIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      ownerUserId: schema.fileAssets.ownerUserId,
      courseId: schema.fileAssets.courseId,
      purpose: schema.fileAssets.purpose,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.status, "active"),
        eq(schema.fileAssets.visibility, "public"),
        or(
          teacherIds.length > 0
            ? and(
                eq(schema.fileAssets.purpose, "teacher_profile_image"),
                inArray(schema.fileAssets.ownerUserId, teacherIds),
              )
            : undefined,
          courseIds.length > 0
            ? and(
                eq(schema.fileAssets.purpose, "course_cover_image"),
                inArray(schema.fileAssets.courseId, courseIds),
              )
            : undefined,
        ),
      ),
    );

  for (const row of rows) {
    const url = publicUrlFor(row);
    if (!url) continue;
    if (row.purpose === "teacher_profile_image") result.teacherPhotos.set(row.ownerUserId, url);
    if (row.purpose === "course_cover_image" && row.courseId) result.courseCovers.set(row.courseId, url);
  }
  return result;
}

/** Managed cover for ONE course, or null. Used by moderation/detail screens. */
export async function courseCoverUrl(courseId: string): Promise<string | null> {
  const index = await publicMediaIndex({ courseIds: [courseId] });
  return index.courseCovers.get(courseId) ?? null;
}

/** Managed profile image for ONE teacher, or null. */
export async function teacherPhotoUrl(teacherUserId: string): Promise<string | null> {
  const index = await publicMediaIndex({ teacherUserIds: [teacherUserId] });
  return index.teacherPhotos.get(teacherUserId) ?? null;
}

/* ------------------------------ teacher: profile ---------------------------- */

export async function uploadTeacherProfileImage(
  teacherUserId: string,
  candidate: UploadCandidate,
): Promise<FileResult<StoredAssetView>> {
  return storeAsset({
    purpose: "teacher_profile_image",
    ownerUserId: teacherUserId,
    ownerScopeId: teacherUserId,
    candidate,
  });
}

/**
 * Remove the current profile image. The previous STATIC/seed photo is untouched
 * (it lives in a different column), so the profile falls back to it rather than
 * showing a broken image.
 */
export async function removeTeacherProfileImage(
  teacherUserId: string,
): Promise<FileResult<{ removed: boolean }>> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.fileAssets.id,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.ownerUserId, teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_profile_image"),
        eq(schema.fileAssets.status, "active"),
      ),
    )
    .limit(1);

  const asset = rows[0];
  if (!asset) return { ok: true, data: { removed: false } };

  await markDeleted(asset.id);
  await removeObjectQuietly(asset);
  return { ok: true, data: { removed: true } };
}

/** Whether a MANAGED image is currently in use, and its public URL. */
export async function teacherProfileMedia(
  teacherUserId: string,
): Promise<{ managedUrl: string | null; hasManaged: boolean }> {
  const db = getDb();
  const rows = await db
    .select({ storageKey: schema.fileAssets.storageKey, visibility: schema.fileAssets.visibility })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.ownerUserId, teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_profile_image"),
        eq(schema.fileAssets.status, "active"),
      ),
    )
    .limit(1);
  const asset = rows[0];
  if (!asset) return { managedUrl: null, hasManaged: false };
  return { managedUrl: publicUrlFor(asset), hasManaged: true };
}

/* ------------------------------- teacher: course ---------------------------- */

export async function uploadCourseCover(
  teacherUserId: string,
  courseId: string,
  candidate: UploadCandidate,
): Promise<FileResult<StoredAssetView>> {
  const db = getDb();
  // Ownership + editability are checked against the DATABASE, not a parameter.
  const rows = await db
    .select({ id: schema.courses.id, status: schema.courses.status })
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, teacherUserId)))
    .limit(1);
  const course = rows[0];
  if (!course) {
    return { ok: false, code: "not_found", message: "Kurs topilmadi." };
  }
  if (course.status !== "draft") {
    return {
      ok: false,
      code: "locked",
      message:
        course.status === "ready"
          ? "Kurs moderatsiyada — muqovani o‘zgartirish uchun avval arizani qaytarib oling."
          : "Kurs faol qoralama holatida emas — muqovani o‘zgartirib bo‘lmaydi.",
    };
  }

  return storeAsset({
    purpose: "course_cover_image",
    ownerUserId: teacherUserId,
    ownerScopeId: courseId,
    courseId,
    candidate,
  });
}

export async function removeCourseCover(
  teacherUserId: string,
  courseId: string,
): Promise<FileResult<{ removed: boolean }>> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.courses.status })
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, teacherUserId)))
    .limit(1);
  const course = rows[0];
  if (!course) return { ok: false, code: "not_found", message: "Kurs topilmadi." };
  if (course.status !== "draft") {
    return {
      ok: false,
      code: "locked",
      message: "Muqovani faqat qoralama holatida olib tashlash mumkin.",
    };
  }

  const assets = await db
    .select({
      id: schema.fileAssets.id,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.courseId, courseId),
        eq(schema.fileAssets.purpose, "course_cover_image"),
        eq(schema.fileAssets.status, "active"),
      ),
    )
    .limit(1);

  const asset = assets[0];
  if (!asset) return { ok: true, data: { removed: false } };

  await markDeleted(asset.id);
  await removeObjectQuietly(asset);
  return { ok: true, data: { removed: true } };
}

/* --------------------------- teacher: verification -------------------------- */

export interface VerificationDocumentView {
  id: string;
  documentType: VerificationDocumentType;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date;
  /** TRUE once the document is attached to a submitted request. */
  frozen: boolean;
}

/** Documents the teacher has uploaded and not yet attached to a request. */
export async function listOwnVerificationDocuments(
  teacherUserId: string,
): Promise<VerificationDocumentView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.fileAssets.id,
      documentType: schema.fileAssets.documentType,
      originalFileName: schema.fileAssets.originalFileName,
      mimeType: schema.fileAssets.mimeType,
      byteSize: schema.fileAssets.byteSize,
      createdAt: schema.fileAssets.createdAt,
      frozenAt: schema.teacherVerificationDocuments.id,
    })
    .from(schema.fileAssets)
    .leftJoin(
      schema.teacherVerificationDocuments,
      eq(schema.teacherVerificationDocuments.fileAssetId, schema.fileAssets.id),
    )
    .where(
      and(
        eq(schema.fileAssets.ownerUserId, teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_verification_document"),
        eq(schema.fileAssets.status, "active"),
      ),
    )
    .orderBy(desc(schema.fileAssets.createdAt));

  return rows.map((row) => ({
    id: row.id,
    documentType: (row.documentType ?? "identity_document") as VerificationDocumentType,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize),
    createdAt: row.createdAt,
    frozen: row.frozenAt !== null,
  }));
}

export async function uploadVerificationDocument(
  teacherUserId: string,
  documentType: VerificationDocumentType,
  candidate: UploadCandidate,
): Promise<FileResult<StoredAssetView>> {
  const db = getDb();

  /*
   * FREEZE CHECK. While a request is under review the evidence is what the
   * reviewer is reading; adding to it would change the thing being decided.
   */
  const pendingRequest = await db
    .select({ id: schema.teacherVerificationRequests.id })
    .from(schema.teacherVerificationRequests)
    .where(
      and(
        eq(schema.teacherVerificationRequests.teacherUserId, teacherUserId),
        eq(schema.teacherVerificationRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pendingRequest[0]) {
    return { ok: false, code: "frozen", message: MEDIA_DOCUMENTS_FROZEN_NOTE };
  }

  const existing = await listOwnVerificationDocuments(teacherUserId);
  if (existing.length >= MAX_VERIFICATION_DOCUMENTS) {
    return {
      ok: false,
      code: "too_many_documents",
      message: `Ko‘pi bilan ${MAX_VERIFICATION_DOCUMENTS} ta hujjat yuklash mumkin.`,
    };
  }
  const totalBytes = existing.reduce((sum, doc) => sum + doc.byteSize, candidate.bytes.length);
  if (totalBytes > MAX_VERIFICATION_TOTAL_BYTES) {
    return {
      ok: false,
      code: "total_too_large",
      message: "Hujjatlarning umumiy hajmi ruxsat etilgan chegaradan oshdi.",
    };
  }

  const stored = await storeAsset({
    purpose: "teacher_verification_document",
    ownerUserId: teacherUserId,
    ownerScopeId: teacherUserId,
    documentType,
    candidate,
  });
  // Private assets deliberately have NO public URL — the caller must ask for a
  // signed one, and only through an authorized path.
  if (stored.ok) stored.data.url = null;
  return stored;
}

/**
 * Remove an OWN, not-yet-attached document. Once a request references the asset
 * the delete is refused: the reviewer's evidence is not editable afterwards.
 */
export async function removeVerificationDocument(
  teacherUserId: string,
  assetId: string,
): Promise<FileResult<{ removed: boolean }>> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.fileAssets.id,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.id, assetId),
        eq(schema.fileAssets.ownerUserId, teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_verification_document"),
        eq(schema.fileAssets.status, "active"),
      ),
    )
    .limit(1);
  const asset = rows[0];
  // Someone else's document simply does not resolve — no existence leak.
  if (!asset) return { ok: false, code: "not_found", message: "Hujjat topilmadi." };

  const attached = await db
    .select({ id: schema.teacherVerificationDocuments.id })
    .from(schema.teacherVerificationDocuments)
    .where(eq(schema.teacherVerificationDocuments.fileAssetId, assetId))
    .limit(1);
  if (attached[0]) {
    return { ok: false, code: "frozen", message: MEDIA_DOCUMENTS_FROZEN_NOTE };
  }

  await markDeleted(asset.id);
  await removeObjectQuietly(asset);
  return { ok: true, data: { removed: true } };
}

/** Whether the teacher currently satisfies the document requirement. */
export async function verificationDocumentsReady(
  teacherUserId: string,
): Promise<{ ready: boolean; missing: VerificationDocumentType[] }> {
  const documents = await listOwnVerificationDocuments(teacherUserId);
  const present = new Set(documents.map((doc) => doc.documentType));
  const missing = REQUIRED_VERIFICATION_DOCUMENT_TYPES.filter((type) => !present.has(type));
  return { ready: missing.length === 0, missing };
}

/**
 * Called INSIDE the submission transaction: attach the teacher's current
 * documents to the new request, freezing them.
 *
 * Returns the number attached, or a refusal when a required type is missing.
 */
/**
 * Readiness check that runs INSIDE the submission transaction, so the decision
 * to accept an application is made against the same rows the attachment will
 * freeze.
 */
export async function verificationDocumentsReadyInTx(
  tx: Tx,
  teacherUserId: string,
): Promise<{ ready: boolean; missing: VerificationDocumentType[] }> {
  const rows = await tx
    .select({ documentType: schema.fileAssets.documentType })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.ownerUserId, teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_verification_document"),
        eq(schema.fileAssets.status, "active"),
      ),
    );
  const present = new Set(rows.map((row) => row.documentType));
  const missing = REQUIRED_VERIFICATION_DOCUMENT_TYPES.filter((type) => !present.has(type));
  return { ready: missing.length === 0, missing };
}

export async function attachDocumentsToRequest(
  tx: Tx,
  input: { teacherUserId: string; verificationRequestId: string },
): Promise<{ attached: number; missing: VerificationDocumentType[] }> {
  const rows = await tx
    .select({
      id: schema.fileAssets.id,
      documentType: schema.fileAssets.documentType,
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.ownerUserId, input.teacherUserId),
        eq(schema.fileAssets.purpose, "teacher_verification_document"),
        eq(schema.fileAssets.status, "active"),
      ),
    );

  const present = new Set(rows.map((row) => row.documentType));
  const missing = REQUIRED_VERIFICATION_DOCUMENT_TYPES.filter((type) => !present.has(type));
  if (missing.length > 0) return { attached: 0, missing };

  const now = new Date();
  for (const row of rows) {
    await tx.insert(schema.teacherVerificationDocuments).values({
      id: newId("tvd"),
      verificationRequestId: input.verificationRequestId,
      fileAssetId: row.id,
      documentType: (row.documentType ?? "identity_document") as VerificationDocumentType,
      createdAt: now,
    });
  }
  return { attached: rows.length, missing: [] };
}

/** The documents a SUBMITTED request was reviewed with (history included). */
export async function listVerificationRequestDocuments(
  verificationRequestId: string,
): Promise<VerificationDocumentView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.fileAssets.id,
      documentType: schema.teacherVerificationDocuments.documentType,
      originalFileName: schema.fileAssets.originalFileName,
      mimeType: schema.fileAssets.mimeType,
      byteSize: schema.fileAssets.byteSize,
      createdAt: schema.teacherVerificationDocuments.createdAt,
    })
    .from(schema.teacherVerificationDocuments)
    .innerJoin(schema.fileAssets, eq(schema.fileAssets.id, schema.teacherVerificationDocuments.fileAssetId))
    .where(eq(schema.teacherVerificationDocuments.verificationRequestId, verificationRequestId))
    .orderBy(schema.teacherVerificationDocuments.createdAt);

  return rows.map((row) => ({
    id: row.id,
    documentType: row.documentType,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    byteSize: Number(row.byteSize),
    createdAt: row.createdAt,
    frozen: true,
  }));
}

/* ---------------------------- authorized private read ---------------------- */

export interface SignedReadUrl {
  url: string;
  expiresAt: Date;
  fileName: string;
  mimeType: string;
}

/**
 * Mint a SHORT-LIVED read capability for a private verification document.
 *
 * AUTHORIZATION (purpose-scoped, never role-scoped in general):
 *   1. the asset must be a verification document, active, and private;
 *   2. an ADMIN may read it only when it is attached to a SUBMITTED request —
 *      an unattached draft document is the teacher's own business;
 *   3. the OWNER may read their own document at any time;
 *   4. everyone else gets `not_found`, which leaks nothing about existence.
 *
 * The URL is minted on demand and never stored: a leaked page cache cannot
 * contain a live link to evidence.
 */
export async function createVerificationDocumentReadUrl(input: {
  assetId: string;
  viewerUserId: string;
  viewerIsAdmin: boolean;
}): Promise<FileResult<SignedReadUrl>> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.fileAssets.id,
      ownerUserId: schema.fileAssets.ownerUserId,
      purpose: schema.fileAssets.purpose,
      visibility: schema.fileAssets.visibility,
      status: schema.fileAssets.status,
      storageKey: schema.fileAssets.storageKey,
      mimeType: schema.fileAssets.mimeType,
      originalFileName: schema.fileAssets.originalFileName,
    })
    .from(schema.fileAssets)
    .where(eq(schema.fileAssets.id, input.assetId))
    .limit(1);

  const asset = rows[0];
  const isOwner = asset?.ownerUserId === input.viewerUserId;
  const isAdmin = input.viewerIsAdmin;

  if (
    !asset ||
    asset.status !== "active" ||
    asset.purpose !== "teacher_verification_document" ||
    asset.visibility !== "private" ||
    (!isOwner && !isAdmin)
  ) {
    return { ok: false, code: "not_found", message: "Hujjat topilmadi." };
  }

  if (isAdmin && !isOwner) {
    const attached = await db
      .select({ id: schema.teacherVerificationDocuments.id })
      .from(schema.teacherVerificationDocuments)
      .where(eq(schema.teacherVerificationDocuments.fileAssetId, asset.id))
      .limit(1);
    if (!attached[0]) {
      return { ok: false, code: "not_found", message: "Hujjat topilmadi." };
    }
  }

  try {
    const provider = getStorageProvider();
    const signed = await provider.createPrivateReadUrl(asset.storageKey, {
      expiresInSeconds: PRIVATE_READ_SECONDS,
      downloadFileName: clippedFileName(asset.originalFileName),
    });
    return {
      ok: true,
      data: {
        url: signed.url,
        expiresAt: signed.expiresAt,
        fileName: asset.originalFileName,
        mimeType: asset.mimeType,
      },
    };
  } catch (error) {
    console.error("createVerificationDocumentReadUrl failed", {
      storage: error instanceof StorageConfigError ? "config" : "operation",
    });
    return {
      ok: false,
      code: "storage_failed",
      message: "Hujjatga havola yaratilmadi. Keyinroq urinib ko‘ring.",
    };
  }
}

/* -------------------------------- maintenance ------------------------------- */

export interface CleanupReport {
  /** `pending` rows older than the grace period, i.e. abandoned uploads. */
  scannedPending: number;
  /** How many of those were marked `deleted` in the database. */
  deletedPending: number;
  /** `superseded` or `deleted` rows scanned for object removal. */
  scannedOrphans: number;
  /** Objects physically removed from the provider (idempotent). */
  objectsRemoved: number;
  /** Operations that failed and will be retried by the next run. */
  failed: number;
  /** TRUE when nothing was changed — `--dry-run` reports only. */
  dryRun: boolean;
}

/**
 * Maintenance, run by `npm run storage:cleanup` — NEVER in a request path.
 *
 *   • `pending` rows older than `pendingOlderThanHours` are abandoned uploads:
 *     delete the object (if any) and mark the row deleted;
 *   • `superseded`/`deleted` rows still holding an object are removed.
 */
export async function cleanupStorage(input: {
  pendingOlderThanHours: number;
  limit?: number;
  /** Report what would happen and change nothing (the safe first command). */
  dryRun?: boolean;
}): Promise<CleanupReport> {
  const db = getDb();
  const requestedLimit = input.limit ?? 100;
  const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1
    ? Math.min(requestedLimit, 1000)
    : 100;
  const dryRun = input.dryRun ?? false;
  const cutoff = new Date(Date.now() - input.pendingOlderThanHours * 60 * 60 * 1000);
  const report: CleanupReport = {
    scannedPending: 0,
    deletedPending: 0,
    scannedOrphans: 0,
    objectsRemoved: 0,
    failed: 0,
    dryRun,
  };

  const stalePending = await db
    .select({
      id: schema.fileAssets.id,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(and(eq(schema.fileAssets.status, "pending"), lt(schema.fileAssets.createdAt, cutoff)))
    .limit(limit);

  report.scannedPending = stalePending.length;

  const orphanRows = await db
    .select({
      id: schema.fileAssets.id,
      storageKey: schema.fileAssets.storageKey,
      visibility: schema.fileAssets.visibility,
    })
    .from(schema.fileAssets)
    .where(
      and(
        inArray(schema.fileAssets.status, ["superseded", "deleted"]),
        or(
          isNull(schema.fileAssets.deletedAt),
          lt(schema.fileAssets.deletedAt, new Date(Date.now() - 60 * 1000)),
        ),
      ),
    )
    .limit(limit);

  report.scannedOrphans = orphanRows.length;

  if (dryRun) return report;

  for (const asset of stalePending) {
    /*
     * Database first, bytes second: once the row is `deleted` the file service
     * stops drawing it, so a failed object delete is an orphaned byte rather
     * than a broken reference.
     */
    await markDeleted(asset.id);
    report.deletedPending += 1;
    const removed = await removeObjectQuietly(asset);
    if (removed) report.objectsRemoved += 1;
    else report.failed += 1;
  }

  for (const asset of orphanRows) {
    const removed = await removeObjectQuietly(asset);
    if (removed) report.objectsRemoved += 1;
    else report.failed += 1;
  }

  return report;
}
