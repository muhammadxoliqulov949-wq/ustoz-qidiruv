import type { CourseFormat } from "@/data/models";
import { canonicalPhoneOrEmpty, validateName, validatePhoneField } from "./onboarding";
import { withNext } from "./safe-next";

/* -------------------------------------------------------------------------- */
/* Enrollment flow engine — Phase 7. The same pure-contract pattern as           */
/* course-search / teacher-search / onboarding:                                  */
/*   • EnrollCourseLite/EnrollGroupLite — the serializable projection the          */
/*     /enroll/[courseSlug] page builds from the catalog (no dataset import in     */
/*     client islands, labels resolved server-side, one source of truth).          */
/*   • resolveEnrollGroup — URL ⇄ draft group resolution; invalid/never silent.    */
/*   • EnrollDraft + parseEnrollDraft — versioned, defensively sanitized,          */
/*     and structurally incapable of holding passwords/tokens/ids.                 */
/*   • enrollStepErrors / enrollmentSummary / href builders — step gating and     */
/*     the review projection, so presentation components stay dumb.               */
/* Nothing here claims a server enrollment exists — the "submitted" flag is a     */
/* UI-state marker for the prototype completion screen only.                     */
/* -------------------------------------------------------------------------- */

export interface EnrollGroupLite {
  id: string;
  title: string;
  /** Pre-formatted Uzbek day abbreviations, same convention as CourseGroup. */
  days: string[];
  /** "HH:MM". */
  startTime: string;
  format: CourseFormat;
  formatLabel: string;
  location: string | null;
  capacity: number;
  seatsRemaining: number;
  /** ISO date + human label (both from the data layer; no client Intl). */
  startDate: string;
  startDateLabel: string;
}

export interface EnrollCourseLite {
  slug: string;
  title: string;
  image: string | null;
  /** Category display name or null. */
  category: string | null;
  teacherName: string;
  teacherSlug: string | null;
  teacherVerified: boolean;
  /** e.g. "320 000 so‘m / oyiga" or "Bepul" — server-formatted once. */
  priceSummary: string;
  priceUzs: number;
  /** "oyiga" | "kurs uchun bir marta" (unit word for split layouts). */
  priceUnitLabel: string;
  groups: EnrollGroupLite[];
}

export function isFull(group: EnrollGroupLite): boolean {
  return group.seatsRemaining <= 0;
}

export function groupWhereLabel(group: EnrollGroupLite): string {
  if (group.format === "online") return "Onlayn";
  if (group.format === "hybrid") {
    return group.location ? `Sinf: ${group.location} · onlayn ham` : "Sinf + onlayn";
  }
  return group.location ?? "Sinf darslari";
}

export function groupScheduleLabel(group: EnrollGroupLite): string {
  return `${group.days.join(", ")} · soat ${group.startTime}`;
}

/* ------------------------------- steps model ------------------------------- */

export interface EnrollStepDef {
  id: "group" | "student" | "schedule" | "review" | "done";
  title: string;
  hint: string;
}

export const ENROLL_STEPS: readonly EnrollStepDef[] = [
  {
    id: "group",
    title: "Kurs va guruh",
    hint: "Guruhni tanlang — bo‘sh joylar soni yuborilgan so‘rovlar asosida hisoblanadi.",
  },
  {
    id: "student",
    title: "O‘quvchi ma‘lumotlari",
    hint: "Faqat shu so‘rov uchun kerak bo‘ladigan minimal ma‘lumot.",
  },
  {
    id: "schedule",
    title: "Format va jadval",
    hint: "Tanlovlaringizni tasdiqlang — bu qadamda hech narsa o‘zgarmaydi.",
  },
  {
    id: "review",
    title: "Tekshirish",
    hint: "Yakuniy ko‘rinish — yuborishdan oldin hammasini ochiq ko‘rasiz.",
  },
  {
    id: "done",
    title: "So‘rov holati",
    hint: "Frontend prototipi — server yozuvi mavjud emas.",
  },
];

