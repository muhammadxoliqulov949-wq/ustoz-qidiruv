/* -------------------------------------------------------------------------- */
/* Payment status — Phase 14. Pure, provider-agnostic, no dependencies.        */
/*                                                                              */
/* THIS IS A DIFFERENT DOMAIN FROM ENROLLMENT.                                  */
/* `src/lib/enrollment-status.ts` answers "does this student have a place?".    */
/* This file answers "has that place been paid for?". They are deliberately     */
/* not merged: a student may legitimately be `enrollment = accepted` and        */
/* `payment = pending`, and adding `paid` to the enrollment enum would destroy  */
/* that distinction and make the seat-capacity rules ambiguous.                 */
/*                                                                              */
/* Nothing Payme-specific belongs in this file. Provider transaction states     */
/* (1, 2, -1, -2) live in the Payme adapter; this is what the PRODUCT knows.    */
/* -------------------------------------------------------------------------- */

export const PAYMENT_STATUSES = ["pending", "succeeded", "cancelled", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Statuses that mean "this obligation is still live" — i.e. it either is, or
 * still could become, a real payment. At most one live payment may exist per
 * enrollment; a partial unique index in the schema enforces it.
 */
export const LIVE_PAYMENT_STATUSES = ["pending", "succeeded"] as const;

/** The only status that means money actually arrived. */
export const PAID_STATUS: PaymentStatus = "succeeded";

/**
 * Allowed internal transitions.
 *
 * `succeeded` is TERMINAL in Phase 14. Payme's protocol can cancel an already
 * performed transaction (state -2), but refunds are not implemented, so that
 * path is handled and recorded by the adapter without inventing a customer
 * facing "refunded" status the product cannot honour. See README.
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["succeeded", "cancelled", "failed"],
  succeeded: [],
  cancelled: [],
  failed: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** A payment nobody can move any further. */
export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** True when this obligation is still open and awaiting money. */
export function isPayable(status: PaymentStatus): boolean {
  return status === "pending";
}

/**
 * True when a NEW attempt may be started.
 *
 * A cancelled or failed attempt is a dead end, not a debt: the student may try
 * again, and `payments_one_live_per_enrollment` no longer blocks a fresh
 * obligation because neither status counts as live. A succeeded payment is
 * never retryable — that would be charging twice.
 */
export function canRetryPayment(status: PaymentStatus): boolean {
  return status === "cancelled" || status === "failed";
}

/* ------------------------------ presentation ------------------------------- */

/**
 * What the STUDENT sees. Deliberately factual: a paid course is "paid", never
 * "completed", "active" or "certified" — payment is not course completion.
 */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "To‘lov jarayonda",
  succeeded: "To‘lov qilindi",
  cancelled: "To‘lov bekor qilindi",
  failed: "To‘lov amalga oshmadi",
};

/** Shown when a paid enrollment has no payment row yet. */
export const PAYMENT_REQUIRED_LABEL = "To‘lov kutilmoqda";

/** Shown for an accepted enrollment on a free course. */
export const PAYMENT_NOT_REQUIRED_LABEL = "To‘lov talab qilinmaydi";

/** Free-course explanation on the student's card. */
export const FREE_COURSE_NOTE = "Kurs bepul. To‘lov talab qilinmaydi.";

/**
 * Refusal shown when a student tries to cancel an enrollment they have already
 * paid for.
 *
 * Phase 17 KEEPS the refusal — a paid place still cannot be cancelled by the
 * self-service button, because that would take the seat away while the money
 * stayed with the course — and now names the path that does exist: a refund
 * request, which an administrator reviews and the provider confirms.
 */
export const PAID_CANCELLATION_BLOCKED =
  "To‘langan yozilishni to‘g‘ridan-to‘g‘ri bekor qilib bo‘lmaydi: avval pulni qaytarish so‘rovini yuboring. So‘rov administrator tomonidan ko‘rib chiqiladi.";

/** Shown when payments are not configured for this deployment. */
export const PAYMENT_UNAVAILABLE_NOTE = "To‘lov tizimi hali ulanmagan.";

export const PAYMENT_STATUS_NOTE: Record<PaymentStatus, string> = {
  pending:
    "To‘lov boshlandi. To‘lov tasdiqlangach, holat avtomatik yangilanadi.",
  succeeded: "To‘lov tasdiqlandi. Bu kursni tugatganingizni anglatmaydi.",
  cancelled: "Bu to‘lov bekor qilindi. Qayta urinib ko‘rishingiz mumkin.",
  failed: "To‘lov amalga oshmadi. Qayta urinib ko‘rishingiz mumkin.",
};

/** Badge tone. Status is ALWAYS accompanied by text — never colour alone. */
export function paymentStatusTone(
  status: PaymentStatus,
): "accent" | "success" | "neutral" | "danger" {
  if (status === "succeeded") return "success";
  if (status === "pending") return "accent";
  if (status === "failed") return "danger";
  return "neutral";
}

/**
 * What the TEACHER may see. A minimal factual projection: whether the place
 * has been paid for. No amounts, no provider data, no transaction identifiers
 * — and nothing the teacher could act on, because a teacher must never be able
 * to mark a payment as paid.
 */
export type TeacherPaymentView = "not_required" | "awaiting" | "paid";

export const TEACHER_PAYMENT_LABEL: Record<TeacherPaymentView, string> = {
  not_required: PAYMENT_NOT_REQUIRED_LABEL,
  awaiting: PAYMENT_REQUIRED_LABEL,
  paid: "To‘lov qilindi",
};

/** Collapse the internal status into the teacher-visible projection. */
export function teacherPaymentView(
  isFree: boolean,
  status: PaymentStatus | null,
): TeacherPaymentView {
  if (isFree) return "not_required";
  return status === "succeeded" ? "paid" : "awaiting";
}
