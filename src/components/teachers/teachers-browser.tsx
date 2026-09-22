import { SearchX, X } from "lucide-react";
import { ButtonLink, Card, Pill } from "@/components/ui";
import { UrlSelect } from "@/components/courses/url-select";
import { categories } from "@/data/categories";
import { cityLabel, courseFormatLabels } from "@/data/courses";
import { teachersPage } from "@/data/site";
import {
  teacherExperienceFilters,
  teacherRatingFilters,
  type TeacherRow,
} from "@/data/teacher-rows";
import {
  applyTeacherBrowse,
  buildTeacherHref,
  hasActiveTeacherFilters,
  type TeacherBrowseParams,
} from "@/lib/teacher-search";
import { formatCount } from "@/lib/format";
import { TeacherBrowseCard } from "./teacher-browse-card";
import {
  TeacherFilterPanel,
  type TeacherFilterSection,
} from "./teacher-filter-panel";
import { TeacherFilterSheet } from "./teacher-filter-sheet";
import { TeachersSearch } from "./teachers-search";

/* -------------------------------------------------------------------------- */
/* TeachersBrowser — /teachers results screen (Phase 5), composed with the       */
/* exact Phase 3 architecture: 264px sticky sidebar + results column on           */
/* desktop, [Filtrlar][Saralash] + bottom sheet on mobile, real filtered count,   */
/* removable active chips. Presentation is server-rendered; the only client       */
/* islands are the filter panel/sheet and the search/select controls.            */
/*                                                                               */
/* Facet options are built here as descriptors (label/href/selected) from the     */
/* pure contract in lib/teacher-search.ts — the URL stays the single source.      */
/* -------------------------------------------------------------------------- */

const categoryNameBySlug = new Map(categories.map((c) => [c.slug, c.name]));

export interface TeachersBrowserProps {
  basePath: string;
  source: TeacherRow[];
  params: TeacherBrowseParams;
  /** Option universe for the city/lang facets — derived from ALL teachers so
   *  the sidebar never offers an empty option mid-filter (P3 convention). */
  cities: string[];
  languages: string[];
}

