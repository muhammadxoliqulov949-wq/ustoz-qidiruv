import { categories } from "./categories";
import {
  cityLabel,
  courseCities,
  courseFormatLabels,
  courseLevelLabels,
} from "./courses";
import { LANGUAGE_LABELS, onboardingLanguages } from "@/lib/onboarding";
import type { CourseFormat, CourseLevel } from "./models";

/* -------------------------------------------------------------------------- */
/* Course-authoring taxonomies — Phase 10.                                     */
/*                                                                              */
/* DERIVED, never a new taxonomy: categories come from categories.ts, levels    */
/* and formats from the canonical label maps in courses.ts, cities from the      */
/* catalog's own city facet, languages from the onboarding language list        */
/* (itself derived from teachers.ts). If a new category ships tomorrow the      */
/* course editor offers it with no edit here. Options are plain {value,label}   */
/* pairs so the client islands never import a dataset.                          */
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

export const authoringCityOptions: AuthoringOption[] = courseCities.map((city) => ({
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
