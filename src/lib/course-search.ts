import type {
  Course,
  CourseFormat,
  CourseLevel,
  CourseSchedule,
} from "@/data/models";
import { courseRatingFilters } from "@/data/courses";
import { citySlugs } from "@/data/taxonomy";

/* -------------------------------------------------------------------------- */
/* Course search engine — the single pure contract behind every browse          */
/* surface (/courses and /categories/[slug]), Phase 3 spec:                      */
/*   • parseCourseBrowseParams  URL → typed filters (whitelist, defensive)      */
/*   • serializeBrowseParams    filters → canonical query (defaults omitted)    */
/*   • buildBrowseHref          basePath + params → shareable/bookmarkable href */
/*   • applyCourseBrowse        filters → filtered + deterministically sorted   */
/* No React, no navigation: presentation components and the two tiny client      */
/* islands reuse these helpers, so URL ⇄ list can never diverge.                 */
/* Param names: q, format (legacy: mode), level, city, price, pmin, pmax,       */
/* schedule, rating, sort. Facets are single-select — URLs stay canonical and     */
/* “tap the active option again” clears it.                                      */
/* -------------------------------------------------------------------------- */

export type CourseSortKey =
  | "recommended"
  | "rating"
  | "price-asc"
  | "price-desc"
  | "newest";

export interface CourseBrowseParams {
  /** Free-text query, already trimmed; "" when absent. */
  q: string;
  format: CourseFormat | null;
  level: CourseLevel | null;
  schedule: CourseSchedule | null;
  /** City slug validated against the catalog; null when absent/unknown. */
  city: string | null;
  /** "free" = only priceUzs 0 · "paid" = only priceUzs > 0 · null = any. */
  price: "free" | "paid" | null;
  /** Monthly-price bounds in UZS (null = unbounded). */
  priceMin: number | null;
  priceMax: number | null;
  /** Minimum rating (4 or 4.5) or null. */
  minRating: number | null;
  sort: CourseSortKey;
}

export const defaultBrowseParams: CourseBrowseParams = {
  q: "",
  format: null,
  level: null,
  schedule: null,
  city: null,
  price: null,
  priceMin: null,
  priceMax: null,
  minRating: null,
  sort: "recommended",
};

const FORMATS: readonly string[] = ["online", "offline", "hybrid"];
const LEVELS: readonly string[] = ["boshlangich", "orta", "yuqori"];
const SCHEDULES: readonly string[] = ["morning", "day", "evening"];
const SORTS: readonly string[] = [
  "recommended",
  "rating",
  "price-asc",
  "price-desc",
  "newest",
];

