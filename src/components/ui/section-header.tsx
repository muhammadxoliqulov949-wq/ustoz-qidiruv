import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  /** Optional overline label above the title (uppercase, accent-tinted). */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Right-side actions on desktop; wraps under the copy on mobile. */
  action?: ReactNode;
  /** Heading level — pages own one <h1>; sections use h2 (default). */
  as?: "h2" | "h3";
  align?: "left" | "center";
  /** Trim the default vertical rhythm for dense pages. */
  compact?: boolean;
  className?: string;
}

/**
 * Standard section opener for every marketplace page:
 * eyebrow + heading + supporting copy + optional action.
 * Guarantees one typographic rhythm site-wide.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h2",
  align = "left",
  compact = false,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex w-full gap-4",
        align === "center"
          ? "flex-col items-center text-center"
          : "flex-col-reverse items-start sm:flex-row sm:items-end sm:justify-between",
        compact ? "mb-4" : "mb-8 md:mb-12",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2",
          align === "center" && "items-center",
        )}
      >
        {eyebrow ? (
          <p className="text-sm font-semibold tracking-[0.08em] text-accent-600 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag
          className={cn(
            "font-semibold tracking-[-0.015em] text-balance text-ink-900",
            Tag === "h2" ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p
            className={cn(
              "max-w-prose text-base text-pretty text-ink-500 md:text-lg",
              align === "center" && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}
