import type { Course, CourseFormat } from "@/data/models";
import { courseCities } from "@/data/courses";

/* -------------------------------------------------------------------------- */
/* Course search engine — a single pure contract shared by every browse        */
/* surface (/courses and /categories/[slug]):                                  */
/*   • parseCourseSearchParams   URL → typed filters (defensive, whitelisted)  */
/*   • buildBrowseHref           filters → shareable href (defaults omitted)   */
/*   • applyCourseSearch         filters → filtered + sorted list              */
/* The filter bar on results pages is server-rendered links built with          */
/* buildBrowseHref; the two client islands (search field, selects) just call    */
/* buildBrowseHref + router.push. No filtering state lives anywhere else.       */
/* -------------------------------------------------------------------------- */

export type CourseSortKey =
  | "recommended"
  | "rating"
  | "popular"
  | "price-asc"
  | "price-desc";

export interface CourseBrowseParams {
  /** Free-text query, already trimmed; "" when absent. */
  q: string;
  mode: CourseFormat | null;
  freeOnly: boolean;
  /** City slug validated against the catalog; null when absent/unknown. */
  city: string | null;
  sort: CourseSortKey;
}

export const defaultBrowseParams: CourseBrowseParams = {
  q: "",
  mode: null,
  freeOnly: false,
  city: null,
  sort: "recommended",
};

const MODES: readonly string[] = ["online", "offline", "hybrid"];
const SORTS: readonly string[] = [
  "recommended",
  "rating",
  "popular",
  "price-asc",
  "price-desc",
];

/** First value of a possibly-repeated search param (Next gives string[]). */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse + sanitize Next's raw searchParams into typed browse state. */
export function parseCourseBrowseParams(
  searchParams: Record<string, string | string[] | undefined>,
): CourseBrowseParams {
  const rawQ = (first(searchParams.q) ?? "").trim().slice(0, 100);
  const rawMode = first(searchParams.mode) ?? "";
  const rawCity = (first(searchParams.city) ?? "").toLowerCase();
  const rawSort = first(searchParams.sort) ?? "";

  return {
    q: rawQ,
    mode: MODES.includes(rawMode) ? (rawMode as CourseFormat) : null,
    freeOnly: first(searchParams.price) === "free",
    city: (courseCities as readonly string[]).includes(rawCity)
      ? rawCity
      : null,
    sort: SORTS.includes(rawSort) ? (rawSort as CourseSortKey) : "recommended",
  };
}

/** Serialize to a query string — defaults are omitted so “Barchasi” URLs
 *  are canonical (`/courses`, not `/courses?mode=online&sort=recommended…`). */
export function serializeBrowseParams(
  params: Partial<CourseBrowseParams>,
): string {
  const parts: string[] = [];
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.mode) parts.push(`mode=${params.mode}`);
  if (params.freeOnly) parts.push("price=free");
  if (params.city) parts.push(`city=${params.city}`);
  if (params.sort && params.sort !== "recommended")
    parts.push(`sort=${params.sort}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function buildBrowseHref(
  basePath: string,
  params: Partial<CourseBrowseParams>,
): string {
  return `${basePath}${serializeBrowseParams(params)}`;
}

/** True when any filter (besides sort) is active — drives chips/clear UI. */
export function hasActiveFilters(params: CourseBrowseParams): boolean {
  return params.q !== "" || params.mode !== null || params.freeOnly || params.city !== null;
}

/* -------------------------------------------------------------------------- */
/* Matching + sorting                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Normalize for matching: lowercase, collapse whitespace and unify every
 * apostrophe-like codepoint (U+02BB ʻ, curly quotes, straight quote, grave)
 * so “o‘rganish”, "o'rganish" and “o`rganish” all match the same title.
 */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u02BB\u02BC\u2018\u2019'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(course: Course, categoryName: string): string {
  return normalizeForMatch(
    [
      course.title,
      course.teacher.name,
      categoryName,
      course.location ?? "",
      course.city ?? "",
    ].join(" "),
  );
}

const sorters: Record<CourseSortKey, (a: Course, b: Course) => number> = {
  /** Curation = data order (see courses.ts header note). */
  recommended: () => 0,
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  popular: (a, b) => b.students - a.students,
  "price-asc": (a, b) => a.priceUzs - b.priceUzs,
  "price-desc": (a, b) => b.priceUzs - a.priceUzs,
};

/**
 * Filter + sort a course list. `categoryNameOf` maps course.categoryId to a
 * human label so queries like “ingliz” hit the category word too.
 * Array.prototype.sort is stable in every supported engine (Node ≥ 11 /
 * modern browsers), so “recommended” ties keep curated order.
 */
export function applyCourseBrowse(
  source: Course[],
  params: CourseBrowseParams,
  categoryNameOf: (categoryId: string) => string,
): Course[] {
  const needle = normalizeForMatch(params.q);
  const filtered = source.filter((course) => {
    if (params.mode && course.format !== params.mode) return false;
    if (params.freeOnly && course.priceUzs > 0) return false;
    if (params.city && course.city !== params.city) return false;
    if (needle && !haystack(course, categoryNameOf(course.categoryId)).includes(needle))
      return false;
    return true;
  });
  return params.sort === "recommended"
    ? filtered
    : [...filtered].sort(sorters[params.sort]);
}
