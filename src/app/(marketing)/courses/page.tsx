import type { Metadata } from "next";
import { CoursesBrowser } from "@/components/courses/courses-browser";
import { coursesPage } from "@/data/site";
import { parseCourseBrowseParams } from "@/lib/course-search";
import { listPublicCourses } from "@/server/public-repo";

/* -------------------------------------------------------------------------- */
/* /courses — the results engine (Phase 3 UX, Phase 12 data source).             */
/*                                                                                */
/* Reads come from PostgreSQL via listPublicCourses(), which pushes every         */
/* SQL-expressible facet (status, format, level, schedule, city, price, rating)   */
/* and the ordering into the query. Only published courses are ever selected —    */
/* drafts are excluded in SQL, not in the UI.                                     */
/*                                                                                */
/* RENDERING: dynamic SSR. Results depend on the URL AND on live database state   */
/* (a teacher can publish at any time), so a build-time snapshot would go stale.  */
/*                                                                                */
/* URL remains the only client-visible state and the browser component is         */
/* unchanged, so the approved Phase 3 behaviour is preserved exactly.             */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { q } = parseCourseBrowseParams(await searchParams);
  return {
    title: q ? `Kurslar: “${q}”` : coursesPage.title,
    description: coursesPage.intro,
  };
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseCourseBrowseParams(await searchParams);
  const source = await listPublicCourses(params);

  return (
    <CoursesBrowser
      basePath="/courses"
      eyebrow="Katalog"
      title={coursesPage.title}
      description={coursesPage.intro}
      source={source}
      params={params}
      activeCategorySlug={null}
    />
  );
}
