import type { CourseFormat } from "@/data/models";
import {
  ENROLL_DONE_INDEX,
  groupScheduleLabel,
  groupWhereLabel,
  type EnrollDraft,
  type EnrollGroupLite,
} from "./enroll";
import type { TeacherAnswers } from "./onboarding";
import type { CourseAuthoringSeed } from "./course-draft";

/* -------------------------------------------------------------------------- */
/* Teacher workspace model — Phase 9. PURE module (no React, no DOM, no        */
/* dataset imports), the same contract-first pattern as course-search /         */
/* enroll / dashboard:                                                          */
/*   • TeacherWorkspaceLite / TeacherCourseLite — the serializable projection    */
/*     built server-side (data/teacher-dashboard.ts) from the canonical          */
/*     teachers + courses arrays. Client islands never import the datasets.      */
/*   • Selectors below take that projection + prototype state and return read    */
/*     models. Nothing is duplicated and nothing is invented.                    */
/*                                                                                */
/* IDENTITY HONESTY: there is no signed-in teacher. The "workspace" is an        */
/* explicitly chosen canonical teacher id used to inspect the teacher surface    */
/* (see components/teacher-dashboard/workspace-store.ts). It is prototype        */
/* workspace state, NOT a session, and the UI says so on every screen.           */
/* -------------------------------------------------------------------------- */

/* ------------------------------ lite projection ---------------------------- */

/** Group projection is byte-identical to the Phase 7 one — reuse, don't fork. */
export type TeacherGroupLite = EnrollGroupLite;

export interface TeacherCourseLite {
  /** Canonical course id. */
  id: string;
  slug: string;
  title: string;
  image: string | null;
  category: string | null;
  format: CourseFormat;
  formatLabel: string;
  /** Venue text for offline/hybrid; null for online. */
  location: string | null;
  levelLabel: string;
  /** Server-formatted once ("320 000 so'm / oyiga" | "Bepul"). */
  priceSummary: string;
  priceUzs: number;
  rating: number;
  reviews: number;
  students: number;
  /** ISO date the listing went public (canonical `publishedAt`). */
  publishedAt: string;
  publishedAtLabel: string;
  groups: TeacherGroupLite[];
  /** Phase 10: authoring-shaped snapshot used ONLY by "copy into a new local
   *  draft". Read-only projection of the canonical record. */
  authoringSeed: CourseAuthoringSeed;
}

export interface TeacherWorkspaceLite {
  /** Canonical teacher id — the only identifier prototype state stores. */
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  verified: boolean;
  specialization: string;
  bio: string;
  approach: string;
  rating: number;
  reviews: number;
  students: number;
  experienceYears: number;
  languages: string[];
  /** City slugs derived from the teacher's offline/hybrid courses. */
  cities: string[];
  cityLabels: string[];
  formatLabels: string[];
  categoryNames: string[];
  courses: TeacherCourseLite[];
}

/** Everything the teacher-dashboard client islands are allowed to know. */
export interface TeacherDirectory {
  workspaces: TeacherWorkspaceLite[];
}

export function findWorkspace(
  directory: TeacherDirectory,
  teacherId: string | null,
): TeacherWorkspaceLite | null {
  if (teacherId === null) return null;
  return directory.workspaces.find((entry) => entry.id === teacherId) ?? null;
}

/* ------------------------------ workspace state ---------------------------- */

/**
 * Prototype workspace selection. Deliberately minimal: ONE canonical teacher
 * id and nothing else — no name copy, no role claim, no token, no session id.
 * A real auth layer replaces the store around this type; the type itself is
 * what a `GET /me` response would reduce to.
 */
export interface TeacherWorkspaceState {
  version: 1;
  /** Canonical teacher id, or null when nothing has been chosen. */
  teacherId: string | null;
}

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function emptyWorkspaceState(): TeacherWorkspaceState {
  return { version: 1, teacherId: null };
}

