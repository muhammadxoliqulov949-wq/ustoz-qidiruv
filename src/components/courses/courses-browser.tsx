import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { ButtonLink, Card, CourseCard } from "@/components/ui";
import { categories } from "@/data/categories";
import { coursesPage } from "@/data/site";
import { formatCount } from "@/lib/format";
import { applyCourseBrowse, type CourseBrowseParams } from "@/lib/course-search";
import type { Course } from "@/data/models";
import { BrowseToolbar } from "./browse-toolbar";
import { CoursesSearch } from "./courses-search";

/* -------------------------------------------------------------------------- */
/* CoursesBrowser — the canonical results screen: page header, search,           */
/* toolbar, result count, card grid, empty state. Composed by BOTH               */
/* /courses (whole catalog) and /categories/[slug] (category-scoped source) —    */
/* the routes only differ in data they feed and the heading they show.           */
/* Everything here is server-rendered; stateful behavior lives in two small      */
/* islands (search field, URL selects).                                         */
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
  breadcrumb,
}: CoursesBrowserProps) {
  const results = applyCourseBrowse(
    source,
    params,
    (id) => categoryNameById.get(id) ?? "",
  );

  return (
    <div className="site-container flex flex-col gap-8 pb-18 pt-14 md:gap-10 md:pb-26 md:pt-18">
      {/* Page opener */}
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
      </div>

      <div className="max-w-2xl">
        {/* Remount when the URL query changes (e.g. browser back) so the
            field always mirrors the canonical state. */}
        <CoursesSearch
          key={params.q}
          basePath={basePath}
          initialQuery={params.q}
        />
      </div>

      <BrowseToolbar
        basePath={basePath}
        params={params}
        activeCategorySlug={activeCategorySlug}
      />

      {results.length > 0 ? (
        <>
          <p className="text-base text-ink-500" aria-live="polite">
            {params.q ? (
              <>
                “{params.q}” so‘rovi bo‘yicha{" "}
                <strong className="font-semibold text-ink-900">
                  {formatCount(results.length)}
                </strong>{" "}
                ta kurs topildi
              </>
            ) : (
              <>
                <strong className="font-semibold text-ink-900">
                  {formatCount(results.length)}
                </strong>{" "}
                ta kurs
              </>
            )}
          </p>

          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {results.map((course) => (
              <li key={course.id} className="flex">
                <CourseCard course={course} className="w-full" />
              </li>
            ))}
          </ul>
        </>
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
            {coursesPage.empty.title}
          </h2>
          <p className="max-w-md text-base text-pretty text-ink-500">
            {coursesPage.empty.text}
          </p>
          <ButtonLink href={basePath} variant="outline" size="sm">
            {coursesPage.clearFilters}
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
