import { categories } from "@/data/categories";
import { courseCities, cityLabel } from "@/data/courses";
import { teacherCities, teacherLanguages } from "@/data/teacher-rows";
import type { CourseLevel } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* Auth + onboarding model — Phase 6. PURE module (no React, no DOM, no        */
/* navigation): the same contract-first pattern as lib/course-search.ts.        */
/*   • Uzbek phone normalize/format/validate                                   */
/*   • OnboardingDraft: versioned, defensively parsed prototype state          */
/*   • Per-step validators shared by the wizard and the register form          */
/*   • Canonical completion hrefs built on the EXISTING browse URL contracts    */
/* Nothing here claims an account exists — persistence is the UI prototype's    */
/* localStorage draft only (see components/onboarding/draft-store.tsx).         */
/* -------------------------------------------------------------------------- */

export type UserRole = "student" | "teacher";

/* ---------------------------------- phone ---------------------------------- */

/** Valid Uzbek mobile operator codes (all mobile numbers are 9 digits after
 *  the +998 country code; landlines are out of scope for this product). */
export const UZ_MOBILE_PREFIXES: readonly string[] = [
  "88",
  "90",
  "91",
  "93",
  "94",
  "95",
  "97",
  "98",
  "99",
];

/**
 * Pull the 9 subscriber digits out of anything the user typed:
 * "+998 (90) 123-45-67", "998901234567", "90 123 45 67" → "901234567".
 * Returns the digits left of the 9-digit cap; validation decides validity.
 */
export function extractUzPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("998")) {
    const rest = digits.slice(3);
    // "998" is only treated as the country code when something follows it
    // (so a number typed as 998 90… and a bare "998…" prefix collide safely).
    if (rest.length > 0) {
      digits = rest;
    } else {
      digits = "";
    }
  } else if (digits.startsWith("9") === false && digits.startsWith("8") === false) {
    // Any other leading junk (e.g. a stray "1") is dropped digit by digit
    // until a plausible operator code starts the input.
    const match = digits.match(/^[3-9]{1}\d{0,8}$/);
    if (!match) {
      const idx = digits.search(/[3-9]/);
      digits = idx === -1 ? "" : digits.slice(idx);
    }
  }
  return digits.slice(0, 9);
}

/** "901234567" → "+998 90 123 45 67" (partial input formats progressively). */
export function formatUzPhone(digits: string): string {
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter((group) => group !== "");
  return groups.length === 0 ? "+998" : `+998 ${groups.join(" ")}`;
}

/** Canonical storage/display form: spaced "+998 90 123 45 67". */
export function uzPhoneFromDigits(digits: string): string {
  return formatUzPhone(digits);
}

export function isValidUzPhoneDigits(digits: string): boolean {
  return /^\d{9}$/.test(digits) && UZ_MOBILE_PREFIXES.includes(digits.slice(0, 2));
}

/** Validate whatever string a field holds (formatted or raw). */
export function validateUzPhone(raw: string): { ok: boolean; digits: string } {
  const digits = extractUzPhoneDigits(raw);
  return { ok: isValidUzPhoneDigits(digits), digits };
}

/* --------------------------------- fields ---------------------------------- */

export function validateName(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return "Ismingizni kiriting.";
  if (value.length < 2) return "Ism kamida 2 ta harfdan iborat bo‘lsin.";
  if (value.length > 70) return "Ism 70 ta belgidan oshmasin.";
  return null;
}

export function validatePasswordField(raw: string): string | null {
  if (raw === "") return "Parolni kiriting.";
  if (raw.length < 8) return "Parol kamida 8 ta belgidan iborat bo‘lsin.";
  if (raw.length > 72) return "Parol 72 ta belgidan oshmasin.";
  return null;
}

export function validatePhoneField(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "Telefon raqamini kiriting.";
  const digits = extractUzPhoneDigits(trimmed);
  if (digits.length < 9) return "Raqam to‘liq emas — +998 XX XXX XX XX ko‘rinishida kiriting.";
  if (!UZ_MOBILE_PREFIXES.includes(digits.slice(0, 2)))
    return "Bu operator kodi qo‘llab-quvvatlanmaydi. Mobil raqam kiriting.";
  return null;
}

