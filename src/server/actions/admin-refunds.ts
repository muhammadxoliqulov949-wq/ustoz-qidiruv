"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin } from "../auth/guards";
import { approveRefund, recordRefundFailure, rejectRefund } from "../refund-service";
import {
  refundApprovalSchema,
  refundFailureSchema,
  refundRejectionSchema,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Admin refund decisions — Phase 17.                                          */
/*                                                                              */
/* THIN ON PURPOSE: authenticate as an ADMIN, validate intent, delegate to the  */
/* service, revalidate. The row lock, the re-read, the one-decision-only rule,  */
/* the audit row and the notification all live inside one transaction in        */
/* refund-service.ts.                                                          */
/*                                                                              */
/* `requireAdmin()` resolves the operator from the SESSION cookie, so no        */
/* payload can attribute a decision to another admin (`.strict()` would reject  */
/* an `adminUserId` field).                                                     */
/*                                                                              */
/* THERE IS NO "MARK REFUNDED" ACTION HERE, and there must never be one. A       */
/* refund becomes `completed` only through `reconcileProviderRefund`, reached    */
/* from the authenticated Payme `CancelTransaction` callback. An administrator   */
/* who wants the money back performs the refund in the Payme merchant cabinet    */
/* and the callback records it. Approving here means "approved, waiting for the  */
/* provider" — which the UI says out loud.                                      */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Qarorni saqlab bo‘lmadi." };
}

function revalidateRefundDecision(refundRequestId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/refunds");
  revalidatePath(`/admin/refunds/${refundRequestId}`);
  revalidatePath("/admin/activity");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath("/notifications");
  revalidatePath("/teacher/dashboard/requests");
}

/** Approve: the policy decision. NOT the money, which is the provider's job. */
export async function approveRefundAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = refundApprovalSchema.safeParse({
      refundRequestId: String(form.get("refundRequestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri so‘rov identifikatori." };
    }

    const result = await approveRefund({
      refundRequestId: parsed.data.refundRequestId,
      adminUserId: admin.id,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateRefundDecision(parsed.data.refundRequestId);
    return { ok: true };
  } catch (error) {
    return failure("approveRefund", error);
  }
}

/** Reject: the student keeps the place; the money stays where it is. */
export async function rejectRefundAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = refundRejectionSchema.safeParse({
      refundRequestId: String(form.get("refundRequestId") ?? ""),
      feedback: String(form.get("feedback") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Rad etish uchun izoh majburiy (kamida 10 belgi).",
      };
    }

    const result = await rejectRefund({
      refundRequestId: parsed.data.refundRequestId,
      adminUserId: admin.id,
      feedback: parsed.data.feedback,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateRefundDecision(parsed.data.refundRequestId);
    return { ok: true };
  } catch (error) {
    return failure("rejectRefund", error);
  }
}

/** Record the provider operation's genuine failure. Only from awaiting_provider. */
export async function recordRefundFailureAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = refundFailureSchema.safeParse({
      refundRequestId: String(form.get("refundRequestId") ?? ""),
      feedback: String(form.get("feedback") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Natija uchun izoh majburiy (kamida 10 belgi).",
      };
    }

    const result = await recordRefundFailure({
      refundRequestId: parsed.data.refundRequestId,
      adminUserId: admin.id,
      feedback: parsed.data.feedback,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateRefundDecision(parsed.data.refundRequestId);
    return { ok: true };
  } catch (error) {
    return failure("recordRefundFailure", error);
  }
}
