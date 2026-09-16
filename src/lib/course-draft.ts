import type { CourseFormat, CourseLevel } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* Course authoring model — Phase 10. PURE module: no React, no DOM, no        */
/* dataset imports (same contract-first rule as enroll.ts / teacher-workspace).*/
/*                                                                              */
/* WHY A SEPARATE TYPE FROM `Course`                                            */
/* `Course` (data/models.ts) is the CANONICAL, complete, public marketplace     */
/* shape: every field is required and meaningful. An authoring draft is by      */
/* definition incomplete — title may be empty, category unpicked, price not     */
/* decided. Weakening `Course` to allow nulls would degrade every public        */
/* surface, so instead:                                                          */
/*                                                                              */
/*   CourseDraft (nullable authoring type)                                      */
/*     → courseDraftStepErrors (pure validation)                                */
/*     → CourseDraftReview (complete, validated review projection)              */
/*     → toCoursePayload (backend-ready payload a real POST would send)         */
/*                                                                              */
/* HONESTY RULES BAKED INTO THE TYPE                                            */
/*   • status is only "draft" | "ready" — there is no published/approved/live;  */
/*     a LOCAL draft never reaches the public catalog (real courses are server  */
/*     drafts created in “Kurslarim” and published through moderation).         */
/*   • groups carry `capacity` ONLY. seatsRemaining is live enrollment          */
/*     inventory derived from real requests, so a local draft cannot express    */
/*     it and the UI never invents one.                                         */
/*   • ids are local-only ids (`cd-…`, `cdg-…`, `cdm-…`) — never a fake server  */
/*     id, never a slug that could collide with /courses/[slug].                */
/*   • teacherId is the legacy browser WORKSPACE owner, not a session user.     */
/* -------------------------------------------------------------------------- */

/* --------------------------------- model ---------------------------------- */

/** Prototype lifecycle. Deliberately two honest states, nothing more. */
export type CourseDraftStatus = "draft" | "ready";

export const COURSE_DRAFT_STATUS_LABELS: Record<CourseDraftStatus, string> = {
  draft: "Qoralama",
  ready: "Ko‘rib chiqishga tayyor",
};

export const COURSE_DRAFT_STATUS_NOTES: Record<CourseDraftStatus, string> = {
  draft: "Faqat shu brauzerda saqlangan — hech qayerga yuborilmagan.",
  ready:
    "Barcha majburiy maydonlar to‘ldirilgan. Baribir faqat shu brauzerdagi qoralama — katalogda chiqmaydi.",
};

export type CoursePricingMode = "free" | "paid";

export interface CourseDraftGroup {
  /** Local prototype id (`cdg-…`). */
  id: string;
  title: string;
  /** Uzbek day abbreviations, same convention as CourseGroup.days. */
  days: string[];
  /** "HH:MM" or "" while unset. */
  startTime: string;
  /** Planned seats. NOT occupancy — a draft has no enrolled students. */
  capacity: number | null;
  /** ISO "YYYY-MM-DD" or "" while unset. */
  startDate: string;
}

export interface CourseDraftModule {
  /** Local prototype id (`cdm-…`). */
  id: string;
  title: string;
  description: string;
  lessons: number | null;
}

export interface CourseDraft {
  version: 1;
  /** Local prototype id (`cd-…`) — stable across refresh, never a server id. */
  id: string;
  /** Owning prototype workspace (canonical teacher id). */
  teacherId: string;
  status: CourseDraftStatus;
  /** ISO timestamps, local bookkeeping only. */
  createdAt: string;
  updatedAt: string;
  /** Set when the draft was copied from a canonical course (audit, read-only). */
  copiedFromCourseId: string | null;

  /* step 1 — asosiy ma’lumotlar */
  title: string;
  categoryId: string | null;
  level: CourseLevel | null;
  summary: string;
  teachingLanguages: string[];

  /* step 2 — format va joylashuv */
  format: CourseFormat | null;
  /** City slug; required for offline/hybrid, forced null for online. */
  city: string | null;
  /** Venue text; only for offline/hybrid. */
  location: string;

