import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* StepProgress — segmented bar + numeric position. Reads the same on mobile     */
/* and desktop ("2 / 5 — qadam"), so progress never depends on hidden            */
/* desktop-only labels (Phase 6 responsive QA rule). The current step NAME is    */
/* the focused <h1> of the card — no duplicated label here.                     */
/* -------------------------------------------------------------------------- */

export interface StepProgressProps {
  /** 0-based index of the current step (completion screen included). */
  index: number;
  /** Total steps including the completion screen. */
  total: number;
  className?: string;
}

export function StepProgress({ index, total, className }: StepProgressProps) {
  const current = Math.min(Math.max(index + 1, 1), total);
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div
        role="progressbar"
        aria-label="Onboarding qadami"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        className="flex gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "h-1.5 min-w-4 flex-1 rounded-pill transition-colors duration-base",
              i < current ? "bg-accent-600" : "bg-line",
            )}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-ink-500">
        <span className="tabular-nums text-ink-900">
          {current} / {total}
        </span>{" "}
        — qadam
      </p>
    </div>
  );
}
