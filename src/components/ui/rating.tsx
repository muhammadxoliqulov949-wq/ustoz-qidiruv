import { BadgeCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount, formatRating } from "@/lib/format";

/**
 * Rating readout shared by CourseCard/TeacherCard: one star, one hue
 * (--color-rating). Optional review count in parentheses.
 */
export function Rating({
  value,
  reviews,
  className,
}: {
  value: number;
  reviews?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold text-ink-900",
        className,
      )}
    >
      <Star aria-hidden="true" className="size-4 fill-rating text-rating stroke-0" />
      {formatRating(value)}
      {reviews ? (
        <span className="font-normal text-ink-500">
          ({formatCount(reviews)})
        </span>
      ) : null}
      <span className="sr-only">yulduz, reyting 5 dan</span>
    </span>
  );
}

/**
 * Platform verification mark. Iconic + accessible name; tooltip via title.
 * Rendered only when the entity is actually verified — never decorative.
 */
export function VerifiedMark({
  label = "Tasdiqlangan ustoz",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      title={label}
      className={cn("inline-flex shrink-0 items-center", className)}
    >
      <BadgeCheck aria-hidden="true" className="size-[17px] text-accent-600" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
