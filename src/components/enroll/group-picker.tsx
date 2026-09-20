"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  groupScheduleLabel,
  groupWhereLabel,
  isFull,
  type EnrollGroupLite,
} from "@/lib/enroll";

/* -------------------------------------------------------------------------- */
/* GroupPicker — the step-1 selection: real radio inputs on card skins (same     */
/* mechanics as the design system‘s RadioCardGroup, richer body). Full groups    */
/* are DISABLED with an explicit "Joy qolmagan" badge — selection state is the    */
/* emerald border + Check glyph + sr-only "Tanlangan", never color alone; a      */
/* full card tells screen readers its state via text + aria-disabled, not hue.   */
/* -------------------------------------------------------------------------- */

export interface GroupPickerProps {
  legend: string;
  groups: EnrollGroupLite[];
  selectedGroupId: string | null;
  onSelect: (groupId: string) => void;
  error?: string;
}

export function GroupPicker({ legend, groups, selectedGroupId, onSelect, error }: GroupPickerProps) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;

  return (
    <fieldset aria-describedby={errorId} className="min-w-0 border-0 p-0">
      <legend className="mb-2 px-0 text-sm font-medium text-ink-700">{legend}</legend>

      <ul className="flex flex-col gap-2.5">
        {groups.map((group) => {
          const full = isFull(group);
          const selected = group.id === selectedGroupId;
          const inputId = `${groupId}-${group.id}`;
          return (
            <li key={group.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "relative flex items-start gap-3 rounded-xl border p-4",
                  "transition-[border-color,background-color,box-shadow] duration-fast",
                  full
                    ? "cursor-not-allowed border-line bg-surface-muted opacity-70"
                    : "cursor-pointer",
                  !full && selected && "border-accent-600 bg-accent-50/60 shadow-xs",
                  !full && !selected && "bg-surface shadow-xs hover:border-ink-300",
                  !full &&
                    "[&:has(input:focus-visible)]:ring-[length:var(--size-focus-ring)] [&:has(input:focus-visible)]:ring-accent-600/35 [&:has(input:focus-visible)]:ring-offset-2 [&:has(input:focus-visible)]:ring-offset-canvas",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={groupId}
                  value={group.id}
                  checked={selected}
                  disabled={full}
                  onChange={() => onSelect(group.id)}
                  className="sr-only"
                  aria-describedby={full ? `${inputId}-full` : undefined}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border",
                    "transition-[background-color,border-color] duration-fast",
                    selected && !full
                      ? "border-accent-600 bg-accent-600 text-white"
                      : "border-line-strong bg-surface text-transparent",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-base font-semibold text-ink-900">
                      {group.title}
                      {selected && !full ? (
                        <span className="sr-only"> — tanlangan</span>
                      ) : null}
                    </span>
                    {full ? (
                      <Badge id={`${inputId}-full`} variant="neutral">
                        Joy qolmagan
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-sm font-medium text-accent-700">
                        {group.seatsRemaining} ta joy bor
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-ink-700">
                    {groupScheduleLabel(group)} · boshlanish {group.startDateLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {group.formatLabel} · {groupWhereLabel(group)} ·{" "}
                    {group.capacity - group.seatsRemaining}/{group.capacity} joy band
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p id={errorId} className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
