/* -------------------------------------------------------------------------- */
/* Teacher verification — Phase 15. Pure, dependency-free, shared.             */
/*                                                                              */
/* This module owns the ONE definition of "is this profile detailed enough to   */
/* be reviewed". The teacher dashboard renders it, the guard on the submission  */
/* action enforces it, and both read from the same list so the UI can never     */
/* claim eligibility the server would refuse (or hide a requirement the server  */
/* would accept).                                                              */
/*                                                                              */
/* WHAT VERIFICATION IS NOT                                                      */
/* There is no document review, no ID check and no upload infrastructure in      */
/* this phase. The admin reviews the PUBLIC PROFILE DATA the teacher already     */
/* wrote. The copy below says so plainly rather than implying documents were     */
/* examined, and `DOCUMENT_REVIEW_NOTICE` is the single honest sentence used     */
/* anywhere the subject comes up.                                                */
/* -------------------------------------------------------------------------- */

export const VERIFICATION_STATES = ["unverified", "pending", "verified"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const VERIFICATION_REQUEST_STATES = ["pending", "approved", "rejected"] as const;
export type VerificationRequestState = (typeof VERIFICATION_REQUEST_STATES)[number];

/** Reviewer feedback bounds. Mirrors the DB CHECK constraints exactly. */
export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 500;

/** The profile fields a reviewer needs. Order is the order they are shown in. */
export interface VerificationProfileInput {
  name: string;
  specialization: string | null;
  city: string | null;
  languages: readonly string[];
  bio: string | null;
  approach: string | null;
  experienceYears: number | null;
}

export type VerificationRequirementKey =
  | "name"
  | "specialization"
  | "city"
  | "languages"
  | "experienceYears"
  | "bio"
  | "approach";

export interface VerificationRequirement {
  key: VerificationRequirementKey;
  label: string;
  hint: string;
  satisfied: (profile: VerificationProfileInput) => boolean;
}

/*
 * Substantive minimums, not cosmetic ones: a reviewer cannot make an honest
 * trust decision from "I teach English". The thresholds are stated in the
 * labels so the teacher is never guessing what is missing.
 */
export const VERIFICATION_REQUIREMENTS: readonly VerificationRequirement[] = [
  {
    key: "name",
    label: "To‘liq ism",
    hint: "Kamida 2 belgi.",
    satisfied: (profile) => profile.name.trim().length >= 2,
  },
  {
    key: "specialization",
    label: "Yo‘nalish",
    hint: "Masalan: “IELTS va umumiy ingliz tili”.",
    satisfied: (profile) => (profile.specialization ?? "").trim().length >= 3,
  },
  {
    key: "city",
    label: "Shahar",
    hint: "Profil shahri ko‘rsatilgan bo‘lishi kerak.",
    satisfied: (profile) => (profile.city ?? "").trim().length > 0,
  },
  {
    key: "languages",
    label: "Dars tillari",
    hint: "Kamida bitta til tanlangan bo‘lishi kerak.",
    satisfied: (profile) => profile.languages.length >= 1,
  },
  {
    key: "experienceYears",
    label: "Tajriba (yil)",
    hint: "Raqam kiritilgan bo‘lishi kerak (0 ham mumkin).",
    satisfied: (profile) => profile.experienceYears !== null,
  },
  {
    key: "bio",
    label: "O‘zingiz haqingizda",
    hint: "Kamida 40 belgi — o‘quvchi nimani o‘qishini shu yerdan biladi.",
    satisfied: (profile) => (profile.bio ?? "").trim().length >= 40,
  },
  {
    key: "approach",
    label: "Dars o‘tish uslubi",
    hint: "Kamida 30 belgi — darslar qanday o‘tadi.",
    satisfied: (profile) => (profile.approach ?? "").trim().length >= 30,
  },
];

/** Which requirements are still missing. Empty array ⇒ eligible to submit. */
export function missingVerificationRequirements(
  profile: VerificationProfileInput,
): VerificationRequirement[] {
  return VERIFICATION_REQUIREMENTS.filter((requirement) => !requirement.satisfied(profile));
}

export function isVerificationEligible(profile: VerificationProfileInput): boolean {
  return missingVerificationRequirements(profile).length === 0;
}

/* --------------------------------- display --------------------------------- */

/** Current trust state, as shown to the teacher. */
export const VERIFICATION_STATE_LABEL: Record<VerificationState, string> = {
  unverified: "Tasdiqlanmagan",
  pending: "Ko‘rib chiqilmoqda",
  verified: "Tasdiqlangan",
};

export const VERIFICATION_STATE_NOTE: Record<VerificationState, string> = {
  unverified:
    "Profilingiz tasdiqlanmagan. Tasdiqlash uchun ariza yuborishingiz mumkin — tasdiqlangach profilingiz ommaviy katalogda ishonch belgisi bilan ko‘rinadi.",
  pending:
    "Arizangiz administrator ko‘rib chiqishini kutmoqda. Bu jarayonda profil ma’lumotlarini o‘zgartirsangiz ham, ariza navbatda qoladi.",
  verified:
    "Profilingiz tasdiqlangan. Kurslaringiz moderatsiyadan o‘tgach katalogda ishonch belgisi bilan chiqadi.",
};

export const VERIFICATION_STATE_TONE: Record<VerificationState, "success" | "accent" | "neutral"> = {
  unverified: "neutral",
  pending: "accent",
  verified: "success",
};

/** One application's outcome (the request row, not the profile column). */
export const VERIFICATION_REQUEST_STATE_LABEL: Record<VerificationRequestState, string> = {
  pending: "Ko‘rib chiqilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Qaytarilgan",
};

export const VERIFICATION_REQUEST_STATE_TONE: Record<
  VerificationRequestState,
  "success" | "accent" | "neutral" | "danger"
> = {
  pending: "accent",
  approved: "success",
  rejected: "danger",
};

/* ------------------------------ honest copy -------------------------------- */

/**
 * Shown next to the submission form and on the admin review screen.
 *
 * PHASE 18: documents ARE part of the review now, so this says what the review
 * actually is — a human looking at the profile AND the uploaded evidence — and
 * stops short of claiming a legal identity check the platform cannot perform.
 */
export const DOCUMENT_REVIEW_NOTICE =
  "Ariza profil ma’lumotlari va yuklangan hujjatlar asosida ko‘rib chiqiladi. Bu platforma ishonch tekshiruvi: davlat organi tomonidan shaxsni tasdiqlash emas.";

export const VERIFICATION_MEANS_NOTE =
  "Tasdiqlash profildagi ma’lumotlar (ism, yo‘nalish, shahar, tillar, tajriba, tavsif, dars uslubi) va siz yuklagan hujjatlar asosida amalga oshiriladi.";

/** Phase 18: a submission needs evidence before it can be reviewed at all. */
export const VERIFICATION_DOCUMENTS_REQUIRED_NOTE =
  "Ariza yuborish uchun kamida shaxsni tasdiqlovchi hujjat yuklang.";

/** What pressing the button actually does — no upload, no instant badge. */
export const VERIFICATION_SUBMIT_NOTE =
  "Ariza yuborilgach administrator profilingizni ko‘rib chiqadi. Tasdiqlash profildagi ma’lumotlar asosida bo‘ladi va darhol emas — natija bildirishnoma orqali keladi.";

export const VERIFICATION_SUBMITTED_NOTE =
  "Ariza yuborildi. Administrator ko‘rib chiqqach, natija bildirishnomalar bo‘limida ko‘rinadi.";

export const VERIFICATION_RESUBMIT_NOTE =
  "Profilni to‘ldirib, arizani qayta yuborishingiz mumkin — arizalar soni cheklanmagan.";

export const VERIFICATION_ALREADY_PENDING_NOTE =
  "Sizda allaqachon ko‘rib chiqilayotgan ariza bor.";

export const VERIFICATION_INELIGIBLE_NOTE =
  "Ariza yuborishdan oldin profilning quyidagi bo‘limlarini to‘ldiring:";
