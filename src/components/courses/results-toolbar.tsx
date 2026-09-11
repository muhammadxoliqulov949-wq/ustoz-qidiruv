import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Pill } from "@/components/ui";
import {
  courseFormatLabels,
  courseLevelLabels,
  courseScheduleLabels,
  cityLabel,
} from "@/data/courses";
import { coursesPage } from "@/data/site";
import { formatCount } from "@/lib/format";
import {
  buildBrowseHref,
  type CourseBrowseParams,
} from "@/lib/course-search";
import { UrlSelect } from "./url-select";

/* -------------------------------------------------------------------------- */
/* Results toolbar — count line (real filtered count, never faked), removable   */
/* active-filter chips, and the compact controls.                                */
/*                                                                               */
/* Row order per spec: mobile gets  [Filtrlar][Saralash]  above the count;      */
/* desktop puts  Saralash  right of the count (filters live in the sidebar),    */
/* so exactly one sort control is visible at any width (media-hidden, same URL    */
/* state — both read the param, no duplicated client state).                     */
/* Chips are links that drop exactly ONE param: every active facet stays          */
/* individually visible and individually dismissable.                            */
/* -------------------------------------------------------------------------- */

export interface ActiveChip {
  label: string;
  href: string;
}

export function activeChipList(
  basePath: string,
  params: CourseBrowseParams,
): ActiveChip[] {
  const drop = (over: Partial<CourseBrowseParams>) =>
    buildBrowseHref(basePath, { ...params, ...over });
  const chips: ActiveChip[] = [];
  if (params.q) chips.push({ label: `“${params.q}”`, href: drop({ q: "" }) });
  if (params.format)
    chips.push({
      label: courseFormatLabels[params.format],
      href: drop({ format: null }),
    });
  if (params.level)
    chips.push({
      label: courseLevelLabels[params.level],
      href: drop({ level: null }),
    });
  if (params.city)
    chips.push({ label: cityLabel(params.city), href: drop({ city: null }) });
  if (params.price)
    chips.push({
      label:
        params.price === "free"
          ? coursesPage.priceOptions.free
          : coursesPage.priceOptions.paid,
      href: drop({ price: null }),
    });
  if (params.priceMin !== null || params.priceMax !== null) {
    const label =
      params.priceMin !== null && params.priceMax !== null
        ? `${formatCount(params.priceMin)}–${formatCount(params.priceMax)} ${coursesPage.range.unit}`
        : params.priceMin !== null
          ? `≥ ${formatCount(params.priceMin)} ${coursesPage.range.unit}`
          : `≤ ${formatCount(params.priceMax as number)} ${coursesPage.range.unit}`;
    chips.push({ label, href: drop({ priceMin: null, priceMax: null }) });
  }
  if (params.schedule)
    chips.push({
      label: courseScheduleLabels[params.schedule],
      href: drop({ schedule: null }),
    });
  if (params.minRating !== null)
    chips.push({
      label: `${params.minRating.toFixed(1)}+`,
      href: drop({ minRating: null }),
    });
  return chips;
}

export interface ResultsToolbarProps {
  basePath: string;
  params: CourseBrowseParams;
  resultCount: number;
  chips: ActiveChip[];
  /** Rendered slot: the mobile filter-sheet trigger (client island). */
  sheetTrigger: ReactNode;
}

export function ResultsToolbar({
  basePath,
  params,
  resultCount,
  chips,
  sheetTrigger,
}: ResultsToolbarProps) {
  const sortSelect = (
    <UrlSelect
      label={coursesPage.sortLabel}
      paramName="sort"
      defaultValue="recommended"
      basePath={basePath}
      replace
      options={Object.entries(coursesPage.sorts).map(([value, label]) => ({
        value,
        label,
      }))}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile/tablet control row (spec §7) */}
      <div className="flex items-center gap-2 lg:hidden">
        {sheetTrigger}
        {sortSelect}
      </div>

      {/* Result count (+ sort at desktop) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p aria-live="polite" className="text-base text-ink-500">
          {params.q ? (
            <>
              “{params.q}” bo‘yicha{" "}
              <strong className="font-semibold text-ink-900">
                {formatCount(resultCount)}
              </strong>{" "}
              {coursesPage.resultsWord}
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink-900">
                {formatCount(resultCount)}
              </strong>{" "}
              {coursesPage.resultsWord}
            </>
          )}
        </p>
        <div className="ml-auto max-lg:hidden">{sortSelect}</div>
      </div>

      {chips.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={coursesPage.filtersWord}
        >
          <span className="text-sm font-medium text-ink-500">
            {coursesPage.filtersWord}
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
  );
}
