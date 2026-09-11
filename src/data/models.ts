/**
 * USTOZ domain models — Phase 2.
 *
 * These interfaces define the exact shape the marketplace UI consumes.
 * Mock data (categories.ts / courses.ts / teachers.ts) satisfies these same
 * types, so swapping the mock arrays for API responses in a later phase
 * changes nothing in components. Keep models plain-serializable: no
 * functions, no React nodes — icon references are string keys resolved at
 * the presentation layer (see components/icons.tsx).
 */

export type CourseFormat = "online" | "offline" | "hybrid";

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
