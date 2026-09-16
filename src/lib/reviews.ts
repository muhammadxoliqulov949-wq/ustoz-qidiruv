/* -------------------------------------------------------------------------- */
/* Course reviews — Phase 19. Pure, dependency-free, shared.                   */
/*                                                                              */
/* THE CONTRACT (one place, used by the student UI, the admin UI, the server     */
/* actions, the review service and the tests):                                 */
/*                                                                              */
/*   student : (none)     ──► pending     "Fikr qoldirish"                      */
/*   student : pending    ──► edited      (stays pending — still undecided)      */
/*   student : pending    ──► withdrawn   (takes it back before a decision)      */
/*   student : published  ──► pending     (an edit of a LIVE review re-queues it) */
/*   student : published  ──► withdrawn   (takes it down)                        */
/*   student : rejected   ──► pending     (fixes it and resubmits)               */
/*   student : withdrawn  ──► pending     (changes their mind)                   */
/*   admin   : pending    ──► published   (approve — becomes public)             */
/*   admin   : pending    ──► rejected    (decline, optional reason)             */
/*   admin   : published  ──► rejected    (hides it again if it should not be up) */
/*                                                                              */
/* WHAT THIS FILE DOES NOT DO: it never claims a review means "course completed". */
/* The product tracks no completion, so the only thing a review asserts is        */
/* "Tasdiqlangan qatnashuvchi" — an accepted participant. Every label below is    */
/* written to that bar.                                                          */
/*                                                                              */
/* WHAT IT DOES ENFORCE, IN ONE PLACE: the numeric bounds that the database CHECK */
/* constraints also enforce. The UI and the server can therefore never promise a  */
/* length the database would refuse, and a future change to the bounds happens    */
/* here and in the migration together.                                           */
/* -------------------------------------------------------------------------- */

