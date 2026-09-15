"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin } from "../auth/guards";
import { approveVerification, rejectVerification } from "../verification-service";
import {
  rejectTeacherVerificationSchema,
  verifyTeacherSchema,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Admin verification decisions — Phase 15.                                    */
/*                                                                              */
/* THIN ON PURPOSE: authenticate as an ADMIN, validate intent, delegate to the  */
/* service, revalidate. Every rule that matters — the lock, the re-read, the    */
/* one-decision-only rule, the audit row, the notification — lives in           */
/* verification-service.ts inside one transaction.                              */
/*                                                                              */
/* `requireAdmin()` resolves the reviewer from the SESSION cookie. There is no  */
/* adminUserId in any payload (`.strict()` would reject one), so a student or   */
/* teacher cannot invoke these actions and no caller can attribute a decision   */
/* to somebody else.                                                           */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Qarorni saqlab bo‘lmadi." };
}

/** Every surface a verification decision can change. */
function revalidateVerification(teacherUserId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/teachers");
  revalidatePath(`/admin/teachers/${teacherUserId}`);
  revalidatePath("/admin/activity");
  revalidatePath("/admin/courses");
  revalidatePath("/teacher/dashboard/verification");
  revalidatePath("/teacher/dashboard");
  revalidatePath("/notifications");
  // Verification drives the public trust badge and who may be listed.
  revalidatePath("/teachers");
  revalidatePath("/courses");
}

export async function verifyTeacherAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = verifyTeacherSchema.safeParse({
      requestId: String(form.get("requestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri ariza identifikatori." };
    }

    const result = await approveVerification(parsed.data.requestId, admin.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateVerification(String(form.get("teacherUserId") ?? ""));
    return { ok: true };
  } catch (error) {
    return failure("verifyTeacherAction", error);
  }
}

export async function rejectTeacherVerificationAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = rejectTeacherVerificationSchema.safeParse({
      requestId: String(form.get("requestId") ?? ""),
      feedback: String(form.get("feedback") ?? "").trim(),
    });
    if (!parsed.success) {
      const fieldError = parsed.error.issues[0]?.message ?? "Sababni kiriting.";
      return { ok: false, code: "invalid_input", message: fieldError, fieldErrors: { feedback: fieldError } };
    }

    const result = await rejectVerification(
      parsed.data.requestId,
      admin.id,
      parsed.data.feedback,
    );
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateVerification(String(form.get("teacherUserId") ?? ""));
    return { ok: true };
  } catch (error) {
    return failure("rejectTeacherVerificationAction", error);
  }
}