/* ------------------------- shared option taxonomies ------------------------ */
/* Cities / languages / categories / levels are DERIVED from the existing      */
/* catalog data — Phase 6 must not invent a second taxonomy.                   */

/** Union of the course catalog cities and the derived teacher cities. */
export const onboardingCities: string[] = Array.from(
  new Set([...courseCities, ...teacherCities]),
).sort();

export function onboardingCityLabel(slug: string): string {
  return cityLabel(slug);
}

/** Language tags teachers actually use (derived) — same tags for students. */
export const onboardingLanguages: string[] = teacherLanguages;

/** Presentation labels for the ISO tags (display only; data keeps the tags). */
export const LANGUAGE_LABELS: Record<string, string> = {
  UZ: "O‘zbekcha",
  EN: "Ingliz tili",
  RU: "Rus tili",
  AR: "Arab tili",
};

export function languageLabel(tag: string): string {
  return LANGUAGE_LABELS[tag] ?? tag;
}

/** Real category taxonomy (same source as /courses and /teachers facets). */
export const onboardingCategories = categories.map((category) => ({
  slug: category.slug,
  name: category.name,
}));

const CATEGORY_SLUG_SET = new Set(onboardingCategories.map((c) => c.slug));

const COURSE_LEVELS: readonly CourseLevel[] = ["boshlangich", "orta", "yuqori"];

const LANG_SET = new Set(onboardingLanguages);
const CITY_SET = new Set(onboardingCities);

/* --------------------------------- draft ------------------------------------ */

export type StudentFormatChoice = "online" | "offline" | "both";
export type TeacherFormatChoice = "online" | "offline";

export interface StudentAnswers {
  name: string;
  /** Canonical "+998 XX XXX XX XX" or "" — never a raw paste. */
  phone: string;
  /** City slug from onboardingCities or null (online-only learners). */
  city: string | null;
  format: StudentFormatChoice | null;
  languages: string[];
  /** Category slugs the learner wants to follow. */
  interests: string[];
}

export interface TeacherAnswers {
  name: string;
  phone: string;
  city: string | null;
  /** Free-text district/venue hint — shown only inside the profile preview. */
  district: string;
  /** Category slugs, 1–3 (focus constraint the profile card can display). */
  categories: string[];
  levels: CourseLevel[];
  experienceYears: number | null;
  formats: TeacherFormatChoice[];
  languages: string[];
  bio: string;
  approach: string;
  /** Honesty declaration gate on the verification step (frontend flag). */
  declaration: boolean;
}

export interface OnboardingDraft {
  version: 1;
  role: UserRole | null;
  /** Furthest step index reached within the role's flow (clamped on read). */
  furthest: number;
  /** The flow's completion screen was shown (UI state — NOT an account). */
  completed: boolean;
  /** Student flow was skipped (teacher flow has no skip). */
  skipped: boolean;
  student: StudentAnswers;
  teacher: TeacherAnswers;
}

export const emptyStudentAnswers: StudentAnswers = {
  name: "",
  phone: "",
  city: null,
  format: null,
  languages: [],
  interests: [],
};

export const emptyTeacherAnswers: TeacherAnswers = {
  name: "",
  phone: "",
  city: null,
  district: "",
  categories: [],
  levels: [],
  experienceYears: null,
  formats: [],
  languages: [],
  bio: "",
  approach: "",
  declaration: false,
};

export function emptyDraft(): OnboardingDraft {
  return {
    version: 1,
    role: null,
    furthest: 0,
    completed: false,
    skipped: false,
    student: { ...emptyStudentAnswers },
    teacher: { ...emptyTeacherAnswers },
  };
}

/* --------------------------------- codec ------------------------------------ */

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function asStringOrNullIn(value: unknown, allowed: Set<string>): string | null {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function asStringArrayIn(value: unknown, allowed: Set<string>, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item) && !out.includes(item)) {
      out.push(item);
      if (out.length >= max) break;
    }
  }
  return out;
}

function asNumberOrNull(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value))
    return null;
  if (value < min || value > max) return null;
  return value;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

/**
 * Phone sanitizer for persisted drafts. A stored value is kept only when it
 * is a FIXED POINT of the field's formatter — i.e. exactly the canonical or
 * mid-typing progressive form the PhoneField itself produces ("+998",
 * "+998 9", "+998 90 123 45 67"). Anything else (hand-edited junk, secrets
 * smuggled into storage) collapses to "". Operator validity stays the job
 * of validatePhoneField at step-validation time, so a half-typed number is
 * never destroyed by the write-through sanitize.
 */
