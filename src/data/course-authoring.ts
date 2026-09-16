import { categories } from "./categories";
import { cityLabel, courseFormatLabels, courseLevelLabels } from "./courses";
import { citySlugs } from "./taxonomy";
import { LANGUAGE_LABELS, onboardingLanguages } from "@/lib/onboarding";
import type { CourseFormat, CourseLevel } from "./models";

/* -------------------------------------------------------------------------- */
/* Course-authoring taxonomies — STATIC vocabulary, safe for runtime use.       */
/*                                                                              */
/* Categories come from categories.ts, levels and formats from the static label */
/* maps in courses.ts, cities and languages from the static product taxonomy    */
/* (taxonomy.ts via lib/onboarding.ts). Nothing here is derived from fixture    */
/* inventory any more (Phase 20 deleted the courseCities dependency): a city a  */
/* teacher may pick for a new course is an address option, not a record that    */
/* must already exist in the catalogue. Options are plain {value,label} pairs   */
/* so the client islands never import a dataset.                                */
/* -------------------------------------------------------------------------- */

export interface AuthoringOption {
  value: string;
  label: string;
}

export const authoringCategoryOptions: AuthoringOption[] = categories.map(
  (category) => ({ value: category.id, label: category.name }),
);

export const authoringLevelOptions: AuthoringOption[] = (
  ["boshlangich", "orta", "yuqori"] satisfies CourseLevel[]
).map((level) => ({ value: level, label: courseLevelLabels[level] }));

export const authoringFormatOptions: AuthoringOption[] = (
  ["online", "offline", "hybrid"] satisfies CourseFormat[]
).map((format) => ({ value: format, label: courseFormatLabels[format] }));

export const authoringCityOptions: AuthoringOption[] = citySlugs.map((city) => ({
  value: city,
  label: cityLabel(city),
}));

export const authoringLanguageOptions: AuthoringOption[] = onboardingLanguages.map(
  (tag) => ({ value: tag, label: LANGUAGE_LABELS[tag] ?? tag }),
);

/** One bundle passed to the editor island — a single serializable prop. */
export interface CourseAuthoringOptions {
  categories: AuthoringOption[];
  levels: AuthoringOption[];
  formats: AuthoringOption[];
  cities: AuthoringOption[];
  languages: AuthoringOption[];
}

export const courseAuthoringOptions: CourseAuthoringOptions = {
  categories: authoringCategoryOptions,
  levels: authoringLevelOptions,
  formats: authoringFormatOptions,
  cities: authoringCityOptions,
  languages: authoringLanguageOptions,
};

export function authoringLabel(
  options: AuthoringOption[],
  value: string | null,
): string | null {
  if (value === null) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}
