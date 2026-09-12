import Link from "next/link";
import { cn, stretchedLink } from "@/lib/utils";
import { Card } from "@/components/ui";
import { categoryIcons } from "@/components/icons";
import { formatCount } from "@/lib/format";
import type { Category } from "@/data/models";

export interface CategoryCardProps {
  category: Category;
  className?: string;
}

/**
 * Compact category tile: icon + name + mock course count.
 * Stretched-link whole-card target (see CourseCard for the pattern).
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  const Icon = categoryIcons[category.icon];

  return (
    <Card variant="interactive" padded={false} className={cn("h-full", className)}>
      <Link
        href={`/categories/${category.slug}`}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-3 px-4 py-7 text-center",
          stretchedLink,
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-lg bg-accent-50 text-accent-700 [&>svg]:size-[22px] [&>svg]:stroke-[1.75]"
        >
          <Icon />
        </span>
        <span className="text-base leading-snug font-medium text-ink-900">
          {category.name}
        </span>
        <span className="text-sm text-ink-500">
          {formatCount(category.courseCount)} ta kurs
        </span>
      </Link>
    </Card>
  );
}