export function canonicalPhoneOrEmpty(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const rebuilt = uzPhoneFromDigits(extractUzPhoneDigits(raw));
  return rebuilt === raw ? raw : "";
}

function parseStudent(value: unknown): StudentAnswers {
  const source = (value ?? {}) as Record<string, unknown>;
  const formats = new Set<string>(["online", "offline", "both"]);
  const format = asStringOrNullIn(source.format, formats);
  return {
    name: asString(source.name, 70),
    phone: canonicalPhoneOrEmpty(source.phone),
    city: asStringOrNullIn(source.city, CITY_SET),
    format: format as StudentFormatChoice | null,
    languages: asStringArrayIn(source.languages, LANG_SET, onboardingLanguages.length),
    interests: asStringArrayIn(source.interests, CATEGORY_SLUG_SET, onboardingCategories.length),
  };
}

function parseTeacher(value: unknown): TeacherAnswers {
  const source = (value ?? {}) as Record<string, unknown>;
  return {
    name: asString(source.name, 70),
    phone: canonicalPhoneOrEmpty(source.phone),
    city: asStringOrNullIn(source.city, CITY_SET),
    district: asString(source.district, 80),
    categories: asStringArrayIn(source.categories, CATEGORY_SLUG_SET, 3),
    levels: asStringArrayIn(source.levels, new Set<string>(COURSE_LEVELS), 3) as CourseLevel[],
    experienceYears: asNumberOrNull(source.experienceYears, 0, 45),
    formats: asStringArrayIn(source.formats, new Set<string>(["online", "offline"]), 2) as
      TeacherFormatChoice[],
    languages: asStringArrayIn(source.languages, LANG_SET, onboardingLanguages.length),
    bio: asString(source.bio, 600),
    approach: asString(source.approach, 600),
    declaration: asBoolean(source.declaration),
  };
}

/**
 * Defensive parse of anything read back from storage. Returns null for a
 * missing/corrupt/foreign draft (the caller falls back to emptyDraft()).
 * Unknown keys are dropped; unknown enum values become null — this is the
 * single sanitizer guarding the whole prototype state.
 */
export function parseDraft(value: unknown): OnboardingDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return null;
  return {
    version: 1,
    role: source.role === "student" || source.role === "teacher" ? source.role : null,
    furthest: asNumberOrNull(source.furthest, 0, 99) ?? 0,
    completed: asBoolean(source.completed),
    skipped: asBoolean(source.skipped),
    student: parseStudent(source.student),
    teacher: parseTeacher(source.teacher),
  };
}

/* ------------------------------- step model -------------------------------- */

export interface StepDef {
  id: string;
  /** Short label — the progress rail + screen title. */
  title: string;
  /** One-line helper shown under the step title. */
  hint: string;
}

export const STUDENT_STEPS: readonly StepDef[] = [
  { id: "identity", title: "Kimmingiz", hint: "Ism va telefon — profil uchun minimal ma’lumot." },
  { id: "place", title: "Qayerda o‘qiysiz?", hint: "Shahar va format — kurslarni shu bo‘yicha saralaymiz." },
  { id: "interests", title: "Qiziqishlar va til", hint: "Yo‘nalish va o‘qish tilini tanlang." },
  { id: "done", title: "Yakun", hint: "Tanlovlaringiz — onboarding UI holati." },
];

export const TEACHER_STEPS: readonly StepDef[] = [
  { id: "identity", title: "Asosiy ma’lumotlar", hint: "Profil sarlavhasi va aloqa raqami." },
  { id: "expertise", title: "Ekspertiza va tajriba", hint: "Yo‘nalishlar, darajalar va tajriba yili." },
  { id: "format", title: "Format va tillar", hint: "Qayerda va qaysi tillarda dars berasiz." },
  { id: "bio", title: "Bio va yondashuv", hint: "O‘quvchilar shu matnlarni o‘qiydi." },
  { id: "verify", title: "Profilni tekshirish", hint: "Tekshiruv infratuzilmasi keyinroq ulanadi." },
  { id: "done", title: "Yakun", hint: "Profil ko‘rinishi — onboarding UI holati." },
];

