/* -------------------------------------------------------------------------- */
/* Refund status — Phase 17. Pure, provider-agnostic, no dependencies.         */
/*                                                                             */
/* THIS IS A THIRD DOMAIN, NOT A FIFTH ENROLLMENT STATE.                        */
/*   `src/lib/enrollment-status.ts` answers "does this student have a place?"    */
/*   `src/lib/payment-status.ts`    answers "did the money actually arrive?"     */
/*   this file                      answers "has that money been given back,     */
/*                                   and on whose authority?"                    */
/*                                                                             */
/* A refund in flight is therefore `enrollment = accepted` +                     */
/* `payment = succeeded` + `refund = requested | awaiting_provider`. The seat    */
/* stays OCCUPIED through both of those stages: a place is only released once a  */
/* provider-authenticated confirmation proves the money went back, which is when */
/* the enrollment itself becomes `cancelled`.                                    */
/*                                                                             */
/* Nothing Payme-specific belongs here. Protocol states (1, 2, -1, -2), method  */
/* names and numeric reason codes live in the Payme adapter, which maps          */
/*   provider event  →  domain event                                             */
/*   "Payme CancelTransaction on a performed transaction"                        */
/*       →  `provider_refund_confirmed`                                          */
/* A future CLICK adapter emits the same domain event (see README).              */
/* -------------------------------------------------------------------------- */

export const REFUND_STATUSES = [
  "requested",
  "awaiting_provider",
  "completed",
  "rejected",
  "failed",
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Statuses that mean "a decision or a payment provider is still holding this".
 *
 * One live refund per payment is enforced by a partial unique index, so these
 * are exactly the statuses where a second request must be refused. A `rejected`
 * or `failed` refund is history and does not block a later, legitimate request.
 *
 * `approved` is deliberately NOT a stored status: the official Payme Business
 * documentation exposes no merchant-side refund API — the merchant returns the
 * money in the merchant cabinet — so the admin's approval and the wait for that
 * provider operation are the same instant. The decision itself is recorded on
 * `refund_requests(reviewed_by_admin_user_id, reviewed_at)` and in the
 * immutable `refund_events` row of type `approved`.
 */
export const LIVE_REFUND_STATUSES = ["requested", "awaiting_provider"] as const;

/** Only provider evidence produces this. Never written from a page or a form. */
export const COMPLETED_STATUS: RefundStatus = "completed";

export function isLiveRefundStatus(status: RefundStatus): boolean {
  return (LIVE_REFUND_STATUSES as readonly RefundStatus[]).includes(status);
}

/** A refund that can no longer change. */
export function isFinalRefundStatus(status: RefundStatus): boolean {
  return status === "completed" || status === "rejected" || status === "failed";
}

/* ------------------------------- boundaries -------------------------------- */

/** Reasons are plain text, bounded, and rendered escaped. */
export const REFUND_REASON_MIN_LENGTH = 10;
export const REFUND_REASON_MAX_LENGTH = 1000;

/** Admin feedback (rejection, or a recorded provider failure) is mandatory. */
export const REFUND_FEEDBACK_MIN_LENGTH = 10;
export const REFUND_FEEDBACK_MAX_LENGTH = 1000;

/* ------------------------------ presentation ------------------------------- */

/**
 * What the STUDENT sees.
 *
 * `completed` is the ONLY wording that claims the money came back, and it can
 * only be reached through an authenticated provider callback. Every other state
 * says what is actually true — that a request was made, that a decision is
 * pending, that a decision was made, or that the provider operation failed.
 */
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  requested: "Pulni qaytarish so‘rovi yuborildi",
  awaiting_provider: "Pulni qaytarish jarayonda",
  completed: "To‘lov qaytarildi",
  rejected: "Pulni qaytarish so‘rovi rad etildi",
  failed: "Pulni qaytarish amalga oshmadi",
};

export const REFUND_STATUS_NOTE: Record<RefundStatus, string> = {
  requested:
    "So‘rov administrator tomonidan ko‘rib chiqiladi. Bu bosqichda joy sizda qoladi va pul hali qaytarilmagan.",
  awaiting_provider:
    "Administrator so‘rovni tasdiqladi. Pul Payme orqali qaytarilishi kerak — qaytarish tasdiqlangandan keyin holat yakuniy bo‘ladi.",
  completed: "To‘lov provayderi qaytarishni tasdiqladi. Yozilish bekor qilindi va joy bo‘shatildi.",
  rejected:
    "Administrator so‘rovni rad etdi. Yozilish va to‘lov holati o‘zgarmadi — joy sizda qoladi.",
  failed:
    "Provayder tomonidan qaytarishni yakunlab bo‘lmadi. Sabab quyida ko‘rsatilgan; yozilish holati o‘zgarmadi.",
};

