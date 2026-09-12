import type { UserRole } from "./onboarding";
import {
  ENROLL_DONE_INDEX,
  groupScheduleLabel,
  groupWhereLabel,
  type EnrollDraft,
  type EnrollGroupLite,
} from "./enroll";

/* -------------------------------------------------------------------------- */
/* Student dashboard model — Phase 8. PURE module (no React, no DOM, no        */
/* dataset imports), the same contract-first pattern as course-search /         */
/* teacher-search / onboarding / enroll:                                        */
/*   • DashCourseLite / DashTeacherLite — the serializable catalog projection    */
/*     the server pages build (lib/dashboard-catalog.ts). Client islands never   */
/*     import courses.ts / teachers.ts, so the full catalog is not shipped as a   */
/*     side effect of a saved list.                                              */
/*   • DashRequest — the enrollment-request read model, DERIVED from the         */
/*     Phase 7 EnrollDraft + the catalog projection. No enrollment facts are     */
/*     stored twice and no status is invented.                                   */
/*   • Statuses are honest by construction: the union has no "accepted" /        */
/*     "confirmed" / "paid" member, because no such state exists anywhere.       */
/* -------------------------------------------------------------------------- */

/* ------------------------------ catalog lite ------------------------------- */

export interface DashCourseLite {
  /** Canonical course id — the value saved state stores. */
  id: string;
  slug: string;
  title: string;
  image: string | null;
  category: string | null;
  formatLabel: string;
  /** Venue text for offline/hybrid; null for online. */
  location: string | null;
  teacherName: string;
  teacherSlug: string | null;
  /** Server-formatted once ("320 000 so‘m / oyiga" | "Bepul"). */
  priceSummary: string;
  priceUzs: number;
  /** Reuses the Phase 7 group projection verbatim — group labels have ONE
   *  builder (lib/enroll.ts) across the enrollment flow and the dashboard. */
  groups: EnrollGroupLite[];
}

export interface DashTeacherLite {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  verified: boolean;
  specialization: string;
  activeCourses: number;
}

/** Everything the dashboard client islands are allowed to know. */
export interface DashCatalog {
  courses: DashCourseLite[];
  teachers: DashTeacherLite[];
}

export function findCourse(
  catalog: DashCatalog,
  id: string,
): DashCourseLite | null {
  return catalog.courses.find((course) => course.id === id) ?? null;
}

export function findCourseBySlug(
  catalog: DashCatalog,
  slug: string,
): DashCourseLite | null {
  return catalog.courses.find((course) => course.slug === slug) ?? null;
}

/** Saved ids → catalog rows, dropping ids that no longer exist (honest: the
 *  catalog stays canonical; a stale id simply disappears, never a placeholder). */
export function savedCourses(
  catalog: DashCatalog,
  ids: readonly string[],
): DashCourseLite[] {
  const out: DashCourseLite[] = [];
  for (const id of ids) {
    const course = findCourse(catalog, id);
    if (course) out.push(course);
  }
  return out;
}

export function savedTeachers(
  catalog: DashCatalog,
  ids: readonly string[],
): DashTeacherLite[] {
  const out: DashTeacherLite[] = [];
  for (const id of ids) {
    const teacher = catalog.teachers.find((entry) => entry.id === id);
    if (teacher) out.push(teacher);
  }
  return out;
}

/* --------------------------- enrollment requests ---------------------------- */

/**
 * The only two states a frontend prototype can honestly report:
 *   draft      — the student started the flow and stopped somewhere;
 *   prepared   — the review step was completed ("So‘rov tayyor"), which is a
 *                UI marker, NOT a server record, NOT teacher approval.
 * There is deliberately no accepted/confirmed/paid member of this union.
 */
export type DashRequestStatus = "draft" | "prepared";

export interface DashRequestGroup {
  id: string;
  title: string;
  scheduleLabel: string;
  formatLabel: string;
  whereLabel: string;
  startDateLabel: string;
  seatsLabel: string;
}

export interface DashRequest {
  courseSlug: string;
  courseTitle: string;
  courseHref: string;
  /** Resume/edit the Phase 7 flow at the right group. */
  enrollHref: string;
  teacherName: string;
  priceSummary: string;
  status: DashRequestStatus;
  statusLabel: string;
  /** Why the status says what it says — shown next to the badge. */
  statusNote: string;
  /** Null when the draft never got past group selection. */
  group: DashRequestGroup | null;
  studentName: string | null;
  studentPhone: string | null;
  note: string | null;
}

export const REQUEST_STATUS_LABELS: Record<DashRequestStatus, string> = {
  draft: "Tugallanmagan qoralama",
  prepared: "So‘rov tayyor",
};

