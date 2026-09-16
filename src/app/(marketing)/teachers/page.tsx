import type { Metadata } from "next";
import { TeachersBrowser } from "@/components/teachers/teachers-browser";
import { listPublicTeachers, getPublicFacets } from "@/server/public-repo";
import { teachersPage } from "@/data/site";
import { parseTeacherBrowseParams } from "@/lib/teacher-search";

/* -------------------------------------------------------------------------- */
/* /teachers — teacher discovery (Phase 5). The URL is the only state:            */
/* q / subject / format / city / lang / rating / exp / verified / sort,           */
/* parsed and serialized by the pure engine in lib/teacher-search.ts.            */
/* Phase 12: rows and facet options are derived IN THE DATABASE from teachers    */
/* who are public AND own at least one published course, so the directory can    */
/* never advertise a profile whose courses do not exist. Verification reflects    */
/* the stored value only — no approval workflow exists, so seeded teachers stay   */
/* honestly unverified.                                                           */
/*                                                                                */
/* RENDERING: dynamic SSR — the roster changes whenever a course is published.    */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: teachersPage.title,
  description: teachersPage.intro,
  alternates: { canonical: "/teachers" },
};

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Phase 20: parse the URL against the RUNTIME city/language lists, so the
  // whitelist can never reject a real inventory value or bless a fixture-only
  // one. Facets first, then params, then rows.
  const raw = await searchParams;
  const facets = await getPublicFacets();
  const params = parseTeacherBrowseParams(raw, {
    cities: facets.cities,
    languages: facets.languages,
  });
  const source = await listPublicTeachers();

  return (
    <TeachersBrowser
      basePath="/teachers"
      source={source}
      params={params}
      cities={facets.cities}
      languages={facets.languages}
    />
  );
}
