import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* EmptyState — the one zero-data surface of the dashboard. Always a real       */
/* heading + explanation + a concrete next action; never filler records and     */
/* never a decorative illustration pretending to be content.                    */
/* -------------------------------------------------------------------------- */

export interface EmptyStateProps {
  /** Rendered as h3 by default — sections own their h2. */
  title: string;
  as?: "h2" | "h3";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  as: Tag = "h3",
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-line-strong bg-surface-muted p-6 text-center sm:p-8",
        className,
      )}
    >
      <Tag className="text-lg font-semibold text-ink-900">{title}</Tag>
      <div className="mx-auto mt-1.5 max-w-prose text-base leading-relaxed text-pretty text-ink-700">
        {children}
      </div>
      {action ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
