import { categories } from "@/data/categories";
import {
  teacherExperienceFilters,
  teacherRatingFilters,
  type TeacherRow,
} from "@/data/teacher-rows";
import { citySlugs, languageTags } from "@/data/taxonomy";
import { normalizeForMatch } from "./course-search";

/* -------------------------------------------------------------------------- */
/* Teacher search engine — the same pure contract shape as Phase 3               */
/* (lib/course-search.ts), over derived TeacherRow data:                         */
/*   • parseTeacherBrowseParams  URL → typed filters (whitelist, defensive)     */
/*   • serializeTeacherParams    filters → canonical query (defaults omitted)    */
/*   • buildTeacherHref          basePath + params → shareable href             */
/*   • applyTeacherBrowse        filters → filtered + deterministically sorted  */
/* Param names: q, subject, format, city, lang, rating, exp, verified, sort.     */
/* Facets are single-select; tapping the active option clears it. No React, no  */
/* navigation — URL ⇄ list can never diverge.                                    */
/* -------------------------------------------------------------------------- */

export type TeacherSortKey = "recommended" | "rating" | "students" | "experience";

export interface TeacherBrowseParams {
  q: string;
  /** Category slug (validated against categories.ts). */
  subject: string | null;
  format: "online" | "offline" | "hybrid" | null;
  /** City slug validated against derived teacher cities. */
  city: string | null;
  /** Language code, uppercase (UZ/EN/RU/AR). */
  lang: string | null;
  minRating: number | null;
  minExperience: number | null;
  /** true only for `?verified=1`. */
  verified: boolean;
  sort: TeacherSortKey;
}

export const defaultTeacherParams: TeacherBrowseParams = {
  q: "",
  subject: null,
  format: null,
  city: null,
  lang: null,
  minRating: null,
  minExperience: null,
  verified: false,
  sort: "recommended",
};

const FORMATS: readonly string[] = ["online", "offline", "hybrid"];
const SORTS: readonly string[] = ["recommended", "rating", "students", "experience"];
const CATEGORY_SLUGS: readonly string[] = categories.map((c) => c.slug);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parse + sanitize Next's raw searchParams into typed browse state.
 *
 * `allowed` carries the RUNTIME whitelists. Production pages pass the live
 * lists from `getPublicFacets()` (cities with published courses, languages
 * directory teachers actually teach in), so the whitelist can never reject a
 * real inventory value or bless a fixture-only one. Callers without a
 * database (pure helpers, tests) omit it and get the static product taxonomy
 * instead — never fixture inventory.
 */
export function parseTeacherBrowseParams(
  searchParams: Record<string, string | string[] | undefined>,
  allowed: { cities?: readonly string[]; languages?: readonly string[] } = {},
): TeacherBrowseParams {
  const rawSubject = (first(searchParams.subject) ?? "").toLowerCase();
  const rawCity = (first(searchParams.city) ?? "").toLowerCase();
  const rawLang = (first(searchParams.lang) ?? "").toUpperCase();
  const rawRating = first(searchParams.rating) ?? "";
  const rawExp = first(searchParams.exp) ?? "";
  const rawSort = first(searchParams.sort) ?? "";
  const allowedCities = allowed.cities ?? citySlugs;
  const allowedLanguages = allowed.languages ?? languageTags;

  return {
    q: (first(searchParams.q) ?? "").trim().slice(0, 100),
    subject: CATEGORY_SLUGS.includes(rawSubject) ? rawSubject : null,
    format: FORMATS.includes(first(searchParams.format) ?? "")
      ? (first(searchParams.format) as TeacherBrowseParams["format"])
      : null,
    city: allowedCities.includes(rawCity) ? rawCity : null,
    lang: allowedLanguages.includes(rawLang) ? rawLang : null,
    minRating: teacherRatingFilters.find((f) => f.value === rawRating)?.min ?? null,
    minExperience:
      teacherExperienceFilters.find((f) => f.value === rawExp)?.min ?? null,
    verified: first(searchParams.verified) === "1",
    sort: SORTS.includes(rawSort) ? (rawSort as TeacherSortKey) : "recommended",
  };
}

