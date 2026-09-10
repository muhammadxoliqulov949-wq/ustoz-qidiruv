"use client";

import { useCallback, useState } from "react";
import { SearchInput } from "@/components/ui";
import { hero, quickFilters } from "@/data/site";
import { QuickFilters } from "./quick-filters";

/* -------------------------------------------------------------------------- */
/* Client island of the hero: the search field + quick filter state.          */
/* Phase 1 captures intent locally. Phase 2 replaces the placeholder with     */
/* `router.push(/courses?q=…&filters…)` — this component is the seam.          */
/* -------------------------------------------------------------------------- */

export function HeroSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const toggleFilter = useCallback((id: string, next: boolean) => {
    setFilters((current) => {
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
  }, []);

  const submit = useCallback(
    (value: string) => {
      // TODO(Phase 2): navigate to /courses with q + quick-filter params.
      void value;
    },
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-5">
      <SearchInput
        size="xl"
        label={hero.searchLabel}
        placeholder={hero.searchPlaceholder}
        value={query}
        onValueChange={setQuery}
        onSubmit={submit}
      />

      <QuickFilters
        filters={quickFilters}
        selected={filters}
        onToggle={toggleFilter}
      />
    </div>
  );
}
