/* -------------------------------------------------------------------------- */
/* Private messaging contract — Phase 16. Pure, dependency-free, shared.       */
/*                                                                             */
/* THE RULE THIS MODULE EXISTS TO STATE                                          */
/*                                                                               */
/*   A conversation exists ONLY between the student of an enrollment request and  */
/*   the teacher who owns that request's course, and ONLY once the request has   */
/*   been ACCEPTED.                                                              */
/*                                                                               */
/* There is no "message this user" concept anywhere in the product: no user id   */
/* is ever a participant, no user id is ever accepted from a payload, and no     */
/* route takes a *person* — routes take a conversation, and the server derives   */
/* both participants from the enrollment row every single time.                  */
/*                                                                               */
/* WRITABILITY                                                                   */
/*   accepted  → writable (payment state is irrelevant: accepted + unpaid and    */
/*               accepted + paid both allow messaging, and a free course too)    */
/*   cancelled → history stays visible and readable, composer gone, and the      */
/*               send action refuses SERVER-SIDE (hiding a button is not a rule) */
/*   submitted → no conversation can exist at all                                */
/*   rejected  → no conversation can exist at all                                */
/* -------------------------------------------------------------------------- */

/** Enrollment statuses that permit a conversation to EXIST. */
export const CHATTABLE_ENROLLMENT_STATUSES = ["accepted", "cancelled"] as const;

/** Enrollment statuses that permit WRITING. Only `accepted`. */
export const WRITABLE_ENROLLMENT_STATUSES = ["accepted"] as const;

/** Message body bounds. Mirrors the DB CHECK constraint exactly. */
export const MESSAGE_BODY_MAX_LENGTH = 2000;

/**
 * Messages per minute per sender.
 *
 * Deliberately a SOFT, DB-derived guard: the count lives in PostgreSQL, so it
 * behaves the same on one local process and across every serverless instance.
 * (An in-memory limiter would be a lie in production.) A precise token bucket
 * belongs to the Phase 20 hardening pass along with real abuse tooling.
 */
export const MESSAGE_RATE_LIMIT_PER_MINUTE = 30;

/** How many messages one page of history renders. Cursor paging, never "all". */
export const MESSAGES_PAGE_SIZE = 30;

/** Copy — defined once so every surface (and the tests) can rely on it. */
export const MESSAGING_COPY = {
  studentEmpty: "Hozircha suhbatlaringiz yo‘q.",
  studentEmptyNote:
    "Suhbat ustoz yozilish so‘rovingizni qabul qilgandan so‘ng ochiladi. Qabul qilingan so‘rovlar “So‘rovlarim” bo‘limida.",
  teacherEmpty: "Hozircha suhbatlar yo‘q.",
  teacherEmptyNote:
    "Suhbat o‘quvchi qabul qilingandan keyin ochiladi. Qabul qilingan so‘rovlar “So‘rovlar” bo‘limida.",
  readOnlyNotice: "Yozilish bekor qilingan. Suhbat faqat o‘qish rejimida.",
  readOnlyShort: "Faqat o‘qish rejimida",
  noMessagesYet: "Hali xabar yo‘q. Birinchi xabarni yozing.",
  olderPage: "Oldingi xabarlarni ko‘rish",
  backToLatest: "Eng yangi xabarlarga qaytish",
  composerLabel: "Xabar matni",
  composerHint:
    "Matn xabar sifatida yuboriladi. Fayl, rasm yoki ovozli xabar yuborish hozircha mavjud emas.",
  sendLabel: "Yuborish",
  sendingLabel: "Yuborilmoqda…",
  sentNotice: "Xabar yuborildi.",
  failedNotice: "Xabarni yuborib bo‘lmadi. Qayta urinib ko‘ring.",
  rateLimited: "Juda ko‘p xabar yuborildi. Bir daqiqadan so‘ng qayta urinib ko‘ring.",
  unreadLabel: "O‘qilmagan xabarlar",
  noPhoneNote: "Telefon raqami suhbatda ko‘rsatilmaydi.",
} as const;

export type MessagingRole = "student" | "teacher";

/** A conversation is addressed by id; a PARTICIPANT never appears in a URL. */
export function conversationHref(role: MessagingRole, conversationId: string): string {
  return role === "student"
    ? `/dashboard/messages/${conversationId}`
    : `/teacher/dashboard/messages/${conversationId}`;
}

export function conversationsHref(role: MessagingRole): string {
  return role === "student" ? "/dashboard/messages" : "/teacher/dashboard/messages";
}

/**
 * One-line preview for the conversation list. Collapses every run of
 * whitespace (including the line breaks a message may legitimately contain)
 * and truncates on a word boundary. Pure — the list renders its output.
 */
export function messagePreview(body: string, max = 80): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** True when a conversation with this enrollment status may be written to. */
export function enrollmentAllowsMessaging(status: string): boolean {
  return (WRITABLE_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}
