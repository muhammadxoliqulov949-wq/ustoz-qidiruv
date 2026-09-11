"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui";
import { coursesPage } from "@/data/site";
import {
  buildBrowseHref,
  parseCourseBrowseParams,
} from "@/lib/course-search";

/* -------------------------------------------------------------------------- */
/* Results-page search field (lg). Seeded from the URL (server passes the       */
/* parsed q; pages key this component by q so back/forward resets it), and      */
/* submit preserves the active facet params — the URL is still the only          */
/* source of truth (lib/course-search.ts).                                      */
/* -------------------------------------------------------------------------- */

export interface CoursesSearchProps {
  /** Route the query belongs to: /courses or /categories/<slug>. */
  basePath: string;
  initialQuery: string;
}

export function CoursesSearch({ basePath, initialQuery }: CoursesSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const submit = (value: string) => {
    const current = parseCourseBrowseParams(
      Object.fromEntries(searchParams.entries()),
    );
    router.push(buildBrowseHref(basePath, { ...current, q: value.trim() }));
  };

  return (
    <SearchInput
      size="lg"
      label={coursesPage.searchLabel}
      placeholder={coursesPage.searchPlaceholder}
      value={query}
      onValueChange={setQuery}
      onSubmit={submit}
    />
  );
}