export const ENROLL_TOTAL_STEPS = ENROLL_STEPS.length;
export const ENROLL_DONE_INDEX = ENROLL_TOTAL_STEPS - 1;

/* --------------------------------- draft ------------------------------------ */

export interface EnrollDraft {
  version: 1;
  /** The draft is bound to one course; a different slug discards it wholesale. */
  courseSlug: string;
  groupId: string | null;
  name: string;
  phone: string;
  note: string;
  furthest: number;
  /** Completion screen shown — UI state only, never a server receipt. */
  submitted: boolean;
  /** Student fields were seeded from the onboarding prototype draft. */
  prefillApplied: boolean;
}

const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const GROUP_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const NOTE_MAX = 400;

export function emptyEnrollDraft(courseSlug: string): EnrollDraft {
  return {
    version: 1,
    courseSlug,
    groupId: null,
    name: "",
    phone: "",
    note: "",
    furthest: 0,
    submitted: false,
    prefillApplied: false,
  };
}

function asBoundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function clampInt(value: unknown, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(Math.trunc(value), max))
    : min;
}

/**
 * Defensive parse of any stored value. Unknown/foreign shapes return null so
 * the caller starts a fresh draft; a draft bound to another course is also
 * rejected (the caller passes nothing — the store checks courseSlug itself).
 */
export function parseEnrollDraft(value: unknown): EnrollDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return null;
  const courseSlug = source.courseSlug;
  if (typeof courseSlug !== "string" || !SLUG_RE.test(courseSlug)) return null;
  const groupId = source.groupId;
  return {
    version: 1,
    courseSlug,
    groupId: typeof groupId === "string" && GROUP_ID_RE.test(groupId) ? groupId : null,
    name: asBoundedString(source.name, 70),
    phone: canonicalPhoneOrEmpty(source.phone),
    note: asBoundedString(source.note, NOTE_MAX),
    furthest: clampInt(source.furthest, 0, ENROLL_DONE_INDEX),
    submitted: source.submitted === true,
    prefillApplied: source.prefillApplied === true,
  };
}

export const ENROLL_NOTE_MAX = NOTE_MAX;

/* ------------------------------- resolution -------------------------------- */

export interface GroupResolution {
  /** Group to show as selected (null = selection state, nothing chosen). */
  selectedGroupId: string | null;
  /** ?group= named a group that does not exist on this course. */
  requestedUnknown: boolean;
  /** ?group= named a real but full group (shown with the full notice). */
  requestedFull: boolean;
}

/**
 * URL is the source of truth for the group (shareable, back/forward-safe);
 * the draft only supplies the last valid pick when the URL carries none.
 * Invalid URL input is NEVER silently swapped for other data — it downgrades
 * to the honest selection state with a notice the UI must show.
 */
export function resolveEnrollGroup(
  groups: readonly EnrollGroupLite[],
  urlGroupId: string | null,
  draftGroupId: string | null,
): GroupResolution {
  if (urlGroupId !== null) {
    const found = groups.find((group) => group.id === urlGroupId);
    if (!found) return { selectedGroupId: null, requestedUnknown: true, requestedFull: false };
    if (isFull(found))
      return { selectedGroupId: null, requestedUnknown: false, requestedFull: true };
    return { selectedGroupId: found.id, requestedUnknown: false, requestedFull: false };
  }
  if (draftGroupId !== null) {
    const found = groups.find((group) => group.id === draftGroupId);
    if (found && !isFull(found))
      return { selectedGroupId: found.id, requestedUnknown: false, requestedFull: false };
  }
  return { selectedGroupId: null, requestedUnknown: false, requestedFull: false };
}

/* ------------------------------- validation -------------------------------- */

export type EnrollFieldErrors = Record<string, string>;

