/* -------------------------------------------------------------------------- */
/* Teacher profile editing — pure, dependency-free, shared by client + server.  */
/*                                                                              */
/* WHY THIS MODULE EXISTS                                                        */
/* The verification screen (/teacher/dashboard/verification) refuses an          */
/* application until six profile fields are filled in, and the profile screen    */
/* (/teacher/dashboard/profile) is where the teacher fills them in. Those two    */
/* surfaces used to agree on nothing: the editor wrote a browser-only draft and  */
/* the requirement lived in the database row, so a teacher could be told to      */
/* complete a profile they had no way to complete.                               */
/*                                                                              */
/* This module is the single description of the EDITABLE persisted profile:      */
/*   • WHICH fields the form posts (`TEACHER_PROFILE_FIELDS`),                   */
/*   • the bounds the server schema enforces (`TEACHER_PROFILE_LIMITS`),         */
/*   • the shape of the values (`TeacherProfileEditValues`),                     */
/*   • the ONE FormData builder both the form and the tests call.                */
/*                                                                              */
/* It deliberately contains no verification policy: "is this enough to be        */
/* reviewed" stays in lib/teacher-verification.ts, which this module does not    */
/* import. The editor imports BOTH and renders the requirement labels next to    */
/* the fields that satisfy them, so the two lists are compared in one place      */
/* instead of being kept in sync by hand.                                        */
/* -------------------------------------------------------------------------- */

/** Bounds enforced by `teacherProfileSchema` AND the database CHECKs. One
 *  definition, so a hint in the UI can never promise what the write refuses. */
export const TEACHER_PROFILE_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 70,
  SPECIALIZATION_MAX: 120,
  DISTRICT_MAX: 120,
  BIO_MAX: 1200,
  APPROACH_MAX: 1200,
  EXPERIENCE_MIN: 0,
  EXPERIENCE_MAX: 60,
  CATEGORIES_MAX: 3,
  LEVELS_MAX: 3,
  FORMATS_MAX: 2,
} as const;

/**
 * The persisted profile fields a teacher may edit, as form field names.
 *
 * These names are the contract between the browser and the server reader:
 * `buildTeacherProfileFormData()` writes exactly these keys and
 * `teacherProfileFormCandidate()` reads exactly these keys. A name added here
 * without a column behind it is rejected by the `.strict()` schema, not
 * silently stored.
 */
export const TEACHER_PROFILE_FIELDS = [
  "name",
  "specialization",
  "city",
  "district",
  "categories",
  "levels",
  "formats",
  "languages",
  "experienceYears",
  "bio",
  "approach",
  "onboardingCompleted",
] as const;

export type TeacherProfileFieldName = (typeof TEACHER_PROFILE_FIELDS)[number];

/** Multi-valued fields are appended to the FormData, the rest are set. */
export const TEACHER_PROFILE_LIST_FIELDS: readonly TeacherProfileFieldName[] = [
  "categories",
  "levels",
  "formats",
  "languages",
];

/** The editable view of one `teacher_profiles` row. No ids, no slug, no
 *  verification state, no photo: none of those is writable from this form. */
export interface TeacherProfileEditValues {
  name: string;
  /** Public "Yo‘nalish" label, e.g. “IELTS va umumiy ingliz tili”. */
  specialization: string;
  /** City slug from the canonical onboarding taxonomy, "" = not chosen. */
  city: string;
  district: string;
  categories: string[];
  levels: string[];
  formats: string[];
  languages: string[];
  /** Empty string = not stated. Stored as NULL. */
  experienceYears: string;
  bio: string;
  approach: string;
  onboardingCompleted: boolean;
}

export const EMPTY_TEACHER_PROFILE: TeacherProfileEditValues = {
  name: "",
  specialization: "",
  city: "",
  district: "",
  categories: [],
  levels: [],
  formats: [],
  languages: [],
  experienceYears: "",
  bio: "",
  approach: "",
  onboardingCompleted: false,
};

/** Minimal structural view of the persisted row (a `TeacherProfileRow` fits). */
export interface PersistedTeacherProfile {
  name: string;
  specialization: string | null;
  city: string | null;
  district: string | null;
  categories: string[];
  levels: string[];
  formats: string[];
  languages: string[];
  experienceYears: number | null;
  bio: string | null;
  approach: string | null;
  onboardingCompleted: boolean;
}

/** Persisted row → form values. `null` becomes `""` because that is what an
 *  empty controlled input holds; the FormData builder turns it back into the
 *  empty value the server maps to NULL. */
export function profileToEditValues(
  profile: PersistedTeacherProfile | null,
): TeacherProfileEditValues {
  if (profile === null) return { ...EMPTY_TEACHER_PROFILE };
  return {
    name: profile.name ?? "",
    specialization: profile.specialization ?? "",
    city: profile.city ?? "",
    district: profile.district ?? "",
    categories: [...profile.categories],
    levels: [...profile.levels],
    formats: [...profile.formats],
    languages: [...profile.languages],
    experienceYears:
      profile.experienceYears === null ? "" : String(profile.experienceYears),
    bio: profile.bio ?? "",
    approach: profile.approach ?? "",
    onboardingCompleted: profile.onboardingCompleted,
  };
}

/**
 * The ONE request body for a teacher profile save.
 *
 * Both the editor and the regression suite build their payload here, so the
 * suite exercises the real browser→server encoding rather than a hand-written
 * stand-in for it. Nothing but the whitelisted fields above is ever attached:
 * there is no `verification`, `slug`, `photo` or user id in this shape, and the
 * server's `.strict()` schema would reject one anyway.
 */
export function buildTeacherProfileFormData(
  values: TeacherProfileEditValues,
): FormData {
  const form = new FormData();
  form.set("name", values.name);
  form.set("specialization", values.specialization);
  form.set("city", values.city);
  form.set("district", values.district);
  form.set("experienceYears", values.experienceYears);
  form.set("bio", values.bio);
  form.set("approach", values.approach);
  form.set("onboardingCompleted", values.onboardingCompleted ? "1" : "");
  for (const category of values.categories) form.append("categories", category);
  for (const level of values.levels) form.append("levels", level);
  for (const format of values.formats) form.append("formats", format);
  for (const language of values.languages) form.append("languages", language);
  return form;
}
