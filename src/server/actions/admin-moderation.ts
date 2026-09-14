"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin } from "../auth/guards";
import { publishCourse, requestCourseChanges } from "../moderation-service";
import {
  publishCourseSchema,
  requestCourseChangesSchema,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Admin course moderation decisions — Phase 15.                               */
/*                                                                              */
/* The action names ARE the intent: `publishCourseAction(reviewId)` and         */
/* `requestCourseChangesAction(reviewId, feedback)`. There is no action that    */
/* accepts a target status, and no payload field for one — `.strict()` rejects  */
/* the attempt.                                                                */
/*                                                                              */
/* Both delegate to moderation-service, where the publication rules (status =    */
/* ready, a live review, and a VERIFIED owner) are re-checked under a row lock. */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Qarorni saqlab bo‘lmadi." };
}

/**
 * Everything that can observe a moderation decision:
 *   • the admin queues and the audit log;
 *   • the teacher's course list and notifications;
 *   • the PUBLIC marketplace — publishing must be visible at request time
 *     without any redeploy.
 */
function revalidateModeration(courseId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/activity");
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/teacher/dashboard");
  revalidatePath("/teacher/dashboard/courses");
  revalidatePath("/notifications");
  revalidatePath("/courses");
  revalidatePath("/teachers");
  revalidatePath("/categories");
}

export async function publishCourseAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = publishCourseSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri ariza identifikatori." };
    }

    const result = await publishCourse(parsed.data.reviewId, admin.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateModeration(String(form.get("courseId") ?? ""));
    return { ok: true };
  } catch (error) {
    return failure("publishCourseAction", error);
  }
}

export async function requestCourseChangesAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = requestCourseChangesSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
      feedback: String(form.get("feedback") ?? "").trim(),
    });
    if (!parsed.success) {
      const fieldError = parsed.error.issues[0]?.message ?? "Sababni kiriting.";
      return { ok: false, code: "invalid_input", message: fieldError, fieldErrors: { feedback: fieldError } };
    }

    const result = await requestCourseChanges(
      parsed.data.reviewId,
      admin.id,
      parsed.data.feedback,
    );
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateModeration(String(form.get("courseId") ?? ""));
    return { ok: true };
  } catch (error) {
    return failure("requestCourseChangesAction", error);
  }
}