/** First value of a possibly-repeated search param (Next gives string[]). */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Strict non-negative integer or null (extra dots/letters → ignore). */
function parseMoney(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

/**
 * Parse + sanitize Next's raw searchParams into typed browse state.
 *
 * `allowedCities` is the city whitelist. Production pages pass the RUNTIME
 * list from `getPublicFacets()` (cities that currently have published
 * courses), so the whitelist can never reject a real inventory city or bless
 * a fixture-only one. Callers without a database (pure helpers, tests) omit
 * it and get the static product taxonomy instead — never fixture inventory.
 */
export function parseCourseBrowseParams(
  searchParams: Record<string, string | string[] | undefined>,
  allowedCities: readonly string[] = citySlugs,
): CourseBrowseParams {
  const rawFormat = first(searchParams.format) ?? first(searchParams.mode) ?? "";
  const rawCity = (first(searchParams.city) ?? "").toLowerCase();
  const rawPrice = first(searchParams.price) ?? "";
  const rawRating = first(searchParams.rating) ?? "";
  const rawSort = first(searchParams.sort) ?? "";
  const priceMin = parseMoney(searchParams.pmin);
  const priceMax = parseMoney(searchParams.pmax);

  return {
    q: (first(searchParams.q) ?? "").trim().slice(0, 100),
    format: FORMATS.includes(rawFormat) ? (rawFormat as CourseFormat) : null,
    level: LEVELS.includes(first(searchParams.level) ?? "")
      ? (first(searchParams.level) as CourseLevel)
      : null,
    schedule: SCHEDULES.includes(first(searchParams.schedule) ?? "")
      ? (first(searchParams.schedule) as CourseSchedule)
      : null,
    city: allowedCities.includes(rawCity) ? rawCity : null,
    price: rawPrice === "free" || rawPrice === "paid" ? rawPrice : null,
    priceMin,
    priceMax: priceMax !== null && priceMax >= (priceMin ?? 0) ? priceMax : null,
    minRating:
      courseRatingFilters.find((f) => f.value === rawRating)?.min ?? null,
    sort: SORTS.includes(rawSort) ? (rawSort as CourseSortKey) : "recommended",
  };
}

/** Serialize to a query string — defaults are omitted so “clear” URLs are
 *  canonical (`/courses`, not `/courses?format=online&sort=recommended…`). */
export function serializeBrowseParams(
  params: Partial<CourseBrowseParams>,
): string {
  const parts: string[] = [];
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.format) parts.push(`format=${params.format}`);
  if (params.level) parts.push(`level=${params.level}`);
  if (params.city) parts.push(`city=${params.city}`);
  if (params.price) parts.push(`price=${params.price}`);
  // `!= null` (not `!== null`): partial objects must not leak “undefined”.
  if (params.priceMin != null) parts.push(`pmin=${params.priceMin}`);
  if (params.priceMax != null) parts.push(`pmax=${params.priceMax}`);
  if (params.schedule) parts.push(`schedule=${params.schedule}`);
  if (params.minRating != null)
    parts.push(`rating=${String(params.minRating)}`);
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
  return (
    params.q !== "" ||
    params.format !== null ||
    params.level !== null ||
    params.city !== null ||
    params.price !== null ||
    params.priceMin !== null ||
    params.priceMax !== null ||
    params.schedule !== null ||
    params.minRating !== null
  );
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
      course.keywords.join(" "),
    ].join(" "),
  );
}

/**
 * Deterministic sorters. “recommended” = the data order (curated, see
 * courses.ts header note); every comparator breaks ties on `publishedAt`
 * and then on `id`, so results are stable across renders and reorders of
 * equally-ranked items (sort itself is stable in all supported engines).
 */
const byDateThenId = (a: Course, b: Course) =>
  b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);

const sorters: Record<CourseSortKey, (a: Course, b: Course) => number> = {
  recommended: () => 0,
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews || a.id.localeCompare(b.id),
  "price-asc": (a, b) => a.priceUzs - b.priceUzs || byDateThenId(a, b),
  "price-desc": (a, b) => b.priceUzs - a.priceUzs || byDateThenId(a, b),
  /** ISO date strings sort lexicographically — no Date parsing, SSR-safe. */
  newest: byDateThenId,
};

/**
 * Filter + sort a course list. `categoryNameOf` maps course.categoryId to a
 * human label so queries like “ingliz” hit the category word too.
 */
export function applyCourseBrowse(
  source: Course[],
  params: CourseBrowseParams,
  categoryNameOf: (categoryId: string) => string,
): Course[] {
  const needle = normalizeForMatch(params.q);
  const filtered = source.filter((course) => {
    if (params.format && course.format !== params.format) return false;
    if (params.level && course.level !== params.level) return false;
    if (params.schedule && course.schedule !== params.schedule) return false;
    if (params.city && course.city !== params.city) return false;
    if (params.price === "free" && course.priceUzs > 0) return false;
    if (params.price === "paid" && course.priceUzs <= 0) return false;
    if (params.priceMin !== null && course.priceUzs < params.priceMin)
      return false;
    if (params.priceMax !== null && course.priceUzs > params.priceMax)
      return false;
    if (params.minRating !== null && course.rating < params.minRating)
      return false;
    if (
      needle &&
      !haystack(course, categoryNameOf(course.categoryId)).includes(needle)
    )
      return false;
    return true;
  });
  return params.sort === "recommended"
    ? filtered
    : [...filtered].sort(sorters[params.sort]);
}