/** Short factual line for a compact badge area. */
export const REFUND_STATUS_SHORT: Record<RefundStatus, string> = {
  requested: "Qaytarish so‘ralgan",
  awaiting_provider: "Provayderda",
  completed: "Qaytarildi",
  rejected: "Rad etilgan",
  failed: "Bajarilmadi",
};

/**
 * What the TEACHER may see (§24). A minimal factual projection with no amounts,
 * no provider data and nothing the teacher could act on: refund decisions are
 * the administrator's, and a teacher must never be able to move money.
 */
export const TEACHER_REFUND_LABEL: Record<RefundStatus, string> = {
  requested: "Pulni qaytarish so‘ralgan",
  awaiting_provider: "Pulni qaytarish jarayonda",
  completed: "To‘lov qaytarildi — yozilish bekor qilindi",
  rejected: "Pulni qaytarish so‘rovi rad etilgan",
  failed: "Pulni qaytarish amalga oshmadi",
};

/** Badge tone. Status text is ALWAYS rendered with it — never colour alone. */
export function refundStatusTone(
  status: RefundStatus,
): "accent" | "success" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "requested" || status === "awaiting_provider") return "accent";
  return "neutral";
}

/* ---------------------------------- copy ----------------------------------- */

/** The student's way out of the paid-cancellation dead end. */
export const REFUND_REQUEST_CTA = "Bekor qilish va pulni qaytarishni so‘rash";

/**
 * The honest pre-submission notice (§8). It says who decides and, above all,
 * that submitting a request is NOT the same thing as being refunded.
 */
export const REFUND_REQUEST_NOTICE =
  "So‘rov administrator tomonidan ko‘rib chiqiladi. Pul faqat to‘lov provayderi orqali qaytarish tasdiqlangandan keyin qaytarilgan hisoblanadi.";

export const REFUND_REQUEST_ACK =
  "So‘rov yuborildi. Administrator ko‘rib chiqadi; pul qaytarilgach holat avtomatik yangilanadi.";

/** Free courses have no money to return. */
export const REFUND_NOT_AVAILABLE_FREE = "Kurs bepul — qaytarish uchun to‘lov yo‘q.";

/** Unpaid (or failed/cancelled) payment: the ordinary cancel button applies. */
export const REFUND_NOT_AVAILABLE_UNPAID =
  "To‘lov hali tasdiqlanmagan — qaytarish so‘rovi faqat to‘langan yozilish uchun.";

export const REFUND_NOT_AVAILABLE_ENROLLMENT =
  "Pulni qaytarish faqat qabul qilingan yozilish uchun so‘raladi.";

/**
 * ADMIN-facing statement of the provider boundary. This is the verified truth
 * from the official Payme Business documentation, not a placeholder: refunds to
 * buyers are performed by the merchant IN THE PAYME MERCHANT CABINET, and a
 * refund is only possible if the merchant implements CancelTransaction. There is
 * no merchant-side outbound refund API to call.
 */
export const REFUND_PROVIDER_PENDING_NOTE =
  "Payme’da qaytarishni amalga oshirish kutilmoqda.";

export const REFUND_PROVIDER_BOUNDARY_NOTE =
  "Rasmiy Payme Business hujjatlariga ko‘ra pul qaytarish merchant kabinetida amalga oshiriladi va faqat CancelTransaction qo‘llab-quvvatlansa mumkin. Ilova tashqariga qaytarish so‘rovi yubormaydi — yakuniy holat faqat Payme’ning autentifikatsiyalangan CancelTransaction chaqiruvi bilan qayd etiladi.";

/** Retry guidance after a recorded provider failure (admin-facing). */
export const REFUND_FAILED_RETRY_NOTE =
  "Bajarilmagan so‘rovdan keyin o‘quvchi yangi so‘rov yuborishi mumkin; joy va to‘lov holati o‘zgarmagan.";

/* -------------------------------- eligibility ------------------------------ */

export interface RefundEligibilityInput {
  enrollmentStatus: string;
  coursePriceUzs: number;
  paymentStatus: string | null;
  hasLiveRefund: boolean;
}

export type RefundEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * The single answer to "may this student ask for their money back?", used by the
 * service (authorization) and by the dashboard (what to render). Both call the
 * same function so the button and the rule cannot drift.
 */
export function refundEligibility(input: RefundEligibilityInput): RefundEligibility {
  if (input.enrollmentStatus !== "accepted") {
    return { eligible: false, reason: REFUND_NOT_AVAILABLE_ENROLLMENT };
  }
  if (input.coursePriceUzs === 0) {
    return { eligible: false, reason: REFUND_NOT_AVAILABLE_FREE };
  }
  if (input.paymentStatus !== "succeeded") {
    return { eligible: false, reason: REFUND_NOT_AVAILABLE_UNPAID };
  }
  if (input.hasLiveRefund) {
    return { eligible: false, reason: REFUND_STATUS_NOTE.requested };
  }
  return { eligible: true };
}
