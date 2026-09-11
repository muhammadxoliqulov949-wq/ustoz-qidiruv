"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui";
import { teachersPage } from "@/data/site";
import {
  buildTeacherHref,
  parseTeacherBrowseParams,
} from "@/lib/teacher-search";

/* -------------------------------------------------------------------------- */
/* /teachers search field — same pattern as CoursesSearch: seeded from the URL, */
/* keyed by q by the parent so back/forward remounts it, submit preserves the    */
/* active facet params (URL is the only state).                                  */
/* -------------------------------------------------------------------------- */

export interface TeachersSearchProps {
  basePath: string;
  initialQuery: string;
}

export function TeachersSearch({ basePath, initialQuery }: TeachersSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const submit = (value: string) => {
    const current = parseTeacherBrowseParams(
      Object.fromEntries(searchParams.entries()),
    );
    router.push(buildTeacherHref(basePath, { ...current, q: value.trim() }));
  };

  return (
    <SearchInput
      size="lg"
      label={teachersPage.searchLabel}
      placeholder={teachersPage.searchPlaceholder}
      value={query}
      onValueChange={setQuery}
      onSubmit={submit}
    />
  );
}
