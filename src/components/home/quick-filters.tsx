import type { ReactNode } from "react";
import { Building2, Gift, MapPin, Monitor } from "lucide-react";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuickFilter } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* Hero quick filters.                                                           */
/* Phase 1 demoed them as client toggles; Phase 3 promoted them to plain         */
/* navigational pills — each href is a ready-made /courses URL, so the row       */
/* works with zero client JS and stays shareable/bookmarkable.                   */
/* -------------------------------------------------------------------------- */

const icons: Record<QuickFilter["id"], ReactNode> = {
  toshkent: <MapPin />,
  online: <Monitor />,
  offline: <Building2 />,
  bepul: <Gift />,
};

export interface QuickFiltersProps {
  filters: QuickFilter[];
  className?: string;
}

export function QuickFilters({ filters, className }: QuickFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Tezkor filtrlar"
      className={cn(
        "home-quick-filters flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {filters.map((filter) => (
        <Pill
          key={filter.id}
          as="link"
          href={filter.href}
          leadingIcon={icons[filter.id]}
          className="home-filter-pill"
        >
          {filter.label}
        </Pill>
      ))}
    </div>
  );
}
