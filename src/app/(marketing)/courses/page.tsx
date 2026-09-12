import type { Metadata } from "next";
import { CoursesBrowser } from "@/components/courses/courses-browser";
import { courses } from "@/data/courses";
import { coursesPage } from "@/data/site";
import { parseCourseBrowseParams } from "@/lib/course-search";

/* -------------------------------------------------------------------------- */
/* /courses — the results engine over the whole mock catalog (Phase 3).          */
/* URL is the only state: q / mode / price=free / city / sort                     */
/* (contract in lib/course-search.ts). Fully server-rendered except for two      */
/* islands inside CoursesBrowser.                                                */
/* -------------------------------------------------------------------------- */

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

  return (
    <CoursesBrowser
      basePath="/courses"
      eyebrow="Katalog"
      title={coursesPage.title}
      description={coursesPage.intro}
      source={courses}
      params={params}
      activeCategorySlug={null}
    />
  );
}