export const REVIEW_STATUSES = ["pending", "published", "rejected", "withdrawn"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Rating bounds. Mirrors `course_reviews_rating_range` exactly. */
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** Body bounds. Mirrors `course_reviews_body_length` exactly. */
export const REVIEW_BODY_MIN_LENGTH = 20;
export const REVIEW_BODY_MAX_LENGTH = 1500;

/**
 * Body normalisation, shared by the client preview, the Zod schema and the service
 * so all three count the SAME characters.
 *
 * Trim, collapse runs of whitespace and strip control characters. A review is plain
 * text rendered as text (React escapes it), so this is about honest LENGTH
 * accounting — 20 newlines is not an opinion — not about escaping.
 */
export function normalizeReviewBody(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Optional rejection note bounds. Mirrors `course_reviews_reason_length`. */
export const REVIEW_REASON_MIN_LENGTH = 10;
export const REVIEW_REASON_MAX_LENGTH = 300;

/**
 * The ONLY status that is public, and the only one that feeds a reputation
 * aggregate. Everything else is invisible to a visitor by definition, not by a
 * `.filter()` a future component could forget.
 */
export const PUBLIC_REVIEW_STATUS: ReviewStatus = "published";

export function isPublicReviewStatus(status: ReviewStatus): boolean {
  return status === PUBLIC_REVIEW_STATUS;
}

/** A review that still counts toward a rating. */
export function countsTowardReputation(status: ReviewStatus): boolean {
  return status === PUBLIC_REVIEW_STATUS;
}

/* -------------------------------- transitions ------------------------------- */

/**
 * Who may move a review from `from` to `to`.
 *
 * Same shape as `lib/enrollment-status.ts` and `lib/course-moderation.ts`, so there
 * is exactly one kind of transition contract in this codebase. The service consults
 * this BEFORE writing, inside the transaction that re-reads the current status — so
 * a stale page cannot replay a decision.
 */
export type ReviewActor = "student" | "admin";

const TRANSITIONS: Record<ReviewActor, Partial<Record<ReviewStatus, ReviewStatus[]>>> = {
  student: {
    // A live review that is edited goes BACK to pending: an admin approved a
    // specific text, and the edited text has not been read.
    published: ["pending", "withdrawn"],
    pending: ["pending", "withdrawn"],
    // Rejected and withdrawn are not dead ends — the student owns the row.
    rejected: ["pending"],
    withdrawn: ["pending"],
  },
  admin: {
    pending: ["published", "rejected"],
    // Hiding an already-public review is a real moderation need. It is NOT a
    // deletion: the row and its history stay, and the aggregate is recomputed.
    published: ["rejected"],
    // A rejected review can be reinstated by publishing it again.
    rejected: ["published"],
  },
};

export function canTransitionReview(
  actor: ReviewActor,
  from: ReviewStatus,
  to: ReviewStatus,
): boolean {
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

/**
 * Submitting a NEW review is only possible when the student has no live review yet.
 * `rejected` and `withdrawn` rows are reused by an edit, so they are not "new".
 */
export function canSubmitNewReview(existing: ReviewStatus | null): boolean {
  return existing === null;
}

/** Whether the student may change the text/rating right now. */
export function canStudentEdit(status: ReviewStatus): boolean {
  return canTransitionReview("student", status, "pending");
}

/** Whether the student may take the review down right now. */
export function canStudentWithdraw(status: ReviewStatus): boolean {
  return canTransitionReview("student", status, "withdrawn");
}

/* --------------------------------- display --------------------------------- */

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Tekshirilmoqda",
  published: "E’lon qilingan",
  rejected: "Qabul qilinmagan",
  withdrawn: "Qaytarib olingan",
};

export const REVIEW_STATUS_TONE: Record<
  ReviewStatus,
  "success" | "accent" | "neutral" | "danger"
> = {
  pending: "accent",
  published: "success",
  // Deliberately NEUTRAL for the student: "rejected" as a word aimed at a learner
  // reads as a verdict on them, and the review is theirs to fix.
  rejected: "neutral",
  withdrawn: "neutral",
};

/* ------------------------------ honest copy -------------------------------- */

/**
 * The author label shown publicly.
 *
 * `student_profiles` has a `name`, but a full name is personal data and this
 * product has no "display name" field a student chose to publish. Inventing one
 * (initials, a nickname, a first name only) would be a decision about their
 * identity they never made, so the public list shows this instead. The admin queue
 * DOES show the real name, because an operator moderating text needs to know who
 * wrote it — and never their phone number.
 */
export const PUBLIC_REVIEW_AUTHOR_LABEL = "Tasdiqlangan o‘quvchi";

/**
 * Why a student is allowed to write at all.
 *
 * NOT "course completed" — the product tracks no completion, and saying so would
 * be a claim the database cannot back. The honest, checkable statement is that
 * their participation was accepted.
 */
export const REVIEW_ELIGIBILITY_LABEL = "Tasdiqlangan qatnashuvchi";

export const REVIEW_SUBMIT_LABEL = "Fikr qoldirish";
export const REVIEW_PENDING_LABEL = "Fikringiz tekshirilmoqda";
export const REVIEW_PUBLISHED_LABEL = "Fikringiz e’lon qilingan";
export const REVIEW_REJECTED_LABEL = "Fikringiz e’lon qilinmadi";
export const REVIEW_WITHDRAWN_LABEL = "Fikringiz qaytarib olindi";

export const REVIEW_PENDING_NOTE =
  "Fikringiz administrator ko‘rib chiqishini kutmoqda. Tasdiqlangach sahifada ko‘rinadi va kurs reytingiga qo‘shiladi.";

export const REVIEW_PUBLISHED_NOTE =
  "Fikringiz sahifada ko‘rinmoqda. Tahrirlasangiz u yana tekshiruvga qaytadi va tekshiruv tugaguncha reytingda hisoblanmaydi.";

export const REVIEW_REJECTED_NOTE =
  "Fikringiz e’lon qilinmadi. Matnni tuzatib qayta yuborishingiz mumkin — u yana tekshiruvdan o‘tadi.";

export const REVIEW_WITHDRAWN_NOTE =
  "Fikringiz sahifadan olib tashlandi va reytingda hisoblanmaydi. Xohlasangiz qayta yuborishingiz mumkin.";

export const REVIEW_EDIT_RETURNS_TO_PENDING_NOTE =
  "E’lon qilingan fikrni tahrirlash uni yana tekshiruvga qaytaradi. Yangi matn tasdiqlanguncha reytingda hisoblanmaydi.";

/** Shown to a signed-in student who is not eligible to write. */
export const REVIEW_NOT_ELIGIBLE_TITLE = "Bu kurs bo‘yicha fikr qoldirish mumkin emas";

export const REVIEW_NOT_ENROLLED_NOTE =
  "Fikrni faqat yozilishi ustoz tomonidan tasdiqlangan o‘quvchilar qoldiradi.";

export const REVIEW_NOT_STARTED_NOTE =
  "Guruh darslari boshlangach fikr qoldirish mumkin bo‘ladi.";

export const REVIEW_ANONYMOUS_NOTE =
  "Fikr qoldirish uchun tizimga kiring. Fikrni faqat tasdiqlangan qatnashuvchilar yozadi.";

/** Empty state — no published written reviews exist for this course yet. */
export const REVIEWS_EMPTY_TITLE = "Bu kurs bo‘yicha hali yozma fikr yo‘q";

export const REVIEWS_EMPTY_BODY =
  "Fikrlar faqat tasdiqlangan qatnashuvchilar tomonidan yoziladi va administrator tekshiruvidan so‘ng e’lon qilinadi.";

export const REVIEWS_AGGREGATE_NOTE =
  "Reyting va fikrlar soni e’lon qilingan haqiqiy fikrlar asosida hisoblanadi.";

/** Admin-side explanation of what a decision does. */
export const REVIEW_PUBLISH_CONFIRMATION_NOTE =
  "E’lon qilish fikrni ommaviy sahifaga chiqaradi va kurs hamda ustoz reytingini darhol o‘zgartiradi.";

export const REVIEW_REJECT_CONFIRMATION_NOTE =
  "Fikr sahifadan olinadi va reytingdan chiqariladi. O‘quvchi matnni tuzatib qayta yuborishi mumkin.";

export const REVIEW_MODERATION_PRIVACY_NOTE =
  "Navbatda o‘quvchining ismi ko‘rinadi — telefon raqami, elektron pochtasi yoki boshqa shaxsiy ma’lumoti ko‘rsatilmaydi.";