  /* step 3 — narx */
  pricing: CoursePricingMode;
  priceUzs: number | null;
  /** Only unit the canonical model supports. */
  pricePeriod: "month";

  /* step 4 — guruhlar */
  groups: CourseDraftGroup[];

  /* step 5 — dastur */
  syllabus: CourseDraftModule[];

  /* step 6 — kurs tafsilotlari */
  longDescription: string;
  audience: string[];
  learningOutcomes: string[];
}

/* --------------------------------- limits --------------------------------- */

export const COURSE_DRAFT_LIMITS = {
  TITLE_MIN: 8,
  TITLE_MAX: 90,
  SUMMARY_MIN: 40,
  SUMMARY_MAX: 220,
  LONG_MIN: 120,
  LONG_MAX: 2000,
  PRICE_MIN: 10_000,
  PRICE_MAX: 20_000_000,
  CAPACITY_MIN: 2,
  CAPACITY_MAX: 200,
  LESSONS_MIN: 1,
  LESSONS_MAX: 200,
  MODULE_TITLE_MIN: 4,
  MODULE_TITLE_MAX: 90,
  MODULE_DESC_MIN: 20,
  MODULE_DESC_MAX: 400,
  MAX_GROUPS: 6,
  MAX_MODULES: 12,
  MAX_LANGUAGES: 4,
  MAX_BULLETS: 8,
  BULLET_MIN: 6,
  BULLET_MAX: 140,
  MIN_MODULES: 2,
  MIN_OUTCOMES: 3,
  MIN_AUDIENCE: 2,
} as const;

/** Canonical Uzbek day abbreviations used by every group in the catalog. */
export const COURSE_DAY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Du", label: "Du" },
  { value: "Se", label: "Se" },
  { value: "Chor", label: "Chor" },
  { value: "Pay", label: "Pay" },
  { value: "Jum", label: "Jum" },
  { value: "Shan", label: "Shan" },
  { value: "Yak", label: "Yak" },
];

const DAY_VALUES = new Set(COURSE_DAY_OPTIONS.map((day) => day.value));

/* ----------------------------------- ids ----------------------------------- */

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Local prototype id. Random suffix + a time component keeps ids stable and
 * unique per browser; it is explicitly NOT a server identifier and nothing
 * outside this browser ever sees it.
 */
