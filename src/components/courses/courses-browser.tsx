import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { ButtonLink, Card, CourseCard } from "@/components/ui";
import { categories } from "@/data/categories";
import {
  cityLabel,
  courseFormatLabels,
  courseLevelLabels,
  courseRatingFilters,
  courseScheduleLabels,
} from "@/data/courses";
import { coursesPage } from "@/data/site";
import {
  applyCourseBrowse,
  buildBrowseHref,
  hasActiveFilters,
  serializeBrowseParams,
  type CourseBrowseParams,
} from "@/lib/course-search";
import type { Course } from "@/data/models";
import { FilterPanel, type FilterOptionData, type FilterSectionData } from "./filter-panel";
import { FilterSheet } from "./filter-sheet";
import { activeChipList, ResultsToolbar } from "./results-toolbar";
import { CoursesSearch } from "./courses-search";

/* -------------------------------------------------------------------------- */
/* CoursesBrowser — the canonical results screen per the Phase 3 spec:           */
/*   desktop: 264px sticky filter sidebar + results column (count/sort/chips/    */
/*            grid);  mobile/tablet: [Filtrlar][Saralash] over the count, with   */
/*            the same sections inside a bottom sheet.                           */
/* Composed by BOTH /courses (whole catalog) and /categories/[slug] (scoped     */
/* source + locked category) — routes only differ in data and heading.          */
/*                                                                               */
/* Presentation here is pure server rendering; the only interactivity is the    */
/* FilterPanel island (sidebar+sheet) and the search/select islands. The        */
/* sections below are DESCRIPTORS (label/href/selected) — the URL contract in    */
/* lib/course-search.ts stays the single source of truth.                       */
/* -------------------------------------------------------------------------- */

const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

export interface CoursesBrowserProps {
  /** Route the query belongs to: /courses or /categories/<slug>. */
  basePath: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /** Scoped candidate list (already narrowed by category when relevant). */
  source: Course[];
  params: CourseBrowseParams;
  activeCategorySlug: string | null;
  /** City facet options — runtime inventory from `getPublicFacets()`, so the
   *  sidebar never offers a city no published course teaches in. */
  cities: string[];
  /** Optional breadcrumb slot rendered above the eyebrow (page furniture). */
  breadcrumb?: ReactNode;
}

