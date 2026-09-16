"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireRole } from "../auth/guards";
import { paymeConfig, paymentsEnabled } from "../env";
import { ensurePaymentForEnrollment } from "../payments/payment-service";
import { paymeProvider } from "../payments/payme-adapter";
import { startPaymentSchema, type ActionResult } from "../validation";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMITED_MESSAGE,
  consumeRateLimit,
  rateLimitKey,
} from "../rate-limit";

/* -------------------------------------------------------------------------- */
/* Student payment initiation — Phase 14.                                      */
/*                                                                              */
/* WHAT THE BROWSER SENDS: an enrollment id. That is all.                       */
/*                                                                              */
/* It does NOT send — and this action would not read — an amount, a price, a    */
/* currency, a student id, a payment status, or a return URL. The amount is     */
/* derived server-side from the course price on the accepted enrollment, and    */
/* the return URL is built from server configuration. Zod `.strict()` rejects   */
/* the payload outright if a caller invents an extra field.                     */
/*                                                                              */
/* This action can only ever create a PENDING obligation and hand back a        */
/* provider URL. Nothing here can mark a payment succeeded; only the            */
/* authenticated Payme callback can do that.                                    */
/* -------------------------------------------------------------------------- */

function failure(
  scope: string,
  error: unknown,
): ActionResult<{ paymentId: string; checkoutUrl: string }> {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "To‘lovni boshlab bo‘lmadi." };
}

/**
 * Create (or reuse) the payment obligation for an accepted enrollment and
 * return the provider checkout URL to redirect to.
 */
export async function startPaymentAction(
  form: FormData,
): Promise<ActionResult<{ paymentId: string; checkoutUrl: string }>> {
  try {
    // Students pay. A teacher reaching this action is refused by role, not by
    // a UI condition — a teacher must never be able to initiate or settle.
    const user = await requireRole("student");

    if (!paymentsEnabled()) {
      return {
        ok: false,
        code: "not_configured",
        message: "To‘lov tizimi hali ulanmagan.",
      };
    }

    const parsed = startPaymentSchema.safeParse({
      enrollmentRequestId: String(form.get("enrollmentRequestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri yozilish identifikatori." };
    }

    // Phase 22: per-student initiation budget, before the obligation path runs.
    const budget = await consumeRateLimit(
      RATE_LIMIT_POLICIES.paymentStart,
      rateLimitKey("payment:start", user.id),
    );
    if (!budget.allowed) {
      return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
    }

    // Ownership, accepted-status and free-course rules all live in the service.
    const result = await ensurePaymentForEnrollment(parsed.data.enrollmentRequestId, user.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    const config = paymeConfig();
    if (!config) {
      return { ok: false, code: "not_configured", message: "To‘lov tizimi hali ulanmagan." };
    }

    /*
     * The return URL is derived from SERVER configuration, never from the
     * client. Accepting a caller-supplied callback would let anyone bounce a
     * payer to an arbitrary site under our merchant's name.
     */
    const returnUrl = config.appBaseUrl
      ? `${config.appBaseUrl.replace(/\/+$/, "")}/dashboard/payments/${result.payment.id}`
      : null;

    const checkoutUrl = paymeProvider.buildCheckoutUrl({
      paymentId: result.payment.id,
      amountTiyin: result.payment.amountTiyin,
      returnUrl,
    });

    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/payments/${result.payment.id}`);

    return { ok: true, data: { paymentId: result.payment.id, checkoutUrl } };
  } catch (error) {
    return failure("startPaymentAction", error);
  }
}