/** Defensive parse of anything read back from storage (null = start fresh). */
export function parseWorkspaceState(value: unknown): TeacherWorkspaceState | null {
  if (typeof value !== "object" || value === null) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return null;
  const id = source.teacherId;
  return {
    version: 1,
    teacherId: typeof id === "string" && ID_RE.test(id) ? id : null,
  };
}

/* -------------------------------- statistics -------------------------------- */

export interface TeacherStat {
  label: string;
  value: string;
  /** Where the number comes from — shown so no metric looks invented. */
  hint: string;
}

/**
 * Overview metrics. EVERY value is a count or an average already present in the
 * canonical dataset — there is deliberately no revenue, payout, growth,
 * conversion or teaching-hours metric anywhere in this model, because no such
 * fact exists in the product.
 */
export function teacherStats(workspace: TeacherWorkspaceLite): TeacherStat[] {
  const groups = workspace.courses.reduce((sum, c) => sum + c.groups.length, 0);
  const openSeats = workspace.courses.reduce(
    (sum, c) => sum + c.groups.reduce((s, g) => s + Math.max(0, g.seatsRemaining), 0),
    0,
  );
  return [
    {
      label: "Faol kurslar",
      value: String(workspace.courses.length),
      hint: "Katalogda e’lon qilingan kurslaringiz soni.",
    },
    {
      label: "Guruhlar",
      value: String(groups),
      hint: "Shu kurslardagi jadval guruhlari (mock ma’lumot).",
    },
    {
      label: "Bo‘sh joylar",
      value: String(openSeats),
      hint: "Guruhlardagi qolgan joylar yig‘indisi.",
    },
    {
      label: "Reyting",
      value: workspace.reviews > 0 ? workspace.rating.toFixed(1) : "—",
      hint:
        workspace.reviews > 0
          ? `${workspace.reviews} ta izoh asosida (katalog ma’lumoti).`
          : "Hali izoh yo‘q.",
    },
  ];
}

/* ---------------------------- prototype requests ---------------------------- */

/**
 * The teacher-side view of the ONE Phase 7 local draft. Same honesty rules as
 * the student dashboard: the only representable states are a local draft and a
 * locally prepared request. There is no accepted / rejected / paid member,
 * because no such fact exists — and no approve/reject action is modelled.
 */
export type TeacherRequestStatus = "draft" | "prepared";

export interface TeacherRequestView {
  courseId: string;
  courseTitle: string;
  courseHref: string;
  status: TeacherRequestStatus;
  statusLabel: string;
  statusNote: string;
  groupTitle: string | null;
  scheduleLabel: string | null;
  formatLabel: string | null;
  whereLabel: string | null;
  startDateLabel: string | null;
  seatsLabel: string | null;
  priceSummary: string;
  studentName: string | null;
  studentPhone: string | null;
  note: string | null;
}

export const TEACHER_REQUEST_STATUS_LABELS: Record<TeacherRequestStatus, string> = {
  draft: "Tugallanmagan qoralama",
  prepared: "So‘rov tayyor",
};

export const TEACHER_REQUEST_STATUS_NOTES: Record<TeacherRequestStatus, string> = {
  draft:
    "Mahalliy prototip ma’lumoti — o‘quvchi yozilish shaklini yakunlamagan.",
  prepared:
    "Mahalliy prototip ma’lumoti — backend ulanmagan, bu so‘rov sizga yuborilmagan va joy band qilinmagan.",
};

/**
 * Derive the teacher-side request view from the Phase 7 draft.
 *
 * OWNERSHIP GUARD: returns null unless the draft's course is one of THIS
 * workspace's canonical courses — a draft for another teacher's course can
 * never leak into this teacher's screen.
 */