export function createLocalId(prefix: "cd" | "cdg" | "cdm"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}${rand}`;
}

export function isLocalDraftId(value: string): boolean {
  return /^cd-[a-z0-9]{4,32}$/.test(value);
}

/* -------------------------------- factories -------------------------------- */

export function emptyCourseDraftGroup(): CourseDraftGroup {
  return {
    id: createLocalId("cdg"),
    title: "",
    days: [],
    startTime: "",
    capacity: null,
    startDate: "",
  };
}

export function emptyCourseDraftModule(): CourseDraftModule {
  return {
    id: createLocalId("cdm"),
    title: "",
    description: "",
    lessons: null,
  };
}

export function emptyCourseDraft(teacherId: string, now: string): CourseDraft {
  return {
    version: 1,
    id: createLocalId("cd"),
    teacherId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    copiedFromCourseId: null,
    title: "",
    categoryId: null,
    level: null,
    summary: "",
    teachingLanguages: [],
    format: null,
    city: null,
    location: "",
    pricing: "paid",
    priceUzs: null,
    pricePeriod: "month",
    groups: [emptyCourseDraftGroup()],
    syllabus: [emptyCourseDraftModule(), emptyCourseDraftModule()],
    longDescription: "",
    audience: ["", ""],
    learningOutcomes: ["", "", ""],
  };
}

/* -------------------------------- parsing ---------------------------------- */

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function strList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLen));
}

function intOrNull(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function isoDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function isoStamp(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length >= 10 && value.length <= 40
    ? value
    : fallback;
}

function time(value: unknown): string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : "";
}

const LEVELS: CourseLevel[] = ["boshlangich", "orta", "yuqori"];
const FORMATS: CourseFormat[] = ["online", "offline", "hybrid"];

/**
 * Defensive parse of ONE draft. Returns null for anything structurally
 * unusable; everything else is clamped into range rather than trusted.
 */
export function parseCourseDraft(value: unknown): CourseDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const src = value as Record<string, unknown>;
  if (src.version !== 1) return null;

  const id = typeof src.id === "string" && isLocalDraftId(src.id) ? src.id : null;
  const teacherId =
    typeof src.teacherId === "string" && ID_RE.test(src.teacherId) ? src.teacherId : null;
  if (id === null || teacherId === null) return null;

  const created = isoStamp(src.createdAt, "");
  const format = FORMATS.find((item) => item === src.format) ?? null;
  const pricing: CoursePricingMode = src.pricing === "free" ? "free" : "paid";

  const groups = (Array.isArray(src.groups) ? src.groups : [])
    .slice(0, COURSE_DRAFT_LIMITS.MAX_GROUPS)
    .map((raw): CourseDraftGroup | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const g = raw as Record<string, unknown>;
      const gid =
        typeof g.id === "string" && /^cdg-[a-z0-9]{4,32}$/.test(g.id)
          ? g.id
          : createLocalId("cdg");
      return {
        id: gid,
        title: str(g.title, 60),
        days: strList(g.days, 7, 8).filter((day) => DAY_VALUES.has(day)),
        startTime: time(g.startTime),
        capacity: intOrNull(
          g.capacity,
          COURSE_DRAFT_LIMITS.CAPACITY_MIN,
          COURSE_DRAFT_LIMITS.CAPACITY_MAX,
        ),
        startDate: isoDate(g.startDate),
      };
    })
    .filter((group): group is CourseDraftGroup => group !== null);

  const syllabus = (Array.isArray(src.syllabus) ? src.syllabus : [])
    .slice(0, COURSE_DRAFT_LIMITS.MAX_MODULES)
    .map((raw): CourseDraftModule | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const m = raw as Record<string, unknown>;
      const mid =
        typeof m.id === "string" && /^cdm-[a-z0-9]{4,32}$/.test(m.id)
          ? m.id
          : createLocalId("cdm");
      return {
        id: mid,
        title: str(m.title, COURSE_DRAFT_LIMITS.MODULE_TITLE_MAX),
        description: str(m.description, COURSE_DRAFT_LIMITS.MODULE_DESC_MAX),
        lessons: intOrNull(
          m.lessons,
          COURSE_DRAFT_LIMITS.LESSONS_MIN,
          COURSE_DRAFT_LIMITS.LESSONS_MAX,
        ),
      };
    })
    .filter((module): module is CourseDraftModule => module !== null);

  return {
    version: 1,
    id,
    teacherId,
    status: src.status === "ready" ? "ready" : "draft",
    createdAt: created,
    updatedAt: isoStamp(src.updatedAt, created),
    copiedFromCourseId:
      typeof src.copiedFromCourseId === "string" && ID_RE.test(src.copiedFromCourseId)
        ? src.copiedFromCourseId
        : null,
    title: str(src.title, COURSE_DRAFT_LIMITS.TITLE_MAX),
    categoryId:
      typeof src.categoryId === "string" && ID_RE.test(src.categoryId)
        ? src.categoryId
        : null,
    level: LEVELS.find((item) => item === src.level) ?? null,
    summary: str(src.summary, COURSE_DRAFT_LIMITS.SUMMARY_MAX),
    teachingLanguages: strList(
      src.teachingLanguages,
      COURSE_DRAFT_LIMITS.MAX_LANGUAGES,
      8,
    ),
    format,
    // Online courses are structurally incapable of holding an address.
    city:
      format !== "online" && typeof src.city === "string" && ID_RE.test(src.city)
        ? src.city
        : null,
    location: format === "online" ? "" : str(src.location, 120),
    pricing,
    priceUzs:
      pricing === "free"
        ? null
        : intOrNull(src.priceUzs, 0, COURSE_DRAFT_LIMITS.PRICE_MAX),
    pricePeriod: "month",
    groups,
    syllabus,
    longDescription: str(src.longDescription, COURSE_DRAFT_LIMITS.LONG_MAX),
    audience: strList(
      src.audience,
      COURSE_DRAFT_LIMITS.MAX_BULLETS,
      COURSE_DRAFT_LIMITS.BULLET_MAX,
    ),
    learningOutcomes: strList(
      src.learningOutcomes,
      COURSE_DRAFT_LIMITS.MAX_BULLETS,
      COURSE_DRAFT_LIMITS.BULLET_MAX,
    ),
  };
}

export interface CourseDraftStore {
  version: 1;
  drafts: CourseDraft[];
}

export function emptyCourseDraftStore(): CourseDraftStore {
  return { version: 1, drafts: [] };
}

/** Defensive parse of the whole store; bad entries are dropped, not fatal. */
export function parseCourseDraftStore(value: unknown): CourseDraftStore | null {
  if (typeof value !== "object" || value === null) return null;
  const src = value as Record<string, unknown>;
  if (src.version !== 1) return null;
  if (!Array.isArray(src.drafts)) return { version: 1, drafts: [] };
  const drafts: CourseDraft[] = [];
  const seen = new Set<string>();
  for (const raw of src.drafts.slice(0, 50)) {
    const draft = parseCourseDraft(raw);
    if (draft === null || seen.has(draft.id)) continue;
    seen.add(draft.id);
    drafts.push(draft);
  }
  return { version: 1, drafts };
}

/** Ownership filter — the ONLY way a screen gets drafts to render. */
export function draftsForTeacher(
  store: CourseDraftStore,
  teacherId: string | null,
): CourseDraft[] {
  if (teacherId === null) return [];
  return store.drafts
    .filter((draft) => draft.teacherId === teacherId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Ownership-checked lookup: another teacher's draft resolves to null. */
export function findOwnedDraft(
  store: CourseDraftStore,
  teacherId: string | null,
  draftId: string,
): CourseDraft | null {
  if (teacherId === null) return null;
  return (
    store.drafts.find((draft) => draft.id === draftId && draft.teacherId === teacherId) ??
    null
  );
}

/* ---------------------------------- steps ---------------------------------- */

export type CourseStepId =
  | "basics"
  | "format"
  | "price"
  | "groups"
  | "syllabus"
  | "detail"
  | "review";

export interface CourseStepDef {
  id: CourseStepId;
  title: string;
  hint: string;
}

export const COURSE_STEPS: readonly CourseStepDef[] = [
  {
    id: "basics",
    title: "Asosiy ma’lumotlar",
    hint: "Nomi, yo‘nalishi, darajasi va qisqa tavsifi — katalog kartasi shundan tuziladi.",
  },
  {
    id: "format",
    title: "Format va joylashuv",
    hint: "Onlayn darsda manzil so‘ralmaydi; oflayn va aralash uchun shahar majburiy.",
  },
  {
    id: "price",
    title: "Narx",
    hint: "Bepul yoki oylik to‘lov. Bu mahalliy qoralama to‘lovga ulanmaydi.",
  },
  {
    id: "groups",
    title: "Guruhlar va jadval",
    hint: "Rejalashtirilgan guruhlar va sig‘im. Bu qoralama uchun band joylar hisoblanmaydi.",
  },
  {
    id: "syllabus",
    title: "Dastur",
    hint: "Kurs modullari — ommaviy sahifadagi dastur bloki shu tuzilmadan chiqadi.",
  },
  {
    id: "detail",
    title: "Kurs tafsilotlari",
    hint: "To‘liq tavsif, kim uchun va nimalarni o‘rganadi.",
  },
  {
    id: "review",
    title: "Ko‘rib chiqish",
    hint: "To‘liq ko‘rinish. Saqlash faqat shu brauzerda qoladi.",
  },
];

export const COURSE_REVIEW_INDEX = COURSE_STEPS.length - 1;

export function courseStepIndex(id: CourseStepId): number {
  const index = COURSE_STEPS.findIndex((step) => step.id === id);
  return index < 0 ? 0 : index;
}

/* -------------------------------- validation -------------------------------- */

export type CourseFieldErrors = Record<string, string>;

function lengthError(
  value: string,
  min: number,
  max: number,
  label: string,
): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return `${label} majburiy.`;
  if (trimmed.length < min) return `${label} kamida ${min} belgidan iborat bo‘lsin.`;
  if (trimmed.length > max) return `${label} ${max} belgidan oshmasin.`;
  return null;
}

function bulletErrors(
  values: string[],
  min: number,
  keyPrefix: string,
  label: string,
): CourseFieldErrors {
  const errors: CourseFieldErrors = {};
  const filled = values.map((v) => v.trim()).filter((v) => v !== "");
  if (filled.length < min) {
    errors[keyPrefix] = `Kamida ${min} ta ${label} kiriting.`;
  }
  values.forEach((value, index) => {
    const trimmed = value.trim();
    if (trimmed === "") return;
    if (trimmed.length < COURSE_DRAFT_LIMITS.BULLET_MIN) {
      errors[`${keyPrefix}.${index}`] =
        `Kamida ${COURSE_DRAFT_LIMITS.BULLET_MIN} belgi kiriting yoki qatorni bo‘sh qoldiring.`;
    }
  });
  return errors;
}

/**
 * Pure, deterministic validation for ONE step. Error keys are stable so both
 * the step form and the review screen can point at the same field.
 */
export function courseStepErrors(
  draft: CourseDraft,
  stepId: CourseStepId,
): CourseFieldErrors {
  const errors: CourseFieldErrors = {};
  const L = COURSE_DRAFT_LIMITS;

  if (stepId === "basics") {
    const title = lengthError(draft.title, L.TITLE_MIN, L.TITLE_MAX, "Kurs nomi");
    if (title) errors.title = title;
    if (draft.categoryId === null) errors.categoryId = "Yo‘nalishni tanlang.";
    if (draft.level === null) errors.level = "Kurs darajasini tanlang.";
    const summary = lengthError(draft.summary, L.SUMMARY_MIN, L.SUMMARY_MAX, "Qisqa tavsif");
    if (summary) errors.summary = summary;
    if (draft.teachingLanguages.length === 0) {
      errors.teachingLanguages = "Kamida bitta o‘qitish tilini tanlang.";
    }
  }

  if (stepId === "format") {
    if (draft.format === null) {
      errors.format = "Dars formatini tanlang.";
    } else if (draft.format !== "online") {
      if (draft.city === null) errors.city = "Oflayn dars uchun shaharni tanlang.";
      const loc = draft.location.trim();
      if (loc.length < 4) {
        errors.location = "Manzil yoki mo‘ljalni kamida 4 belgi bilan yozing.";
      }
    }
  }

  if (stepId === "price") {
    if (draft.pricing === "paid") {
      if (draft.priceUzs === null || draft.priceUzs <= 0) {
        errors.priceUzs = "Oylik narxni kiriting yoki kursni bepul deb belgilang.";
      } else if (draft.priceUzs < L.PRICE_MIN) {
        errors.priceUzs = `Narx kamida ${L.PRICE_MIN} so‘m bo‘lsin.`;
      } else if (draft.priceUzs > L.PRICE_MAX) {
        errors.priceUzs = "Narx juda katta — qiymatni tekshiring.";
      }
    }
  }

  if (stepId === "groups") {
    if (draft.groups.length === 0) {
      errors.groups = "Kamida bitta guruh qo‘shing.";
    }
    draft.groups.forEach((group) => {
      const key = `groups.${group.id}`;
      if (group.title.trim().length < 2) {
        errors[`${key}.title`] = "Guruh nomini yozing (masalan, “A guruhi”).";
      }
      if (group.days.length === 0) {
        errors[`${key}.days`] = "Kamida bitta dars kunini tanlang.";
      }
      if (group.startTime === "") {
        errors[`${key}.startTime`] = "Dars boshlanish vaqtini kiriting.";
      }
      if (group.startDate === "") {
        errors[`${key}.startDate`] = "Guruh boshlanish sanasini kiriting.";
      }
      if (group.capacity === null) {
        errors[`${key}.capacity`] =
          `Sig‘imni ${L.CAPACITY_MIN}–${L.CAPACITY_MAX} oralig‘ida kiriting.`;
      }
    });
  }

  if (stepId === "syllabus") {
    const filled = draft.syllabus.filter((module) => module.title.trim() !== "");
    if (filled.length < L.MIN_MODULES) {
      errors.syllabus = `Kamida ${L.MIN_MODULES} ta modul kiriting.`;
    }
    draft.syllabus.forEach((module) => {
      const key = `syllabus.${module.id}`;
      const title = lengthError(
        module.title,
        L.MODULE_TITLE_MIN,
        L.MODULE_TITLE_MAX,
        "Modul nomi",
      );
      if (title) errors[`${key}.title`] = title;
      const description = lengthError(
        module.description,
        L.MODULE_DESC_MIN,
        L.MODULE_DESC_MAX,
        "Modul tavsifi",
      );
      if (description) errors[`${key}.description`] = description;
      if (module.lessons === null) {
        errors[`${key}.lessons`] =
          `Darslar sonini ${L.LESSONS_MIN}–${L.LESSONS_MAX} oralig‘ida kiriting.`;
      }
    });
  }

  if (stepId === "detail") {
    const long = lengthError(
      draft.longDescription,
      L.LONG_MIN,
      L.LONG_MAX,
      "To‘liq tavsif",
    );
    if (long) errors.longDescription = long;
    Object.assign(
      errors,
      bulletErrors(draft.audience, L.MIN_AUDIENCE, "audience", "“kim uchun” qatori"),
      bulletErrors(
        draft.learningOutcomes,
        L.MIN_OUTCOMES,
        "learningOutcomes",
        "natija qatori",
      ),
    );
  }

  return errors;
}

/** Steps that must pass before the review step is reachable. */
export const COURSE_EDIT_STEPS: readonly CourseStepId[] = [
  "basics",
  "format",
  "price",
  "groups",
  "syllabus",
  "detail",
];

export function courseDraftIssues(draft: CourseDraft): CourseFieldErrors {
  return COURSE_EDIT_STEPS.reduce<CourseFieldErrors>(
    (all, step) => Object.assign(all, courseStepErrors(draft, step)),
    {},
  );
}

export function isCourseDraftComplete(draft: CourseDraft): boolean {
  return Object.keys(courseDraftIssues(draft)).length === 0;
}

/** Per-step completion, used by the stepper and the review edit links. */
export function courseStepStatus(
  draft: CourseDraft,
): { id: CourseStepId; title: string; errorCount: number }[] {
  return COURSE_EDIT_STEPS.map((id) => ({
    id,
    title: COURSE_STEPS[courseStepIndex(id)].title,
    errorCount: Object.keys(courseStepErrors(draft, id)).length,
  }));
}

/* ---------------------------- review projection ---------------------------- */

export interface CourseReviewGroup {
  id: string;
  title: string;
  scheduleLabel: string;
  startDate: string;
  capacity: number;
}

export interface CourseReviewSection {
  label: string;
  /** null renders as "To‘ldirilmagan" — never invented content. */
  value: string | null;
  /** Step to jump back to when editing this section. */
  step: CourseStepId;
}

export interface CourseDraftReview {
  id: string;
  status: CourseDraftStatus;
  teacherName: string;
  title: string | null;
  sections: CourseReviewSection[];
  groups: CourseReviewGroup[];
  syllabus: { id: string; title: string; description: string; lessons: number | null }[];
  audience: string[];
  learningOutcomes: string[];
  longDescription: string | null;
  complete: boolean;
}

export interface CourseReviewLabels {
  category: string | null;
  level: string | null;
  format: string | null;
  city: string | null;
  languages: string[];
  price: string;
}

export function groupScheduleText(group: CourseDraftGroup): string {
  const days = group.days.length > 0 ? group.days.join(", ") : "Kun tanlanmagan";
  const time = group.startTime === "" ? "vaqt kiritilmagan" : `soat ${group.startTime}`;
  return `${days} · ${time}`;
}

/**
 * Complete read model for the review/preview surfaces. Display labels are
 * resolved by the caller from CANONICAL taxonomies (categories/levels/…) and
 * passed in, so this module stays dataset-free.
 */
export function courseDraftReview(
  draft: CourseDraft,
  teacherName: string,
  labels: CourseReviewLabels,
): CourseDraftReview {
  const text = (value: string): string | null =>
    value.trim() === "" ? null : value.trim();

  const location =
    draft.format === "online"
      ? "Onlayn — jismoniy manzil yo‘q"
      : [labels.city, text(draft.location)].filter((part) => part).join(" · ") || null;

  return {
    id: draft.id,
    status: draft.status,
    teacherName,
    title: text(draft.title),
    sections: [
      { label: "Ustoz", value: teacherName, step: "basics" },
      { label: "Kurs nomi", value: text(draft.title), step: "basics" },
      { label: "Yo‘nalish", value: labels.category, step: "basics" },
      { label: "Daraja", value: labels.level, step: "basics" },
      { label: "Qisqa tavsif", value: text(draft.summary), step: "basics" },
      {
        label: "O‘qitish tillari",
        value: labels.languages.length > 0 ? labels.languages.join(", ") : null,
        step: "basics",
      },
      { label: "Format", value: labels.format, step: "format" },
      { label: "Joylashuv", value: location, step: "format" },
      { label: "Narx", value: labels.price, step: "price" },
    ],
    groups: draft.groups.map((group) => ({
      id: group.id,
      title: group.title.trim() === "" ? "Nomsiz guruh" : group.title.trim(),
      scheduleLabel: groupScheduleText(group),
      startDate: group.startDate,
      capacity: group.capacity ?? 0,
    })),
    syllabus: draft.syllabus.map((module) => ({
      id: module.id,
      title: module.title.trim(),
      description: module.description.trim(),
      lessons: module.lessons,
    })),
    audience: draft.audience.map((item) => item.trim()).filter((item) => item !== ""),
    learningOutcomes: draft.learningOutcomes
      .map((item) => item.trim())
      .filter((item) => item !== ""),
    longDescription: text(draft.longDescription),
    complete: isCourseDraftComplete(draft),
  };
}

/* --------------------------- backend-ready payload -------------------------- */

/**
 * The shape a real `POST /teacher/courses` would receive. It is intentionally
 * close to the canonical `Course`/`CourseDetail` models MINUS everything only a
 * server can own: id, slug, publishedAt, rating, reviews, students and
 * seatsRemaining. Producing it here documents the seam; Phase 10 only ever
 * renders it (as JSON) — nothing is sent anywhere.
 */
export interface CoursePayload {
  teacherId: string;
  title: string;
  categoryId: string;
  level: CourseLevel;
  format: CourseFormat;
  city: string | null;
  location: string | null;
  priceUzs: number;
  detail: {
    summary: string;
    longDescription: string;
    audience: string[];
    learningOutcomes: string[];
    teachingLanguages: string[];
    pricePeriod: "month";
    groups: {
      title: string;
      days: string[];
      startTime: string;
      format: CourseFormat;
      location: string | null;
      capacity: number;
      startDate: string;
    }[];
    syllabus: { title: string; description: string; lessons: number }[];
  };
}

/** null when the draft is incomplete — an invalid payload is never produced. */
export function toCoursePayload(draft: CourseDraft): CoursePayload | null {
  if (!isCourseDraftComplete(draft)) return null;
  if (draft.categoryId === null || draft.level === null || draft.format === null) {
    return null;
  }
  const location = draft.format === "online" ? null : draft.location.trim();
  return {
    teacherId: draft.teacherId,
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    level: draft.level,
    format: draft.format,
    city: draft.format === "online" ? null : draft.city,
    location,
    priceUzs: draft.pricing === "free" ? 0 : (draft.priceUzs ?? 0),
    detail: {
      summary: draft.summary.trim(),
      longDescription: draft.longDescription.trim(),
      audience: draft.audience.map((v) => v.trim()).filter((v) => v !== ""),
      learningOutcomes: draft.learningOutcomes
        .map((v) => v.trim())
        .filter((v) => v !== ""),
      teachingLanguages: draft.teachingLanguages,
      pricePeriod: "month",
      groups: draft.groups.map((group) => ({
        title: group.title.trim(),
        days: group.days,
        startTime: group.startTime,
        format: draft.format as CourseFormat,
        location,
        capacity: group.capacity ?? 0,
        startDate: group.startDate,
      })),
      syllabus: draft.syllabus
        .filter((module) => module.title.trim() !== "")
        .map((module) => ({
          title: module.title.trim(),
          description: module.description.trim(),
          lessons: module.lessons ?? 0,
        })),
    },
  };
}

/* ------------------------------ copy-to-draft ------------------------------ */

/**
 * Authoring-shaped snapshot of a CANONICAL course, built server-side.
 * It exists so "copy this course into a new draft" is an explicit, one-way
 * projection: the seed record itself is never handed to a mutable store and
 * never mutated. Server-owned fields (id/slug/rating/students/seatsRemaining)
 * are intentionally absent — a draft cannot claim them.
 */
export interface CourseAuthoringSeed {
  title: string;
  categoryId: string | null;
  level: CourseLevel | null;
  summary: string;
  teachingLanguages: string[];
  format: CourseFormat;
  city: string | null;
  location: string;
  priceUzs: number;
  groups: {
    title: string;
    days: string[];
    startTime: string;
    capacity: number;
    startDate: string;
  }[];
  syllabus: { title: string; description: string; lessons: number }[];
  longDescription: string;
  audience: string[];
  learningOutcomes: string[];
}

/** Pure: canonical seed + owner → a brand-new local draft. */
export function draftFromSeed(
  seed: CourseAuthoringSeed,
  teacherId: string,
  courseId: string,
  now: string,
): CourseDraft {
  const base = emptyCourseDraft(teacherId, now);
  return {
    ...base,
    copiedFromCourseId: courseId,
    title: seed.title.slice(0, COURSE_DRAFT_LIMITS.TITLE_MAX),
    categoryId: seed.categoryId,
    level: seed.level,
    summary: seed.summary.slice(0, COURSE_DRAFT_LIMITS.SUMMARY_MAX),
    teachingLanguages: seed.teachingLanguages.slice(0, COURSE_DRAFT_LIMITS.MAX_LANGUAGES),
    format: seed.format,
    city: seed.format === "online" ? null : seed.city,
    location: seed.format === "online" ? "" : seed.location,
    pricing: seed.priceUzs > 0 ? "paid" : "free",
    priceUzs: seed.priceUzs > 0 ? seed.priceUzs : null,
    groups: seed.groups.slice(0, COURSE_DRAFT_LIMITS.MAX_GROUPS).map((group) => ({
      ...emptyCourseDraftGroup(),
      title: group.title,
      days: group.days,
      startTime: group.startTime,
      capacity: group.capacity,
      startDate: group.startDate,
    })),
    syllabus: seed.syllabus.slice(0, COURSE_DRAFT_LIMITS.MAX_MODULES).map((module) => ({
      ...emptyCourseDraftModule(),
      title: module.title,
      description: module.description.slice(0, COURSE_DRAFT_LIMITS.MODULE_DESC_MAX),
      lessons: module.lessons,
    })),
    longDescription: seed.longDescription.slice(0, COURSE_DRAFT_LIMITS.LONG_MAX),
    audience: seed.audience.slice(0, COURSE_DRAFT_LIMITS.MAX_BULLETS),
    learningOutcomes: seed.learningOutcomes.slice(0, COURSE_DRAFT_LIMITS.MAX_BULLETS),
  };
}

/* ------------------------------ list helpers ------------------------------- */

export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
