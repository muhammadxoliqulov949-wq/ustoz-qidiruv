import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuickFilter } from "@/data/site";

export interface QuickFiltersProps {
  filters: QuickFilter[];
  className?: string;
}

export function QuickFilters({ filters, className }: QuickFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Tezkor filtrlar"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="mr-1 text-sm font-medium text-ink-500">Ommabop yo&apos;nalishlar:</span>
      {filters.map((filter) => (
        <Pill key={filter.id} as="link" href={filter.href} className="h-8 px-3 text-[13px]">
          {filter.label}
        </Pill>
      ))}
    </div>
  );
}
