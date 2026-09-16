"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import { requestRefund } from "../refund-service";
import { refundRequestSchema, type ActionResult } from "../validation";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMITED_MESSAGE,
  consumeRateLimit,
  rateLimitKey,
} from "../rate-limit";

/* -------------------------------------------------------------------------- */
/* Student refund requests — Phase 17.                                         */
/*                                                                              */
/* THIN ON PURPOSE: authenticate as a STUDENT, validate intent, delegate to the */
/* service, revalidate. The eligibility rule, the row lock, the amount snapshot */
/* and the one-live-request guarantee all live in refund-service.ts.            */
/*                                                                              */
/* WHAT THIS ACTION ACCEPTS: an enrollment id and a reason. Nothing else.       */
/* The schema is `.strict()`, so a payload carrying `paymentId`, `studentId`,   */
/* `amount`, `status`, `provider` or `teacherId` is REJECTED — the amount comes  */
/* from the payment's immutable snapshot and the student comes from the session  */
/* cookie, which is why there is no code path here that could read either from   */
/* a form even by accident.                                                      */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "So‘rovni yuborib bo‘lmadi." };
}

function revalidateRefundSurfaces(): void {
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/admin/refunds");
  revalidatePath("/admin");
}

export async function requestRefundAction(
  form: FormData,
): Promise<ActionResult<{ refundRequestId: string; created: boolean }>> {
  try {
    const user = await requireRole("student");
    const parsed = refundRequestSchema.safeParse({
      enrollmentRequestId: String(form.get("enrollmentRequestId") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "So‘rov ma’lumotlari noto‘g‘ri. Sababni kamida 10 belgi bilan yozing.",
      };
    }

    // Phase 22: per-student refund-request budget, before the money path runs.
    const budget = await consumeRateLimit(
      RATE_LIMIT_POLICIES.refundRequest,
      rateLimitKey("refund:request", user.id),
    );
    if (!budget.allowed) {
      return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
    }

    const result = await requestRefund({
      enrollmentRequestId: parsed.data.enrollmentRequestId,
      studentUserId: user.id,
      reason: parsed.data.reason,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateRefundSurfaces();
    return {
      ok: true,
      data: { refundRequestId: result.data.refundRequestId, created: result.data.created },
    };
  } catch (error) {
    return failure("requestRefund", error);
  }
}