export function CoursesBrowser({
  basePath,
  eyebrow,
  title,
  description,
  source,
  params,
  activeCategorySlug,
  cities,
  breadcrumb,
}: CoursesBrowserProps) {
  const results = applyCourseBrowse(
    source,
    params,
    (id) => categoryNameById.get(id) ?? "",
  );
  const chips = activeChipList(basePath, params);
  const filtersActive = hasActiveFilters(params);

  /** Facet link builder: selecting sets the param, tapping the active one
   *  clears it — no “Barchasi” clutter on every list. */
  const toggle = (
    label: string,
    active: boolean,
    set: Partial<CourseBrowseParams>,
  ): FilterOptionData => ({
    label,
    selected: active,
    href: buildBrowseHref(basePath, {
      ...params,
      ...(active ? Object.fromEntries(Object.keys(set).map((k) => [k, null])) : set),
    }),
  });

  const allSections: FilterSectionData[] = [
    {
      key: "category",
      title: coursesPage.sections.category,
      options: [
        {
          label: "Barcha kurslar",
          selected: activeCategorySlug === null,
          href: `/courses${serializeBrowseParams(params)}`,
          push: true, // cross-route navigation keeps history entries
        },
        ...categories.map((category) => ({
          label: category.name,
          selected: activeCategorySlug === category.slug,
          href: buildBrowseHref(`/categories/${category.slug}`, params),
          push: true,
        })),
      ],
    },
    {
      key: "format",
      title: coursesPage.sections.format,
      options: (["online", "offline", "hybrid"] as const).map((value) =>
        toggle(courseFormatLabels[value], params.format === value, { format: value }),
      ),
    },
    {
      key: "level",
      title: coursesPage.sections.level,
      options: (["boshlangich", "orta", "yuqori"] as const).map((value) =>
        toggle(courseLevelLabels[value], params.level === value, { level: value }),
      ),
    },
    {
      key: "city",
      title: coursesPage.sections.city,
      options: cities.map((city) =>
        toggle(cityLabel(city), params.city === city, { city }),
      ),
    },
    {
      key: "price",
      title: coursesPage.sections.price,
      options: [
        toggle(coursesPage.priceOptions.free, params.price === "free", { price: "free" }),
        toggle(coursesPage.priceOptions.paid, params.price === "paid", { price: "paid" }),
      ],
    },
    {
      key: "schedule",
      title: coursesPage.sections.schedule,
      options: (["morning", "day", "evening"] as const).map((value) =>
        toggle(courseScheduleLabels[value], params.schedule === value, { schedule: value }),
      ),
    },
    {
      key: "rating",
      title: coursesPage.sections.rating,
      options: courseRatingFilters.map((filter) =>
        toggle(filter.label, params.minRating === filter.min, { minRating: filter.min }),
      ),
    },
  ];

  /* Inventory-driven sections with no runtime options (e.g. no city has a
   * published course yet) are omitted entirely — a bare heading would imply
   * choices that do not exist. The price section always stays: it carries the
   * range form, not just pills. */
  const sections = allSections.filter(
    (section) => section.key === "price" || section.options.length > 0,
  );

  const panelProps = {
    sections,
    basePath,
    priceMin: params.priceMin !== null ? String(params.priceMin) : "",
    priceMax: params.priceMax !== null ? String(params.priceMax) : "",
    hasActiveFilters: filtersActive,
    clearHref: basePath,
  };

  return (
    <div className="site-container flex flex-col gap-8 pb-18 pt-14 md:gap-10 md:pb-26 md:pt-18">
      {/* Page opener + search */}
      <div className="flex flex-col gap-2">
        {breadcrumb}
        {eyebrow ? (
          <p className="text-sm font-semibold tracking-[0.08em] text-accent-600 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance text-ink-900 md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base text-pretty text-ink-500 md:text-lg">
            {description}
          </p>
        ) : null}
        <div className="mt-4 max-w-2xl">
          {/* Remount when the URL query changes (back/forward) so the field
              always mirrors canonical state. */}
          <CoursesSearch
            key={params.q}
            basePath={basePath}
            initialQuery={params.q}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
        {/* Desktop filter sidebar — solid surface, sticky; capped to the
            viewport so a tall panel scrolls internally instead of pinning
            against the row bottom and scrolling out of view. */}
        <aside
          aria-label={coursesPage.filtersWord}
          className="hidden lg:sticky lg:top-[calc(var(--height-header)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--height-header)-3rem)] lg:self-start lg:overflow-y-auto"
        >
          <FilterPanel {...panelProps} variant="sidebar" />
        </aside>

        {/* Results column */}
        <div className="flex min-w-0 flex-col gap-5">
          <ResultsToolbar
            basePath={basePath}
            params={params}
            resultCount={results.length}
            chips={chips}
            sheetTrigger={
              <FilterSheet
                {...panelProps}
                resultCount={results.length}
                activeCount={chips.length}
              />
            }
          />

          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((course) => (
                <li key={course.id} className="flex">
                  <CourseCard course={course} className="w-full" />
                </li>
              ))}
            </ul>
          ) : (
            /* Empty state (spec §8) — never a dead grid */
            <Card
              variant="quiet"
              className="flex flex-col items-center gap-4 px-6 py-16 text-center"
            >
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-pill bg-surface text-ink-400 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]"
              >
                <SearchX />
              </span>
              <h2 className="text-2xl font-semibold tracking-[-0.01em] text-ink-900">
                {coursesPage.empty.title}
              </h2>
              <p className="max-w-md text-base text-pretty text-ink-500">
                {coursesPage.empty.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <ButtonLink href={basePath} variant="outline" size="sm">
                  {coursesPage.clearFilters}
                </ButtonLink>
                {params.q ? (
                  <ButtonLink
                    href={buildBrowseHref(basePath, { ...params, q: "" })}
                    variant="ghost"
                    size="sm"
                  >
                    {coursesPage.empty.clearSearch}
                  </ButtonLink>
                ) : null}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
