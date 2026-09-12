import { categories } from "./categories";
import { courses } from "./courses";
import { teachers } from "./teachers";
import type { CourseFormat, Teacher } from "./models";

/**
 * Derived teacher rows — the browse layer's read model for /teachers.
 * Everything here is COMPUTED from the canonical datasets (teachers.ts +
 * courses.ts), so a teacher's availability, cities, subjects and pricing
 * can never drift from the courses that actually exist. No new facts are
 * invented; there is simply no second source.
 */
export interface TeacherRow {
  teacher: Teacher;
  /** Ids of the teacher's courses, in catalog order. */
  courseIds: string[];
  /** Category slugs covered by those courses (deduped, catalog order). */
  categorySlugs: string[];
  /** Human category names — search haystack material. */
  categoryNames: string[];
  /** City slugs where the teacher teaches (offline/hybrid courses only). */
  cities: string[];
  /** Formats the teacher actually offers (deduped, stable order). */
  formats: CourseFormat[];
  /** Cheapest monthly price across their courses (0 when any is free);
   *  null when the teacher lists no courses — the card shows no price. */
  minPriceUzs: number | null;
  hasFreeCourse: boolean;
}

const FORMAT_ORDER: CourseFormat[] = ["online", "offline", "hybrid"];
const categoryById = new Map(categories.map((category) => [category.id, category]));

function buildRows(): TeacherRow[] {
  return teachers.map((teacher) => {
    const own = courses.filter((course) => course.teacher.id === teacher.id);
    const categoryIds: string[] = [];
    const cities: string[] = [];
    const formats = new Set<CourseFormat>();
    let minPrice: number | null = null;
    let hasFree = false;
    for (const course of own) {
      if (!categoryIds.includes(course.categoryId)) categoryIds.push(course.categoryId);
      if (course.city && !cities.includes(course.city)) cities.push(course.city);
      formats.add(course.format);
      if (course.priceUzs === 0) hasFree = true;
      minPrice = minPrice === null ? course.priceUzs : Math.min(minPrice, course.priceUzs);
    }
    return {
      teacher,
      courseIds: own.map((course) => course.id),
      categorySlugs: categoryIds.map((id) => categoryById.get(id)?.slug ?? id),
      categoryNames: categoryIds.map((id) => categoryById.get(id)?.name ?? ""),
      cities,
      formats: FORMAT_ORDER.filter((format) => formats.has(format)),
      minPriceUzs: minPrice,
      hasFreeCourse: hasFree,
    };
  });
}

export const teacherRows: TeacherRow[] = buildRows();

export const teacherRowBySlug = new Map(
  teacherRows.map((row) => [row.teacher.slug, row]),
);

/** Facet option lists derived from the data — every option can match something. */
export const teacherCities: string[] = Array.from(
  new Set(teacherRows.flatMap((row) => row.cities)),
);

export const teacherLanguages: string[] = ["UZ", "EN", "RU", "AR"].filter(
  (lang) => teachers.some((teacher) => teacher.languages.includes(lang)),
);

export const teacherRatingFilters = [
  { value: "4.0", label: "4.0 va yuqori", min: 4.0 },
  { value: "4.5", label: "4.5 va yuqori", min: 4.5 },
] as const;

export const teacherExperienceFilters = [
  { value: "5", label: "5+ yil tajriba", min: 5 },
  { value: "10", label: "10+ yil tajriba", min: 10 },
] as const;
