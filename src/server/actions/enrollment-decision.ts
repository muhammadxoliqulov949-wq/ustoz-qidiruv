"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import { acceptRequest, rejectRequest } from "../enrollment-service";
import {
  acceptEnrollmentSchema,
  rejectEnrollmentSchema,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Teacher enrollment decisions — Phase 13.                                    */
/*                                                                              */
/* These actions are thin on purpose: authenticate, validate, delegate to the   */
/* service, revalidate. All the enrollment rules (ownership, transition         */
/* legality, capacity, locking, notifications, history) live in                 */
/* enrollment-service.ts and run inside one transaction there.                  */
/*                                                                              */
/* The action names express INTENT — `acceptEnrollmentAction(requestId)` — so   */
/* there is no code path anywhere that takes a status from a client.            */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  // Never surface a raw database error.
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Amal bajarilmadi." };
}

/** Refresh every surface whose content depends on this request. */
function revalidateDecision(requestId: string): void {
  revalidatePath("/teacher/dashboard/requests");
  revalidatePath(`/teacher/dashboard/requests/${requestId}`);
  revalidatePath("/teacher/dashboard");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath("/notifications");
  // Accepting or releasing a seat changes public availability.
  revalidatePath("/courses");
}

export async function acceptEnrollmentAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = acceptEnrollmentSchema.safeParse({
      requestId: String(form.get("requestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri so‘rov identifikatori." };
    }

    const result = await acceptRequest(parsed.data.requestId, user.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateDecision(parsed.data.requestId);
    return { ok: true };
  } catch (error) {
    return failure("acceptEnrollmentAction", error);
  }
}

export async function rejectEnrollmentAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const rawReason = String(form.get("reason") ?? "").trim();
    const parsed = rejectEnrollmentSchema.safeParse({
      requestId: String(form.get("requestId") ?? ""),
      // A reason is optional; an empty field means "no reason given", not "".
      reason: rawReason === "" ? null : rawReason,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Rad etish sababi 300 belgidan oshmasin.",
      };
    }

    const result = await rejectRequest(parsed.data.requestId, user.id, parsed.data.reason);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateDecision(parsed.data.requestId);
    return { ok: true };
  } catch (error) {
    return failure("rejectEnrollmentAction", error);
  }
}