export function stepsFor(role: UserRole | null): readonly StepDef[] {
  return role === "teacher" ? TEACHER_STEPS : STUDENT_STEPS;
}

export const STUDENT_DONE_INDEX = STUDENT_STEPS.length - 1;
export const TEACHER_DONE_INDEX = TEACHER_STEPS.length - 1;

export function doneIndexFor(role: UserRole | null): number {
  return role === "teacher" ? TEACHER_DONE_INDEX : STUDENT_DONE_INDEX;
}

/* ------------------------------- validators -------------------------------- */

export type FieldErrors = Record<string, string>;

const BIO_MIN = 80;
const BIO_MAX = 500;
const APPROACH_MIN = 40;
const APPROACH_MAX = 500;

export function validateTextFieldLength(
  value: string,
  fieldLabel: string,
  min: number,
  max: number,
): string | null {
  const length = value.trim().length;
  if (length === 0) return `${fieldLabel} kiriting.`;
  if (length < min) return `${fieldLabel} kamida ${min} ta belgidan iborat bo‘lsin (hozir ${length}).`;
  if (length > max) return `${fieldLabel} ${max} ta belgidan oshmasin.`;
  return null;
}

export function studentStepErrors(answers: StudentAnswers, stepId: string): FieldErrors {
  const errors: FieldErrors = {};
  if (stepId === "identity") {
    const name = validateName(answers.name);
    if (name) errors.name = name;
    const phone = validatePhoneField(answers.phone);
    if (phone) errors.phone = phone;
  } else if (stepId === "place") {
    if (answers.format === null)
      errors.format = "O‘qish formatini tanlang — onlayn, oflayn yoki ikkalasi.";
  } else if (stepId === "interests") {
    if (answers.interests.length === 0)
      errors.interests = "Kamida bitta yo‘nalish tanlang yoki qadamni o‘tkazing.";
    if (answers.languages.length === 0)
      errors.languages = "Kamida bitta o‘qish tilini tanlang.";
  }
  return errors;
}

export function teacherStepErrors(answers: TeacherAnswers, stepId: string): FieldErrors {
  const errors: FieldErrors = {};
  if (stepId === "identity") {
    const name = validateName(answers.name);
    if (name) errors.name = name;
    const phone = validatePhoneField(answers.phone);
    if (phone) errors.phone = phone;
    if (answers.city === null) errors.city = "Qaysi shahardasiz?";
  } else if (stepId === "expertise") {
    if (answers.categories.length === 0)
      errors.categories = "Kamida bitta yo‘nalish tanlang.";
    else if (answers.categories.length > 3)
      errors.categories = "Eng ko‘pi bilan 3 ta yo‘nalish tanlang.";
    if (answers.levels.length === 0)
      errors.levels = "O‘quvchi darajasini kamida bittani tanlang.";
    if (answers.experienceYears === null)
      errors.experienceYears = "Tajribangizni to‘liq yilida kiriting (0–45).";
    else if (answers.experienceYears > 45)
      errors.experienceYears = "Tajriba 45 yildan oshmasin.";
  } else if (stepId === "format") {
    if (answers.formats.length === 0)
      errors.formats = "Kamida bitta dars formatini tanlang.";
    if (answers.languages.length === 0)
      errors.languages = "Kamida bitta o‘qish tilini tanlang.";
  } else if (stepId === "bio") {
    const bio = validateTextFieldLength(answers.bio, "Bio", BIO_MIN, BIO_MAX);
    if (bio) errors.bio = bio;
    const approach = validateTextFieldLength(answers.approach, "Yondashuv", APPROACH_MIN, APPROACH_MAX);
    if (approach) errors.approach = approach;
  } else if (stepId === "verify") {
    if (!answers.declaration)
      errors.declaration = "Davom etish uchun ma’lumotlaringizni tasdiqlang.";
  }
  return errors;
}

export function stepErrorsFor(role: UserRole, stepId: string, draft: OnboardingDraft): FieldErrors {
  return role === "teacher"
    ? teacherStepErrors(draft.teacher, stepId)
    : studentStepErrors(draft.student, stepId);
}

