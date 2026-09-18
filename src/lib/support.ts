/* -------------------------------------------------------------------------- */
/* Support/report workflow — Phase 23.                                          */
/*                                                                              */
/* This is intentionally a small internal queue: one ticket has a category,   */
/* plain-text message, optional related record and a guarded status. There is   */
/* no fake email delivery and no promise of an external response channel.       */
/* -------------------------------------------------------------------------- */

export const SUPPORT_CATEGORIES = [
  "account",
  "teacher_course",
  "payment",
  "inappropriate_content",
  "technical",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_RELATED_TYPES = [
  "account",
  "teacher",
  "course",
  "payment",
  "enrollment",
  "review",
  "refund",
  "message",
] as const;
export type SupportRelatedType = (typeof SUPPORT_RELATED_TYPES)[number];

export const SUPPORT_MESSAGE_MIN_LENGTH = 10;
export const SUPPORT_MESSAGE_MAX_LENGTH = 4000;

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  account: "Hisob muammosi",
  teacher_course: "Ustoz yoki kurs muammosi",
  payment: "To‘lov muammosi",
  inappropriate_content: "Nomaqbul kontent",
  technical: "Texnik muammo",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Ochiq",
  in_progress: "Ishlanmoqda",
  resolved: "Hal qilindi",
  closed: "Yopilgan",
};

export const SUPPORT_STATUS_TONE: Record<
  SupportStatus,
  "accent" | "success" | "neutral" | "danger"
> = {
  open: "accent",
  in_progress: "accent",
  resolved: "success",
  closed: "neutral",
};

/**
 * Status transitions are intent-shaped and monotonic by default. Re-opening a
 * resolved ticket is allowed when the reporter follows up; a closed ticket is
 * terminal in the small workflow and must be represented by a new ticket.
 */
const TRANSITIONS: Record<SupportStatus, readonly SupportStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: [],
};

export function canTransitionSupportTicket(
  from: SupportStatus,
  to: SupportStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export const SUPPORT_CLOSED_NOTE =
  "Yopilgan murojaat qayta ochilmaydi. Muammo davom etsa, yangi murojaat yuboring.";

export const SUPPORT_SUBMISSION_NOTE =
  "Murojaat ilova ichidagi operator navbatiga yuboriladi. SMS yoki e-pochta yuborilmaydi; holat shu sahifada ko‘rinadi.";
