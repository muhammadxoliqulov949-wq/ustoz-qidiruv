"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import {
  removeCourseCover,
  removeTeacherProfileImage,
  removeVerificationDocument,
  uploadCourseCover,
  uploadTeacherProfileImage,
  uploadVerificationDocument,
  type FileResult,
  type UploadCandidate,
} from "../file-service";
import {
  courseCoverRemovalSchema,
  courseCoverUploadSchema,
  profileImageUploadSchema,
  verificationDocumentRemovalSchema,
  verificationDocumentUploadSchema,
  type ActionResult,
} from "../validation";
import {
  MAX_BYTES_BY_PURPOSE,
  formatBytes,
  type FilePurpose,
} from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* Media actions — Phase 18.                                                   */
/*                                                                              */
/* INTENT-SPECIFIC BY CONSTRUCTION. There is no `upload({visibility, purpose,   */
/* ownerId})`: each action has ONE purpose, and the owner comes from the        */
/* session. A caller cannot ask for a public verification document because no    */
/* action accepts a visibility at all — and `.strict()` turns an extra field    */
/* into a validation error rather than a silent no-op.                          */
/*                                                                              */
/* Uploads are SERVER-MEDIATED. Phase 18 files are small (≤10 MB), so the bytes  */
/* travel through the action, where the server can sniff the content before it   */
/* ever reaches storage; no presigned upload endpoint exists to be abused.       */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Amal bajarilmadi." };
}

function fromFileResult<T>(result: FileResult<T>, fallback: string): ActionResult<T> {
  if (result.ok) return { ok: true, data: result.data };
  if (result.code === "storage_disabled") {
    return { ok: false, code: result.code, message: result.message };
  }
  return { ok: false, code: result.code, message: result.message || fallback };
}

/** Non-file fields only — the upload itself is read separately, never parsed. */
function fieldsWithoutFile(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key === FILE_FIELD) continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

const FILE_FIELD = "file";

/**
 * Turn the posted entry into bytes, refusing anything that is not a real file.
 *
 * The SIZE is checked before the body is read, so a client cannot make the
 * server buffer an oversized upload just to reject it afterwards; the real
 * length is then re-checked against the same limit from the actual bytes.
 */
async function readCandidate(
  form: FormData,
  purpose: FilePurpose,
): Promise<{ ok: true; candidate: UploadCandidate } | { ok: false; message: string }> {
  const entry = form.get(FILE_FIELD);
  if (entry === null || typeof entry === "string") {
    return { ok: false, message: "Fayl tanlanmagan." };
  }
  if (typeof entry.size !== "number" || entry.size === 0) {
    return { ok: false, message: "Fayl bo‘sh — yaroqli fayl tanlang." };
  }
  const limit = MAX_BYTES_BY_PURPOSE[purpose];
  if (entry.size > limit) {
    return {
      ok: false,
      message: `Fayl hajmi juda katta: ruxsat etilgan chegara ${formatBytes(limit)}.`,
    };
  }
  const bytes = new Uint8Array(await entry.arrayBuffer());
  if (bytes.length !== entry.size) {
    return { ok: false, message: "Fayl to‘liq yuklanmadi. Qayta urinib ko‘ring." };
  }
  return { ok: true, candidate: { bytes, fileName: entry.name || "fayl" } };
}

/* ----------------------------- teacher: profile ---------------------------- */

export async function uploadTeacherProfileImageAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = profileImageUploadSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Ruxsat etilmagan maydon yuborildi." };
    }
    const candidate = await readCandidate(form, "teacher_profile_image");
    if (!candidate.ok) return { ok: false, code: "invalid_input", message: candidate.message };

    const stored = await uploadTeacherProfileImage(user.id, candidate.candidate);
    const result = fromFileResult(stored, "Rasm yuklanmadi.");
    if (!result.ok) return result;

    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${user.id}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return failure("uploadTeacherProfileImageAction", error);
  }
}

export async function removeTeacherProfileImageAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = profileImageUploadSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Ruxsat etilmagan maydon yuborildi." };
    }
    const removed = await removeTeacherProfileImage(user.id);
    const result = fromFileResult(removed, "Rasmni o‘chirib bo‘lmadi.");
    if (!result.ok) return result;

    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teachers");
    return { ok: true };
  } catch (error) {
    return failure("removeTeacherProfileImageAction", error);
  }
}

/* ------------------------------- course cover ------------------------------ */

export async function uploadCourseCoverAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = courseCoverUploadSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Kurs identifikatori noto‘g‘ri." };
    }
    const candidate = await readCandidate(form, "course_cover_image");
    if (!candidate.ok) return { ok: false, code: "invalid_input", message: candidate.message };

    const stored = await uploadCourseCover(user.id, parsed.data.courseId, candidate.candidate);
    const result = fromFileResult(stored, "Muqova yuklanmadi.");
    if (!result.ok) return result;

    revalidatePath(`/teacher/dashboard/courses/${parsed.data.courseId}/edit`);
    revalidatePath("/teacher/dashboard/courses");
    revalidatePath("/courses");
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    return failure("uploadCourseCoverAction", error);
  }
}

export async function removeCourseCoverAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = courseCoverRemovalSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Kurs identifikatori noto‘g‘ri." };
    }
    const removed = await removeCourseCover(user.id, parsed.data.courseId);
    const result = fromFileResult(removed, "Muqovani o‘chirib bo‘lmadi.");
    if (!result.ok) return result;

    revalidatePath(`/teacher/dashboard/courses/${parsed.data.courseId}/edit`);
    revalidatePath("/teacher/dashboard/courses");
    return { ok: true };
  } catch (error) {
    return failure("removeCourseCoverAction", error);
  }
}

/* --------------------------- verification evidence ------------------------- */

export async function uploadVerificationDocumentAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = verificationDocumentUploadSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Hujjat turi ko‘rsatilmagan." };
    }
    const candidate = await readCandidate(form, "teacher_verification_document");
    if (!candidate.ok) return { ok: false, code: "invalid_input", message: candidate.message };

    const stored = await uploadVerificationDocument(
      user.id,
      parsed.data.documentType,
      candidate.candidate,
    );
    const result = fromFileResult(stored, "Hujjat yuklanmadi.");
    if (!result.ok) return result;

    revalidatePath("/teacher/dashboard/verification");
    return { ok: true };
  } catch (error) {
    return failure("uploadVerificationDocumentAction", error);
  }
}

export async function removeVerificationDocumentAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = verificationDocumentRemovalSchema.safeParse(fieldsWithoutFile(form));
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Hujjat identifikatori noto‘g‘ri." };
    }
    const removed = await removeVerificationDocument(user.id, parsed.data.assetId);
    const result = fromFileResult(removed, "Hujjatni o‘chirib bo‘lmadi.");
    if (!result.ok) return result;

    revalidatePath("/teacher/dashboard/verification");
    return { ok: true };
  } catch (error) {
    return failure("removeVerificationDocumentAction", error);
  }
}
