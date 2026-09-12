import type { Metadata } from "next";
import { TeachersBrowser } from "@/components/teachers/teachers-browser";
import { teacherCities, teacherLanguages, teacherRows } from "@/data/teacher-rows";
import { teachersPage } from "@/data/site";
import { parseTeacherBrowseParams } from "@/lib/teacher-search";

/* -------------------------------------------------------------------------- */
/* /teachers — teacher discovery (Phase 5). The URL is the only state:            */
/* q / subject / format / city / lang / rating / exp / verified / sort,           */
/* parsed and serialized by the pure engine in lib/teacher-search.ts.            */
/* Rows and facet options are derived from the canonical teachers+courses data   */
/* (data/teacher-rows.ts) — nothing here can contradict the catalog.              */
/* -------------------------------------------------------------------------- */

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
  const params = parseTeacherBrowseParams(await searchParams);

  return (
    <TeachersBrowser
      basePath="/teachers"
      source={teacherRows}
      params={params}
      cities={teacherCities}
      languages={teacherLanguages}
    />
  );
}