export function enrollStepErrors(
  stepId: EnrollStepDef["id"],
  draft: EnrollDraft,
  selectedGroupId: string | null,
): EnrollFieldErrors {
  const errors: EnrollFieldErrors = {};
  if (stepId === "group") {
    if (selectedGroupId === null)
      errors.group = "Davom etish uchun bo‘sh guruhni tanlang.";
  } else if (stepId === "student") {
    const name = validateName(draft.name);
    if (name) errors.name = name;
    const phone = validatePhoneField(draft.phone);
    if (phone) errors.phone = phone;
    if (draft.note.trim().length > NOTE_MAX)
      errors.note = `Izoh ${NOTE_MAX} ta belgidan oshmasin.`;
  }
  return errors;
}

export function validateEnrollNote(raw: string): string | null {
  if (raw.length > NOTE_MAX) return `Izoh ${NOTE_MAX} ta belgidan oshmasin.`;
  return null;
}

/* ------------------------------ summary rows -------------------------------- */

export interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Review projection — one pure builder so the review step, the summary rail
 * and the completion screen render the exact same truth.
 */
export function enrollmentSummary(
  course: EnrollCourseLite,
  group: EnrollGroupLite | null,
  draft: EnrollDraft,
): { courseRows: SummaryRow[]; scheduleRows: SummaryRow[]; studentRows: SummaryRow[]; priceRows: SummaryRow[] } {
  const courseRows: SummaryRow[] = [
    { label: "Kurs", value: course.title },
    { label: "Ustoz", value: course.teacherName },
  ];
  if (course.category) courseRows.push({ label: "Yo‘nalish", value: course.category });

  const scheduleRows: SummaryRow[] = group
    ? [
        { label: "Guruh", value: group.title },
        { label: "Kunlar va vaqt", value: groupScheduleLabel(group) },
        { label: "Format", value: group.formatLabel },
        { label: "Manzil", value: groupWhereLabel(group) },
        { label: "Boshlanish", value: group.startDateLabel },
        {
          label: "Joylar",
          value: `${group.capacity - group.seatsRemaining}/${group.capacity} band`,
        },
      ]
    : [{ label: "Guruh", value: "Tanlanmagan — 1-qadamda tanlang" }];

  const studentRows: SummaryRow[] = [
    { label: "Ism", value: draft.name.trim() === "" ? "Kiritilmagan" : draft.name.trim() },
    { label: "Telefon", value: draft.phone === "" ? "Kiritilmagan" : draft.phone },
  ];
  if (draft.note.trim() !== "") studentRows.push({ label: "Ustozga izoh", value: draft.note.trim() });

  const priceRows: SummaryRow[] =
    course.priceUzs === 0
      ? [
          { label: "Narx", value: "Bepul" },
          { label: "To‘lov", value: "Bu bepul kurs — to‘lov bosqichi bo‘lmaydi." },
        ]
      : [
          { label: "Narx", value: course.priceSummary },
          {
            label: "To‘lov",
            value:
              "Onlayn to‘lov bosqichi backend bilan qo‘shiladi — narxni ustoz bilan bevosita kelishasiz.",
          },
        ];

  return { courseRows, scheduleRows, studentRows, priceRows };
}

/* ------------------------------ href builders ------------------------------- */

/** Canonical enrollment href — `?group=` omitted for the course‘s first group
 *  (the same defaulting rule the Phase 4 detail page uses). */
export function buildEnrollHref(
  course: EnrollCourseLite,
  groupId: string | null,
): string {
  const base = `/enroll/${course.slug}`;
  if (!groupId || groupId === course.groups[0]?.id) return base;
  return `${base}?group=${encodeURIComponent(groupId)}`;
}

/** The auth routes as seen FROM this enrollment step — ?next= returns here. */
export function enrollAuthHrefs(
  course: EnrollCourseLite,
  groupId: string | null,
): { login: string; register: string; enroll: string } {
  const enroll = buildEnrollHref(course, groupId);
  return {
    enroll,
    login: withNext("/login", enroll),
    register: withNext("/register?role=student", enroll),
  };
}

/** Where onboarding/registration should send the student back to after the
 *  prototype flow; null-safe (no next when the enroll target is unknown). */
export function enrollNextParam(
  course: EnrollCourseLite,
  groupId: string | null,
): string {
  return buildEnrollHref(course, groupId);
}