/** Teacher profile-field limits — exported so the UI hints stay in sync. */
export const TEACHER_TEXT_LIMITS = { BIO_MIN, BIO_MAX, APPROACH_MIN, APPROACH_MAX } as const;

/* --------------------------- completion hrefs ------------------------------- */
/* Built on the EXISTING browse URL contracts (lib/course-search.ts,             */
/* lib/teacher-search.ts): defaults omitted, single-select facets only.          */

/** /courses href from student answers — city + format only (no category        */
/** param exists on /courses; interests drive /categories/[slug] instead).       */
export function studentCoursesHref(answers: StudentAnswers): string {
  const params = new URLSearchParams();
  if (answers.city && CITY_SET.has(answers.city)) params.set("city", answers.city);
  if (answers.format === "online") params.set("format", "online");
  else if (answers.format === "offline") params.set("format", "offline");
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

/** First interest → its real category route (deterministic: selection order). */
export function studentCategoryHref(answers: StudentAnswers): string | null {
  const first = answers.interests[0];
  if (!first || !CATEGORY_SLUG_SET.has(first)) return null;
  return `/categories/${first}`;
}

/** /teachers href from student answers — city + format + language (only when
 *  exactly one language is selected; the facet is single-select by contract). */
export function studentTeachersHref(answers: StudentAnswers): string {
  const params = new URLSearchParams();
  if (answers.city && CITY_SET.has(answers.city)) params.set("city", answers.city);
  if (answers.format === "online") params.set("format", "online");
  else if (answers.format === "offline") params.set("format", "offline");
  if (answers.languages.length === 1) params.set("lang", answers.languages[0]);
  const query = params.toString();
  return query ? `/teachers?${query}` : "/teachers";
}

/** Validate + normalize a ?role= search param (whitelist, defensive). */
export function parseRoleParam(
  value: string | string[] | undefined,
): UserRole | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "student" || raw === "teacher" ? raw : null;
}

/** Validate a ?phone= handoff param (login → register convenience). */
export function parsePhoneParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const { ok, digits } = validateUzPhone(raw);
  return ok ? uzPhoneFromDigits(digits) : null;
}

/* ------------------------------ summary helpers ----------------------------- */

export function studentSummaryRows(answers: StudentAnswers): { label: string; value: string | null }[] {
  const format =
    answers.format === "online"
      ? "Online"
      : answers.format === "offline"
        ? "Offline"
        : answers.format === "both"
          ? "Online va offline"
          : null;
  return [
    { label: "Ism", value: answers.name.trim() === "" ? null : answers.name.trim() },
    { label: "Telefon", value: answers.phone === "" ? null : answers.phone },
    { label: "Shahar", value: answers.city ? onboardingCityLabel(answers.city) : null },
    { label: "Format", value: format },
    {
      label: "Tillar",
      value:
        answers.languages.length === 0
          ? null
          : answers.languages.map((tag) => languageLabel(tag)).join(", "),
    },
    {
      label: "Yo‘nalishlar",
      value:
        answers.interests.length === 0
          ? null
          : answers.interests
              .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name ?? slug)
              .join(", "),
    },
  ];
}

export function teacherSummaryRows(answers: TeacherAnswers): { label: string; value: string | null }[] {
  return [
    { label: "Ism", value: answers.name.trim() === "" ? null : answers.name.trim() },
    { label: "Telefon", value: answers.phone === "" ? null : answers.phone },
    {
      label: "Joylashuv",
      value: answers.city
        ? [onboardingCityLabel(answers.city), answers.district.trim()].filter(Boolean).join(" · ")
        : null,
    },
    {
      label: "Yo‘nalishlar",
      value:
        answers.categories.length === 0
          ? null
          : answers.categories
              .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name ?? slug)
              .join(", "),
    },
    {
      label: "Tajriba",
      value:
        answers.experienceYears === null
          ? null
          : `${answers.experienceYears} yil`,
    },
    {
      label: "Format",
      value:
        answers.formats.length === 0
          ? null
          : answers.formats.length === 2
            ? "Online va offline"
            : answers.formats[0] === "online"
              ? "Online"
              : "Offline",
    },
    {
      label: "Tillar",
      value:
        answers.languages.length === 0
          ? null
          : answers.languages.map((tag) => languageLabel(tag)).join(", "),
    },
  ];
}