export const REQUEST_STATUS_NOTES: Record<DashRequestStatus, string> = {
  draft:
    "Yozilish jarayoni oxirigacha yakunlanmagan — brauzeringizdagi qoralama.",
  prepared:
    "Backend ulanmagan: so‘rov hech qayerga yuborilmadi va ustoz uni hali ko‘rmaydi.",
};

/**
 * Build the dashboard read model for the ONE Phase 7 enrollment draft that
 * exists in this browser. Pure: the caller supplies the sanitized draft and
 * the catalog projection; nothing is invented and nothing is duplicated.
 * Returns null when the draft points at a course that is no longer published.
 */
export function toDashRequest(
  catalog: DashCatalog,
  draft: EnrollDraft,
): DashRequest | null {
  const course = findCourseBySlug(catalog, draft.courseSlug);
  if (!course) return null;

  const group = draft.groupId
    ? (course.groups.find((entry) => entry.id === draft.groupId) ?? null)
    : null;

  // "prepared" requires the flow to have actually reached the completion
  // screen AND a real group to be attached — anything else stays a draft.
  const status: DashRequestStatus =
    draft.submitted && draft.furthest >= ENROLL_DONE_INDEX && group !== null
      ? "prepared"
      : "draft";

  const name = draft.name.trim();
  const note = draft.note.trim();

  return {
    courseSlug: course.slug,
    courseTitle: course.title,
    courseHref: `/courses/${course.slug}`,
    enrollHref:
      group && group.id !== course.groups[0]?.id
        ? `/enroll/${course.slug}?group=${encodeURIComponent(group.id)}`
        : `/enroll/${course.slug}`,
    teacherName: course.teacherName,
    priceSummary: course.priceSummary,
    status,
    statusLabel: REQUEST_STATUS_LABELS[status],
    statusNote: REQUEST_STATUS_NOTES[status],
    group: group
      ? {
          id: group.id,
          title: group.title,
          scheduleLabel: groupScheduleLabel(group),
          formatLabel: group.formatLabel,
          whereLabel: groupWhereLabel(group),
          startDateLabel: group.startDateLabel,
          seatsLabel: `${group.capacity - group.seatsRemaining}/${group.capacity} band`,
        }
      : null,
    studentName: name === "" ? null : name,
    studentPhone: draft.phone === "" ? null : draft.phone,
    note: note === "" ? null : note,
  };
}

/* ------------------------------ profile model ------------------------------- */

export interface ProfileField {
  label: string;
  value: string | null;
}

export interface ProfileCompleteness {
  filled: number;
  total: number;
  /** Field labels still empty — drives the “complete your profile” path. */
  missing: string[];
  complete: boolean;
}

/** Completeness over the student profile rows (nulls = not filled). */
export function profileCompleteness(
  fields: readonly ProfileField[],
): ProfileCompleteness {
  const missing = fields.filter((f) => f.value === null).map((f) => f.label);
  return {
    filled: fields.length - missing.length,
    total: fields.length,
    missing,
    complete: missing.length === 0,
  };
}

/* -------------------------------- navigation -------------------------------- */

export interface DashNavItem {
  href: string;
  label: string;
  /** Icon key resolved at the presentation layer (plain-serializable model). */
  icon: "overview" | "requests" | "saved" | "profile" | "notifications";
  /** Short description used by the mobile/overview surfaces. */
  description: string;
}

/** Student navigation. Only routes that exist — no placeholder entries. */
export const STUDENT_NAV: readonly DashNavItem[] = [
  {
    href: "/dashboard",
    label: "Umumiy",
    icon: "overview",
    description: "Profil, so‘rov va saqlanganlar bo‘yicha qisqa holat.",
  },
  {
    href: "/dashboard/courses",
    label: "So‘rovlarim",
    icon: "requests",
    description: "Yozilish qoralamalari va tayyor so‘rovlar.",
  },
  {
    href: "/notifications",
    label: "Bildirishnomalar",
    icon: "notifications",
    description: "So‘rovlaringiz bo‘yicha ilova ichidagi xabarlar.",
  },
  {
    href: "/dashboard/saved",
    label: "Saqlanganlar",
    icon: "saved",
    description: "Saqlangan kurslar va ustozlar.",
  },
  {
    href: "/dashboard/profile",
    label: "Profil",
    icon: "profile",
    description: "O‘quvchi ma’lumotlari va o‘qish afzalliklari.",
  },
];

/** Exact-match for the index route, prefix-match for the sections. */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The dashboard is student-only in Phase 8. A prototype draft carrying the
 * teacher role must NOT be silently shown a student dashboard — the shell
 * renders an explicit notice instead (Phase 9 owns the teacher surface).
 */
export function dashboardRoleState(
  role: UserRole | null,
): "student" | "teacher" | "unknown" {
  if (role === "student") return "student";
  if (role === "teacher") return "teacher";
  return "unknown";
}