export function toTeacherRequest(
  workspace: TeacherWorkspaceLite,
  draft: EnrollDraft,
): TeacherRequestView | null {
  const course = workspace.courses.find((entry) => entry.slug === draft.courseSlug);
  if (!course) return null;

  const group = draft.groupId
    ? (course.groups.find((entry) => entry.id === draft.groupId) ?? null)
    : null;

  const status: TeacherRequestStatus =
    draft.submitted && draft.furthest >= ENROLL_DONE_INDEX && group !== null
      ? "prepared"
      : "draft";

  const name = draft.name.trim();
  const note = draft.note.trim();

  return {
    courseId: course.id,
    courseTitle: course.title,
    courseHref: `/courses/${course.slug}`,
    status,
    statusLabel: TEACHER_REQUEST_STATUS_LABELS[status],
    statusNote: TEACHER_REQUEST_STATUS_NOTES[status],
    groupTitle: group?.title ?? null,
    scheduleLabel: group ? groupScheduleLabel(group) : null,
    formatLabel: group?.formatLabel ?? null,
    whereLabel: group ? groupWhereLabel(group) : null,
    startDateLabel: group?.startDateLabel ?? null,
    seatsLabel: group
      ? `${group.capacity - group.seatsRemaining}/${group.capacity} band`
      : null,
    priceSummary: course.priceSummary,
    studentName: name === "" ? null : name,
    studentPhone: draft.phone === "" ? null : draft.phone,
    note: note === "" ? null : note,
  };
}

/* -------------------------------- profile ---------------------------------- */

export interface TeacherProfileField {
  label: string;
  value: string | null;
  /** Which layer the value came from — the backend-replacement seam. */
  source: "catalog" | "draft";
}

export interface TeacherProfileCompleteness {
  filled: number;
  total: number;
  missing: string[];
  complete: boolean;
}

export function teacherProfileCompleteness(
  fields: readonly TeacherProfileField[],
): TeacherProfileCompleteness {
  const missing = fields.filter((f) => f.value === null).map((f) => f.label);
  return {
    filled: fields.length - missing.length,
    total: fields.length,
    missing,
    complete: missing.length === 0,
  };
}

/** True when the Phase 6 teacher onboarding draft holds anything at all. */
export function hasTeacherDraft(answers: TeacherAnswers): boolean {
  return (
    answers.name.trim() !== "" ||
    answers.phone !== "" ||
    answers.city !== null ||
    answers.categories.length > 0 ||
    answers.levels.length > 0 ||
    answers.experienceYears !== null ||
    answers.formats.length > 0 ||
    answers.languages.length > 0 ||
    answers.bio.trim() !== "" ||
    answers.approach.trim() !== ""
  );
}

/* -------------------------------- navigation -------------------------------- */

export interface TeacherNavItem {
  href: string;
  label: string;
  icon: "overview" | "courses" | "requests" | "verification" | "profile" | "notifications";
  description: string;
}

/** Teacher navigation. Only routes that exist — no placeholder entries. */
export const TEACHER_NAV: readonly TeacherNavItem[] = [
  {
    href: "/teacher/dashboard",
    label: "Umumiy",
    icon: "overview",
    description: "Kurslar, guruhlar va profil bo‘yicha qisqa holat.",
  },
  {
    href: "/teacher/dashboard/courses",
    label: "Kurslarim",
    icon: "courses",
    description: "Katalogdagi kurslaringiz, guruhlar va joylar.",
  },
  {
    href: "/teacher/dashboard/verification",
    label: "Tasdiqlash",
    icon: "verification",
    description: "Profil tasdig‘i holati va ariza yuborish.",
  },
  {
    href: "/teacher/dashboard/requests",
    label: "So‘rovlar",
    icon: "requests",
    description: "Kelgan yozilish so‘rovlarini qabul qilish yoki rad etish.",
  },
  {
    href: "/notifications",
    label: "Bildirishnomalar",
    icon: "notifications",
    description: "Yangi so‘rov va bekor qilishlar bo‘yicha xabarlar.",
  },
  {
    href: "/teacher/dashboard/profile",
    label: "Profil",
    icon: "profile",
    description: "Ustoz profili va onboarding qoralamasi.",
  },
];

/** Exact-match for the index route, prefix-match for the sections. */
export function isActiveTeacherNav(pathname: string, href: string): boolean {
  if (href === "/teacher/dashboard") return pathname === "/teacher/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
