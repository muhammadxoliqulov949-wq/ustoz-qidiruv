/* -------------------------------------------------------------------------- */
/* Course moderation — Phase 15. Pure, dependency-free, shared.                */
/*                                                                              */
/* THE CONTRACT (one place, used by the teacher UI, the admin UI and both       */
/* server services):                                                            */
/*                                                                              */
/*   teacher : draft ──► ready            (submits for moderation)              */
/*   teacher : ready ──► draft            (withdraws before a decision)         */
/*   admin   : ready ──► published        (approve)                             */
/*   admin   : ready ──► draft            (request changes, with feedback)      */
/*                                                                              */
/* `published` remains content-locked: a teacher may pause a live listing or   */
/* resume it after a pause, but may not edit or silently re-moderate it.        */
/* Archiving is terminal. This keeps lifecycle visibility real without          */
/* inventing a live-content editing workflow.                                   */
/*                                                                              */
/* Course status carries NO `rejected` value. A returned course is a `draft`    */
/* again; the decision itself lives on `course_moderation_reviews`, so the      */
/* course column stays a current state instead of an accumulating scar.         */
/* -------------------------------------------------------------------------- */

export const COURSE_STATES = ["draft", "ready", "published", "paused", "archived"] as const;
export type CourseState = (typeof COURSE_STATES)[number];

export const MODERATION_REVIEW_STATES = ["pending", "approved", "changes_requested"] as const;
export type ModerationReviewState = (typeof MODERATION_REVIEW_STATES)[number];

/** Reviewer feedback bounds. Mirrors the DB CHECK constraints exactly. */
export const MODERATION_FEEDBACK_MIN_LENGTH = 10;
export const MODERATION_FEEDBACK_MAX_LENGTH = 500;

/**
 * Who may move a course from `from` to `to`.
 *
 * Mirrors `lib/enrollment-status.ts` in shape so there is exactly one kind of
 * transition contract in the codebase. Server services consult it BEFORE
 * writing, inside the transaction that re-reads the current status.
 */
export type ModerationActor = "teacher" | "admin";

const TRANSITIONS: Record<ModerationActor, Partial<Record<CourseState, CourseState[]>>> = {
  teacher: {
    draft: ["ready", "archived"],
    // Withdrawing a submission is legitimate: the teacher may spot a mistake
    // while waiting. Occupancy-style side effects do not exist here.
    ready: ["draft"],
    // Pausing is an unpublish operation, not an edit. Resuming is allowed only
    // through the guarded service path, which re-checks teacher verification.
    published: ["paused"],
    paused: ["published", "archived"],
  },
  admin: {
    ready: ["published", "draft"],
  },
};

export function canTransitionCourse(
  actor: ModerationActor,
  from: CourseState,
  to: CourseState,
): boolean {
  return TRANSITIONS[actor][from]?.includes(to) ?? false;
}

export function allowedCourseTransitions(
  actor: ModerationActor,
  from: CourseState,
): readonly CourseState[] {
  return TRANSITIONS[actor][from] ?? [];
}

/**
 * A course awaiting a moderation decision. The teacher must not edit it while
 * an admin has it open — an edit mid-review would make the decision describe a
 * version of the course that no longer exists.
 */
export function isUnderReview(status: CourseState): boolean {
  return status === "ready";
}

/** A live or retired listing. Read-only from the teacher authoring flow. */
export function isLockedForTeacher(status: CourseState): boolean {
  return status === "published" || status === "paused" || status === "archived";
}

/** May the teacher edit course content right now? */
export function canTeacherEdit(status: CourseState): boolean {
  return status === "draft";
}

export type CourseLifecycleAction = "pause" | "resume" | "archive";

export const COURSE_LIFECYCLE_ACTION_LABEL: Record<CourseLifecycleAction, string> = {
  pause: "Kursni vaqtincha to‘xtatish",
  resume: "Kursni katalogga qaytarish",
  archive: "Kursni arxivlash",
};

/* --------------------------------- display --------------------------------- */

/** Teacher-facing name for the course's lifecycle state. */
export const COURSE_STATE_LABEL: Record<CourseState, string> = {
  draft: "Qoralama",
  // Deliberately NOT "published" — submission is a request, not an outcome.
  ready: "Ko‘rib chiqish uchun yuborilgan",
  published: "Katalogda e’lon qilingan",
  paused: "Vaqtincha to‘xtatilgan",
  archived: "Arxivlangan",
};

export const COURSE_STATE_TONE: Record<CourseState, "success" | "accent" | "neutral" | "danger"> = {
  draft: "neutral",
  ready: "accent",
  published: "success",
  paused: "accent",
  archived: "neutral",
};

export const MODERATION_REVIEW_STATE_LABEL: Record<ModerationReviewState, string> = {
  pending: "Ko‘rib chiqish kutilmoqda",
  approved: "Tasdiqlangan",
  changes_requested: "O‘zgartirish so‘ralgan",
};

export const MODERATION_REVIEW_STATE_TONE: Record<
  ModerationReviewState,
  "success" | "accent" | "neutral" | "danger"
> = {
  pending: "accent",
  approved: "success",
  changes_requested: "danger",
};

/* ------------------------------ honest copy -------------------------------- */

export const COURSE_UNDER_REVIEW_NOTE =
  "Kurs administrator ko‘rib chiqishini kutmoqda. Ko‘rib chiqish davomida kurs tahrirlanmaydi — avval arizani qaytarib olishingiz mumkin.";

export const COURSE_PUBLISHED_EDIT_LOCKED_NOTE =
  "E’lon qilingan yoki vaqtincha to‘xtatilgan kursni tahrirlash bu bosqichda qo‘llab-quvvatlanmaydi. O‘zgartirish uchun nusxa yarating yoki administrator bilan bog‘laning.";

export const COURSE_PAUSED_NOTE =
  "Kurs katalogdan vaqtincha olib tashlandi. Mavjud yozilishlar, to‘lovlar va xabarlar tarixi saqlanadi.";

export const COURSE_ARCHIVED_NOTE =
  "Kurs arxivlangan va katalogga qaytmaydi. Tarix, yozilishlar va to‘lov ma’lumotlari saqlanadi.";

export const COURSE_CHANGES_REQUESTED_NOTE =
  "Administrator o‘zgartirish so‘radi. Kurs yana qoralama holatida va katalogda ko‘rinmaydi.";

export const COURSE_SUBMITTED_NOTE =
  "Kurs ko‘rib chiqish uchun yuborildi. Natija bildirishnomalar bo‘limida ko‘rinadi.";

/** What an admin is told before an irreversible-feeling decision. */
export const PUBLISH_CONFIRMATION_NOTE =
  "E’lon qilish kursni ommaviy katalogga chiqaradi. Bu amal darhol kuchga kiradi.";

export const REQUEST_CHANGES_CONFIRMATION_NOTE =
  "Kurs qoralama holatiga qaytadi va katalogda ko‘rinmaydi. Ustoz sababni ko‘radi.";
