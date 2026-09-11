/**
 * USTOZ domain models — Phase 2, extended by the Phase 3 browse layer and
 * the Phase 4 course-detail layer.
 *
 * These interfaces define the exact shape the marketplace UI consumes.
 * Mock data (categories.ts / courses.ts / teachers.ts) satisfies these same
 * types, so swapping the mock arrays for API responses in a later phase
 * changes nothing in components. Keep models plain-serializable: no
 * functions, no React nodes — icon references are string keys resolved at
 * the presentation layer (see components/icons.tsx).
 */

export type CourseFormat = "online" | "offline" | "hybrid";

/** Course difficulty — drives the Phase 3 level facet (labels in courses.ts). */
export type CourseLevel = "boshlangich" | "orta" | "yuqori";

/** Representative lesson time-of-day — drives the Phase 3 schedule facet. */
export type CourseSchedule = "morning" | "day" | "evening";

export type CategoryIconKey =
  | "languages"
  | "award"
  | "sigma"
  | "code"
  | "scroll"
  | "pen";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: CategoryIconKey;
  /** Mock: number of published courses in the category. */
  courseCount: number;
}

/** Minimal teacher projection embedded in a course (list-page shape). */
export interface CourseTeacher {
  id: string;
  name: string;
  verified: boolean;
}

/** One bookable group of a course (Phase 4). Days are pre-formatted Uzbek
 *  abbreviations ("Du", "Chor", …) — display text lives in the data so a
 *  future API can localize server-side without new model fields. */
export interface CourseGroup {
  id: string;
  /** Human label: "A guruhi". */
  title: string;
  days: string[];
  /** 24h “HH:MM” start time. */
  startTime: string;
  format: CourseFormat;
  /** Venue text for offline/hybrid; null for online groups. */
  location: string | null;
  capacity: number;
  /** Seats still open; 0 renders “Guruh to‘lgan” and blocks selection. */
  seatsRemaining: number;
  /** ISO “YYYY-MM-DD”, lexicographically sortable. */
  startDate: string;
}

export interface SyllabusModule {
  title: string;
  description: string;
  /** Informational lesson count — this is not an LMS (no playback). */
  lessons: number;
}

export interface CourseReview {
  id: string;
  courseId: string;
  author: string;
  rating: number;
  text: string;
  /** ISO date of the review. */
  date: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Course-detail payload (Phase 4). Grouped under `Course.detail` so list
 *  views keep consuming the light list-shape fields only. */
export interface CourseDetail {
  /** 1–2 sentence pitch shown in the hero. */
  summary: string;
  /** Full paragraph for the “Kurs haqida” section. */
  longDescription: string;
  /** Target-audience bullets. */
  audience: string[];
  /** “Nimalarni o‘rganasiz” outcomes. */
  learningOutcomes: string[];
  /** ISO 639-1 tags, same convention as Teacher.languages. */
  teachingLanguages: string[];
  /** Pricing unit; “month” renders “/ oyiga”. */
  pricePeriod: "month";
  groups: CourseGroup[];
  syllabus: SyllabusModule[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  teacher: CourseTeacher;
  /** 0..5, one decimal — as displayed. */
  rating: number;
  reviews: number;
  students: number;
  format: CourseFormat;
  /** District/landmark text; meaningful only for offline/hybrid. */
  location: string | null;
  /** Lowercase city slug ("toshkent" …) for the browse-city facet; null for
   *  online-only courses. Display label derives from it (capitalize). */
  city: string | null;
  level: CourseLevel;
  schedule: CourseSchedule;
  /** Date the listing went public — ISO “YYYY-MM-DD”, lexicographically
   *  sortable (source for the deterministic “Eng yangi” sort). Mock value. */
  publishedAt: string;
  /** Lowercase Uzbek search keywords (synonyms, exam names) — added to the
   *  search haystack; never rendered as chips. */
  keywords: string[];
  /** Monthly price in UZS; 0 renders as “Bepul”. */
  priceUzs: number;
  image: string | null;
  /** Detail-page payload — only /courses/[slug] consumes it. */
  detail: CourseDetail;
}

export interface Teacher {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  verified: boolean;
  /** Short human label, e.g. “IELTS va umumiy ingliz tili”. */
  specialization: string;
  /** 2–3 sentence profile blurb for the course-detail teacher block. */
  bio: string;
  rating: number;
  reviews: number;
  students: number;
  experienceYears: number;
  /** ISO 639-1 upper-cased tags for display chips: ["UZ","EN","RU"]. */
  languages: string[];
  activeCourses: number;
}
