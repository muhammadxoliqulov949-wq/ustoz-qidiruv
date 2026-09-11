import { X } from "lucide-react";
import { Pill } from "@/components/ui";
import { categories } from "@/data/categories";
import { courseCities, courseFormatLabels, cityLabel } from "@/data/courses";
import { coursesPage } from "@/data/site";
import {
  buildBrowseHref,
  serializeBrowseParams,
  type CourseBrowseParams,
  type CourseSortKey,
} from "@/lib/course-search";
import { UrlSelect } from "./url-select";

/* -------------------------------------------------------------------------- */
/* Browse toolbar — the whole results page filter UI, server-rendered as         */
/* plain links. Selection/removal = re-serialization of the typed params         */
/* (lib/course-search.ts), so no client JS is needed to filter; only the          */
/* search field and the two selects are islands.                                 */
/* Rows: category navigation · mode + price facets + city/sort selects ·         */
/* removable chips for facets with no pill representation (q, city).             */
/* -------------------------------------------------------------------------- */

const MODE_OPTIONS = ["online", "offline", "hybrid"] as const;

const SORT_KEYS: CourseSortKey[] = [
  "recommended",
  "rating",
  "popular",
  "price-asc",
  "price-desc",
];

export interface BrowseToolbarProps {
  /** Route the query belongs to (params are rewritten against it). */
  basePath: string;
  params: CourseBrowseParams;
  /** Slug when we are on /categories/<slug>; null on /courses. */
  activeCategorySlug: string | null;
}

export function BrowseToolbar({
  basePath,
  params,
  activeCategorySlug,
}: BrowseToolbarProps) {
  /** Same route, one facet overridden — “selected” pills link to their own
   *  removal (clicking the active pill again resets that facet). */
  const href = (over: Partial<CourseBrowseParams>) =>
    buildBrowseHref(basePath, { ...params, ...over });

  const hasChips = params.q !== "" || params.city !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Category navigation — routes, not params (a category is a place) */}
      <div
        role="group"
        aria-label="Kategoriya bo‘yicha"
        className="flex flex-wrap items-center gap-2"
      >
        <Pill
          as="link"
          href={`/courses${serializeBrowseParams(params)}`}
          selected={activeCategorySlug === null}
        >
          Barcha kurslar
        </Pill>
        {categories.map((category) => (
          <Pill
            key={category.id}
            as="link"
            href={buildBrowseHref(`/categories/${category.slug}`, params)}
            selected={activeCategorySlug === category.slug}
          >
            {category.name}
          </Pill>
        ))}
      </div>

      {/* Facet row: format pills + free toggle, selects on the right */}
      <div className="flex flex-wrap items-center gap-2">
        <Pill as="link" href={href({ mode: null })} selected={params.mode === null}>
          {coursesPage.anyMode}
        </Pill>
        {MODE_OPTIONS.map((mode) => (
          <Pill
            key={mode}
            as="link"
            href={href({ mode: params.mode === mode ? null : mode })}
            selected={params.mode === mode}
          >
            {courseFormatLabels[mode]}
          </Pill>
        ))}
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line md:block" />
        <Pill
          as="link"
          href={href({ freeOnly: !params.freeOnly })}
          selected={params.freeOnly}
        >
          {coursesPage.freeOnly}
        </Pill>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <UrlSelect
            label={coursesPage.cityLabel}
            paramName="city"
            defaultValue=""
            basePath={basePath}
            options={[
              { value: "", label: coursesPage.anyCity },
              ...courseCities.map((city) => ({
                value: city,
                label: cityLabel(city),
              })),
            ]}
          />
          <UrlSelect
            label={coursesPage.sortLabel}
            paramName="sort"
            defaultValue="recommended"
            basePath={basePath}
            options={SORT_KEYS.map((sort) => ({
              value: sort,
              label: coursesPage.sorts[sort],
            }))}
          />
        </div>
      </div>

      {/* Removable chips for facets that have no visible pill state */}
      {hasChips ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={coursesPage.filtersWord}
        >
          <span className="text-sm font-medium text-ink-500">
            {coursesPage.filtersWord}
          </span>
          {params.q ? (
            <Pill
              as="link"
              href={href({ q: "" })}
              leadingIcon={<X className="size-3.5" />}
              aria-label={`Qidiruvni tozalash: ${params.q}`}
            >
              “{params.q}”
            </Pill>
          ) : null}
          {params.city ? (
            <Pill
              as="link"
              href={href({ city: null })}
              leadingIcon={<X className="size-3.5" />}
              aria-label={`Shahar filtrini olib tashlash: ${cityLabel(params.city)}`}
            >
              {cityLabel(params.city)}
            </Pill>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
