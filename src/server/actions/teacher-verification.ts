"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import { submitVerificationRequest } from "../verification-service";
import { submitTeacherVerificationSchema, type ActionResult } from "../validation";

/* -------------------------------------------------------------------------- */
/* Teacher verification submission — Phase 15.                                 */
/*                                                                              */
/* The subject of the application is ALWAYS the session user. The action takes  */
/* no parameters it could be lied to about, and its Zod schema is an EMPTY      */
/* `.strict()` object — so posting `teacherUserId`, `verification: "verified"`  */
/* or anything else at all is a validation ERROR, not a silently ignored field. */
/*                                                                              */
/* Self-verification is therefore impossible by construction: this action can   */
/* only ever create a PENDING application. The words "verified" and the profile */
/* column it lives in are written exclusively by the admin decision path.       */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Ariza yuborilmadi." };
}

export async function submitTeacherVerificationAction(
  form: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");

    /*
     * Reject over-posting before doing anything else. `{}` is the only payload
     * this action accepts; every field a browser might add is refused here.
     */
    const parsed = submitTeacherVerificationSchema.safeParse(
      Object.fromEntries(form.entries()),
    );
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "So‘rovda ruxsat etilmagan maydon bor.",
      };
    }

    const result = await submitVerificationRequest(user.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidatePath("/teacher/dashboard/verification");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/admin");
    revalidatePath("/admin/teachers");
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    return failure("submitTeacherVerificationAction", error);
  }
}
