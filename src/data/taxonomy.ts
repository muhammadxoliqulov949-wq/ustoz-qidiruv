/**
 * STATIC PRODUCT TAXONOMY — city slugs and teaching-language tags.
 *
 * Phase 20: this module is the ONLY static vocabulary for “which cities” and
 * “which languages” the product knows. It is vocabulary, not inventory:
 *
 *   • address/option lists (onboarding selects, the course authoring forms,
 *     the server write-validation whitelists) read from here, because a city
 *     a teacher may pick is a product decision, not a marketplace record;
 *   • browse FILTER OPTIONS (“which cities currently have published courses”,
 *     “which languages directory teachers teach in”) are inventory and MUST
 *     come from the database at request time via `getPublicFacets()`
 *     (src/server/public-repo.ts) — never from this file;
 *   • the browse URL parsers (lib/course-search.ts, lib/teacher-search.ts)
 *     accept a runtime allow-list from the page; this taxonomy is only their
 *     static fallback for callers that have no database (tests, pure helpers).
 *
 * Before Phase 20 these lists were DERIVED from the fixture arrays
 * (`courseCities`, `teacherCities`, `teacherLanguages`), which meant a form
 * vocabulary silently depended on seed inventory. Those derived exports are
 * deleted; the values below preserve their exact membership and order so no
 * form, validator or seeded row changes meaning.
 */

/** City slugs the product accepts in address/city fields (lowercase, stable). */
export const citySlugs: string[] = [
  "andijon",
  "buxoro",
  "fargona",
  "samarqand",
  "toshkent",
];

/** Teaching-language tags the product accepts (ISO 639-1, upper-cased). */
export const languageTags: string[] = ["UZ", "EN", "RU", "AR"];
