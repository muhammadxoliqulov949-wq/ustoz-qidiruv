import Link from "next/link";
import { cn, stretchedLink } from "@/lib/utils";
import { Card } from "@/components/ui";
import { categoryIcons } from "@/components/icons";
import { formatCount } from "@/lib/format";
import type { Category } from "@/data/models";

export interface CategoryCardProps {
  category: Category;
  /**
   * Published courses in this category, counted at request time by
   * `getCategoryCourseCounts()`. Optional on purpose: with no number supplied
   * the count line is simply not rendered — the card has no stored value to
   * fall back to, so it can never display an inventory figure nobody counted.
   */
  courseCount?: number | null;
  className?: string;
}

/**
 * Compact category tile: icon + name + live published-course count.
 * Stretched-link whole-card target (see CourseCard for the pattern).
 */
export function CategoryCard({ category, courseCount, className }: CategoryCardProps) {
  const Icon = categoryIcons[category.icon];

  return (
    <Card variant="interactive" padded={false} className={cn("h-full", className)}>
      <Link
        href={`/categories/${category.slug}`}
        className={cn(
          "flex h-full flex-col items-start justify-center gap-3 px-5 py-7 text-left",
          stretchedLink,
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-xl border border-accent-600/10 bg-accent-50 text-accent-700 shadow-sm [&>svg]:size-[23px] [&>svg]:stroke-[1.75]"
        >
          <Icon />
        </span>
        <span className="text-lg leading-snug font-semibold text-ink-900">
          {category.name}
        </span>
        {typeof courseCount === "number" ? (
          <span className="text-sm text-ink-500">
            {formatCount(courseCount)} ta kurs
          </span>
        ) : null}
      </Link>
    </Card>
  );
}
