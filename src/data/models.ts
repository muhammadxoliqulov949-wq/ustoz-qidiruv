/**
 * USTOZ domain models — Phase 2, extended by the Phase 3 browse layer.
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
}

export interface Teacher {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  verified: boolean;
  /** Short human label, e.g. “IELTS va umumiy ingliz tili”. */
  specialization: string;
  rating: number;
  reviews: number;
  students: number;
  experienceYears: number;
  /** ISO 639-1 upper-cased tags for display chips: ["UZ","EN","RU"]. */
  languages: string[];
  activeCourses: number;
}
