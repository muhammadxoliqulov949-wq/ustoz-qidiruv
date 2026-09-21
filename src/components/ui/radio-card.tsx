import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* RadioCardGroup — native radio inputs styled as selectable cards. Chosen       */
/* where a dropdown would bury a real product decision (auth role, learning     */
/* format). Keyboard/ARIA come from the native radios; selection state is       */
/* conveyed by icon + check + border, never by color alone.                     */
/* -------------------------------------------------------------------------- */

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

export interface RadioCardGroupProps {
  /** Group name for the a11y tree (legend) — required. */
  legend: string;
  value: string | null;
  onChange: (value: string) => void;
  options: RadioCardOption[];
  columns?: 1 | 2 | 3;
  error?: string;
  /** Extra id(s) to describe the group (e.g. a hint paragraph). */
  describedBy?: string;
}

const columnClasses: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  // Phase 24: 3 columns in a 26rem auth card (inner ~368px) overflows at
  // 360-1440. Keep the 3-up intent but make the grid and cards truly
  // shrinkable so the page never gets a horizontal scrollbar. The card itself
  // also reduces padding at the smallest breakpoint to preserve usable text width.
  3: "grid-cols-1 sm:grid-cols-3",
};

export function RadioCardGroup({
  legend,
  value,
  onChange,
  options,
  columns = 2,
  error,
  describedBy,
}: RadioCardGroupProps) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;

  return (
    <fieldset
      aria-describedby={cn(describedBy, errorId) || undefined}
      className="min-w-0 w-full border-0 p-0"
    >
      <legend className="mb-2 px-0 text-sm font-medium text-ink-700">{legend}</legend>

      <div className={cn("grid min-w-0 w-full gap-3", columnClasses[columns])}>
        {options.map((option) => {
          const selected = value === option.value;
          const inputId = `${groupId}-${option.value}`;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                // min-w-0 + overflow-hidden + w-full prevent the card from
                // forcing the grid track wider than its container (the 83aac694
                // desktop overflow fix). Padding drops to p-3 at the smallest
                // breakpoint to keep ~58px+ for text in a 3-up 26rem card.
                "relative flex min-w-0 w-full cursor-pointer items-start gap-2 overflow-hidden rounded-xl border p-3 sm:gap-3 sm:p-4",
                "transition-[border-color,background-color,box-shadow] duration-fast",
                selected
                  ? "border-accent-600 bg-accent-50 shadow-xs"
                  : "border-line-strong bg-surface shadow-xs hover:border-ink-300",
                "[&:has(input:focus-visible)]:ring-[length:var(--size-focus-ring)] [&:has(input:focus-visible)]:ring-accent-600/35 [&:has(input:focus-visible)]:ring-offset-2 [&:has(input:focus-visible)]:ring-offset-canvas",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
                aria-describedby={error ? errorId : undefined}
              />
              {Icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-5",
                    selected ? "bg-accent-600 text-white" : "bg-ink-900/[0.05] text-ink-500",
                  )}
                >
                  <Icon />
                </span>
              ) : null}
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-semibold text-ink-900 sm:text-base">
                    {option.label}
                    {selected ? <span className="sr-only"> — tanlangan</span> : null}
                  </span>
                  <CheckCircle2
                    aria-hidden="true"
                    className={cn(
                      "size-5 shrink-0 transition-opacity duration-fast",
                      selected ? "text-accent-600 opacity-100" : "text-ink-300 opacity-40",
                    )}
                  />
                </span>
                {option.description ? (
                  <span className="mt-1 block break-words text-sm leading-snug text-ink-500">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
