"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { CourseGroup } from "@/data/models";
import { cn, focusRing } from "@/lib/utils";
import { formatDateUz } from "./date";

export interface CourseGroupsProps {
  basePath: string;
  groups: CourseGroup[];
  selectedGroupId: string;
}

/**
 * Selectable schedule cards — the critical detail-page interaction.
 * Selection lives in the URL (`?group=`): a click uses router.replace
 * (identical no-history-spam semantics as the Phase 3 facets), and the
 * server re-renders this section AND the enrollment card from the new
 * value — one source of truth, no client store, back/forward-safe.
 * Full groups render disabled and are not selectable; the seat numbers
 * come from the database as-is: capacity is the planned size and remaining
 * seats are derived from real submitted requests. Nothing beyond that is implied.
 */
export function CourseGroups({ basePath, groups, selectedGroupId }: CourseGroupsProps) {
  const router = useRouter();
  const href = (groupId: string) =>
    groupId === groups[0]?.id ? basePath : `${basePath}?group=${groupId}`;

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => {
        const full = group.seatsRemaining === 0;
        const selected = group.id === selectedGroupId;
        const label = (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-ink-900">
                {group.title}
                {selected ? (
                  <Check aria-hidden="true" className="size-4 text-accent-600" />
                ) : null}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  full ? "text-ink-400" : "text-accent-700",
                )}
              >
                {full ? "Guruh to‘lgan" : `${group.seatsRemaining} ta joy qoldi`}
              </span>
            </span>
            <span className="mt-1.5 block text-sm text-ink-700">
              {group.days.join(", ")} · soat {group.startTime} · boshlanish{" "}
              {formatDateUz(group.startDate)}
            </span>
            <span className="mt-0.5 block text-xs text-ink-400">
              {group.location
                ? group.format === "hybrid"
                  ? `Sinf: ${group.location} · onlayn ham`
                  : group.location
                : "Onlayn"}
              {" · "}
              {group.capacity - group.seatsRemaining}/{group.capacity} joy band
            </span>
          </>
        );

        const shell = cn(
          "block w-full rounded-xl border bg-surface px-4 py-3.5 text-start",
          "transition-[border-color,box-shadow,background-color] duration-fast",
          focusRing,
          full
            ? "cursor-not-allowed border-line bg-surface-muted opacity-70"
            : selected
              ? "border-accent-600 ring-2 ring-accent-600/35"
              : "border-line hover:border-line-strong hover:bg-surface-muted",
        );

        return (
          <li key={group.id}>
            {full ? (
              <span
                aria-disabled="true"
                title="Bu guruh to‘lgan — boshqa guruhni tanlang"
                className={shell}
              >
                {label}
              </span>
            ) : (
              <a
                href={href(group.id)}
                aria-current={selected ? "true" : undefined}
                className={shell}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  if (selected) {
                    event.preventDefault();
                    return;
                  }
                  event.preventDefault();
                  router.replace(href(group.id), { scroll: false });
                }}
              >
                {selected ? (
                  <span className="sr-only">Tanlangan: </span>
                ) : null}
                {label}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