export function TeachersBrowser({
  basePath,
  source,
  params,
  cities,
  languages,
}: TeachersBrowserProps) {
  const results = applyTeacherBrowse(source, params);
  const filtersActive = hasActiveTeacherFilters(params);

  const toggle = (
    label: string,
    active: boolean,
    set: Partial<TeacherBrowseParams>,
  ) => ({
    label,
    selected: active,
    href: buildTeacherHref(basePath, {
      ...params,
      ...(active
        ? Object.fromEntries(Object.keys(set).map((k) => [k, null]))
        : set),
    }),
  });

  const allSections: TeacherFilterSection[] = [
    {
      key: "subject",
      title: teachersPage.sections.subject,
      options: categories.map((category) =>
        toggle(category.name, params.subject === category.slug, {
          subject: category.slug,
        }),
      ),
    },
    {
      key: "format",
      title: teachersPage.sections.format,
      options: (["online", "offline", "hybrid"] as const).map((value) =>
        toggle(courseFormatLabels[value], params.format === value, { format: value }),
      ),
    },
    {
      key: "city",
      title: teachersPage.sections.city,
      options: cities.map((city) =>
        toggle(cityLabel(city), params.city === city, { city }),
      ),
    },
    {
      key: "language",
      title: teachersPage.sections.language,
      options: languages.map((lang) =>
        toggle(lang, params.lang === lang, { lang }),
      ),
    },
    {
      key: "rating",
      title: teachersPage.sections.rating,
      options: teacherRatingFilters.map((filter) =>
        toggle(filter.label, params.minRating === filter.min, {
          minRating: filter.min,
        }),
      ),
    },
    {
      key: "experience",
      title: teachersPage.sections.experience,
      options: teacherExperienceFilters.map((filter) =>
        toggle(filter.label, params.minExperience === filter.min, {
          minExperience: filter.min,
        }),
      ),
    },
    {
      key: "verified",
      title: teachersPage.sections.verified,
      options: [
        toggle(teachersPage.verifiedOption, params.verified, { verified: true }),
      ],
    },
  ];

  /* Inventory-driven sections with no runtime options (no city / language in
   * the live directory yet) are omitted entirely — a bare heading would imply
   * choices that do not exist. */
  const sections = allSections.filter((section) => section.options.length > 0);

  /* chips — one per active filter; each drops exactly its own param */
  const drop = (over: Partial<TeacherBrowseParams>) =>
    buildTeacherHref(basePath, { ...params, ...over });
  const chips: { label: string; href: string }[] = [];
  if (params.q) chips.push({ label: `“${params.q}”`, href: drop({ q: "" }) });
  if (params.subject)
    chips.push({
      label: categoryNameBySlug.get(params.subject) ?? params.subject,
      href: drop({ subject: null }),
    });
  if (params.format)
    chips.push({
      label: courseFormatLabels[params.format],
      href: drop({ format: null }),
    });
  if (params.city)
    chips.push({ label: cityLabel(params.city), href: drop({ city: null }) });
  if (params.lang) chips.push({ label: params.lang, href: drop({ lang: null }) });
  if (params.minRating !== null)
    chips.push({
      label: `${params.minRating.toFixed(1)}+`,
      href: drop({ minRating: null }),
    });
  if (params.minExperience !== null)
    chips.push({
      label: `${params.minExperience}+ yil`,
      href: drop({ minExperience: null }),
    });
  if (params.verified)
    chips.push({
      label: teachersPage.verifiedOption,
      href: drop({ verified: false }),
    });

  const panelProps = {
    sections,
    hasActiveFilters: filtersActive,
    clearHref: basePath,
    variant: "sidebar" as const,
  };

  const sortSelect = (
    <UrlSelect
      label={teachersPage.sortLabel}
      paramName="sort"
      defaultValue="recommended"
      basePath={basePath}
      replace
      options={Object.entries(teachersPage.sorts).map(([value, label]) => ({
        value,
        label,
      }))}
    />
  );

  return (
    <div className="depth-canvas site-container flex flex-col gap-8 pb-18 pt-14 md:gap-10 md:pb-26 md:pt-18">
      {/* Page opener + search */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-[0.08em] text-accent-600 uppercase">
          Ustozlar bazasi
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance text-ink-900 md:text-5xl">
          {teachersPage.title}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-ink-500 md:text-lg">
          {teachersPage.intro}
        </p>
        <div className="mt-4 max-w-2xl">
          <TeachersSearch key={params.q} basePath={basePath} initialQuery={params.q} />
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
        {/* Desktop filter sidebar — solid surface, sticky, capped */}
        <aside
          aria-label={teachersPage.filtersWord}
          className="hidden lg:sticky lg:top-[calc(var(--height-header)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--height-header)-3rem)] lg:self-start lg:overflow-y-auto"
        >
          <TeacherFilterPanel {...panelProps} />
        </aside>

        {/* Results column */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            {/* Mobile/tablet control row */}
            <div className="flex items-center gap-2 lg:hidden">
              <TeacherFilterSheet
                {...panelProps}
                variant="sheet"
                resultCount={results.length}
                activeCount={chips.length}
              />
              {sortSelect}
            </div>

            {/* Result count (+ sort at desktop) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p aria-live="polite" className="text-base text-ink-500">
                {params.q ? (
                  <>
                    “{params.q}” bo‘yicha{" "}
                    <strong className="font-semibold text-ink-900">
                      {formatCount(results.length)}
                    </strong>{" "}
                    {teachersPage.resultsWord}
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-ink-900">
                      {formatCount(results.length)}
                    </strong>{" "}
                    {teachersPage.resultsWord}
                  </>
                )}
              </p>
              <div className="ml-auto max-lg:hidden">{sortSelect}</div>
            </div>

            {chips.length > 0 ? (
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={teachersPage.filtersWord}
              >
                <span className="text-sm font-medium text-ink-500">
                  {teachersPage.filtersWord}
                </span>
                {chips.map((chip) => (
                  <Pill
                    key={chip.label}
                    as="link"
                    href={chip.href}
                    leadingIcon={<X className="size-3.5" />}
                    aria-label={`Filtrlarni olib tashlash: ${chip.label}`}
                  >
                    {chip.label}
                  </Pill>
                ))}
              </div>
            ) : null}
          </div>

          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((row, index) => (
                <li key={row.teacher.id} className="flex">
                  {/* The first card is the page's LCP candidate (Phase 24). */}
                  <TeacherBrowseCard row={row} className="w-full" priority={index === 0} />
                </li>
              ))}
            </ul>
          ) : (
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
                {teachersPage.empty.title}
              </h2>
              <p className="max-w-md text-base text-pretty text-ink-500">
                {teachersPage.empty.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <ButtonLink href={basePath} variant="outline" size="sm">
                  {teachersPage.clearFilters}
                </ButtonLink>
                {params.q ? (
                  <ButtonLink
                    href={buildTeacherHref(basePath, { ...params, q: "" })}
                    variant="ghost"
                    size="sm"
                  >
                    {teachersPage.empty.clearSearch}
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
