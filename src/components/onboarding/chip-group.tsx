"use client";

import { useId } from "react";
import { Pill } from "@/components/ui";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* ChipGroup — multi-select of the design-system PillToggle over REAL catalog   */
/* options (categories, languages, levels, formats): onboarding never invents   */
/* a parallel taxonomy. Real checkboxes under the hood → native keyboard and     */
/* screen-reader semantics; `maxSelected` locks unselected chips (hint tells     */
/* the user why) instead of erroring after the fact.                            */
/* -------------------------------------------------------------------------- */

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  legend: string;
  options: ChipOption[];
  values: string[];
  onToggle: (value: string, next: boolean) => void;
  hint?: string;
  error?: string;
  maxSelected?: number;
  className?: string;
}

export function ChipGroup({
  legend,
  options,
  values,
  onToggle,
  hint,
  error,
  maxSelected,
  className,
}: ChipGroupProps) {
  const id = useId();
  // Same one-message pattern as the Input primitive: error replaces hint.
  const descId = hint || error ? `${id}-desc` : undefined;
  const atMax = maxSelected !== undefined && values.length >= maxSelected;

  return (
    <fieldset
      aria-describedby={descId}
      className={cn("min-w-0 border-0 p-0", className)}
    >
      <legend className="mb-1 px-0 text-sm font-medium text-ink-700">{legend}</legend>
      {hint || error ? (
        <p id={descId} className={cn("mb-2 text-sm", error ? "text-danger" : "text-ink-500")}>
          {error ?? hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pill
              key={option.value}
              as="button"
              selected={selected}
              disabled={atMax && !selected}
              onChange={(next) => onToggle(option.value, next)}
            >
              {option.label}
            </Pill>
          );
        })}
      </div>
    </fieldset>
  );
}
