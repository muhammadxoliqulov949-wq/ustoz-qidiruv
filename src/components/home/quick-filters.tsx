"use client";

import type { ReactNode } from "react";
import { Building2, Gift, MapPin, Monitor } from "lucide-react";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuickFilter } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* Hero quick filters.                                                         */
/* Phase 1: toggles are managed client-side state — the natural demo of the   */
/* reusable Pill primitive and the exact shape /courses will consume as URL   */
/* params in Phase 2.                                                          */
/* -------------------------------------------------------------------------- */

const icons: Record<QuickFilter["id"], ReactNode> = {
  toshkent: <MapPin />,
  online: <Monitor />,
  offline: <Building2 />,
  bepul: <Gift />,
};

export interface QuickFiltersProps {
  filters: QuickFilter[];
  selected: ReadonlySet<string>;
  onToggle: (id: string, next: boolean) => void;
  className?: string;
}

export function QuickFilters({
  filters,
  selected,
  onToggle,
  className,
}: QuickFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Tezkor filtrlar"
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      {filters.map((filter) => (
        <Pill
          key={filter.id}
          as="button"
          selected={selected.has(filter.id)}
          onChange={(next) => onToggle(filter.id, next)}
          leadingIcon={icons[filter.id]}
        >
          {filter.label}
        </Pill>
      ))}
    </div>
  );
}