/** Defaults omitted → `/teachers` is canonical, `/teachers?rating=4.5…` shareable. */
export function serializeTeacherParams(
  params: Partial<TeacherBrowseParams>,
): string {
  const parts: string[] = [];
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.subject) parts.push(`subject=${params.subject}`);
  if (params.format) parts.push(`format=${params.format}`);
  if (params.city) parts.push(`city=${params.city}`);
  if (params.lang) parts.push(`lang=${params.lang.toLowerCase()}`);
  // `!= null` (not `!== null`): partial objects must not leak “undefined”.
  if (params.minRating != null) parts.push(`rating=${String(params.minRating)}`);
  if (params.minExperience != null) parts.push(`exp=${String(params.minExperience)}`);
  if (params.verified) parts.push("verified=1");
  if (params.sort && params.sort !== "recommended") parts.push(`sort=${params.sort}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function buildTeacherHref(
  basePath: string,
  params: Partial<TeacherBrowseParams>,
): string {
  return `${basePath}${serializeTeacherParams(params)}`;
}

/** True when any filter (besides sort) is active — drives chips/clear UI. */
export function hasActiveTeacherFilters(params: TeacherBrowseParams): boolean {
  return (
    params.q !== "" ||
    params.subject !== null ||
    params.format !== null ||
    params.city !== null ||
    params.lang !== null ||
    params.minRating !== null ||
    params.minExperience !== null ||
    params.verified
  );
}

/* -------------------------------------------------------------------------- */
/* Matching + sorting                                                          */
/* -------------------------------------------------------------------------- */

function haystack(row: TeacherRow): string {
  const { teacher } = row;
  return normalizeForMatch(
    [
      teacher.name,
      teacher.specialization,
      teacher.bio,
      teacher.languages.join(" "),
      row.categoryNames.join(" "),
      row.cities.join(" "),
    ].join(" "),
  );
}

/**
 * Deterministic sorters; “recommended” = the curated registry order.
 * Every comparator tie-breaks on `id` (stable and shareable), so results
 * never shuffle between renders or requests.
 */
const sorters: Record<TeacherSortKey, (a: TeacherRow, b: TeacherRow) => number> = {
  recommended: () => 0,
  rating: (a, b) =>
    b.teacher.rating - a.teacher.rating ||
    b.teacher.reviews - a.teacher.reviews ||
    a.teacher.id.localeCompare(b.teacher.id),
  students: (a, b) =>
    b.teacher.students - a.teacher.students ||
    a.teacher.id.localeCompare(b.teacher.id),
  experience: (a, b) =>
    b.teacher.experienceYears - a.teacher.experienceYears ||
    b.teacher.rating - a.teacher.rating ||
    a.teacher.id.localeCompare(b.teacher.id),
};

export function applyTeacherBrowse(
  source: TeacherRow[],
  params: TeacherBrowseParams,
): TeacherRow[] {
  const needle = normalizeForMatch(params.q);
  const filtered = source.filter((row) => {
    const { teacher } = row;
    if (params.subject && !row.categorySlugs.includes(params.subject)) return false;
    if (params.format && !row.formats.includes(params.format)) return false;
    if (params.city && !row.cities.includes(params.city)) return false;
    if (params.lang && !teacher.languages.includes(params.lang)) return false;
    if (params.minRating !== null && teacher.rating < params.minRating) return false;
    if (params.minExperience !== null && teacher.experienceYears < params.minExperience)
      return false;
    if (params.verified && !teacher.verified) return false;
    if (needle && !haystack(row).includes(needle)) return false;
    return true;
  });
  return params.sort === "recommended"
    ? filtered
    : [...filtered].sort(sorters[params.sort]);
}
