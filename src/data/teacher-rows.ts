import { categories } from "./categories";
import { courses } from "./courses";
import { teachers } from "./teachers";
import type { CourseFormat, Teacher } from "./models";

/**
 * SEED-ONLY derived teacher rows (dev seed input + the dev-demo teacher
 * workspace inspector + the `TeacherRow` TYPE, which the database-backed
 * repository also projects into).
 *
 * Everything here is COMPUTED from the fixture datasets (teachers.ts +
 * courses.ts). No production browse surface reads these rows: /teachers and
 * /teachers/[slug] derive the equivalent read model in SQL
 * (listPublicTeachers in src/server/public-repo.ts).
 *
 * RUNTIME-SAFE EXPORTS IN THIS FILE: the `TeacherRow` type (erased at
 * compile time — not a data dependency) and the static threshold lists
 * `teacherRatingFilters` / `teacherExperienceFilters` (product vocabulary,
 * not inventory). Phase 20 DELETED the fixture-derived `teacherCities` /
 * `teacherLanguages` lists: form vocabularies read the static taxonomy
 * (src/data/taxonomy.ts); browse filter options and the URL whitelist come
 * from live database rows (getPublicFacets + parseTeacherBrowseParams with a
 * runtime allow-list).
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

export const teacherRatingFilters = [
  { value: "4.0", label: "4.0 va yuqori", min: 4.0 },
  { value: "4.5", label: "4.5 va yuqori", min: 4.5 },
] as const;

export const teacherExperienceFilters = [
  { value: "5", label: "5+ yil tajriba", min: 5 },
  { value: "10", label: "10+ yil tajriba", min: 10 },
] as const;
