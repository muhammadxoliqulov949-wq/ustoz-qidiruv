import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn, stretchedLink } from "@/lib/utils";
import { Card } from "@/components/ui";
import { categoryIcons } from "@/components/icons";
import { formatCount } from "@/lib/format";
import type { Category } from "@/data/models";

export interface CategoryCardProps {
  category: Category;
  courseCount?: number | null;
  className?: string;
  featured?: boolean;
}

const theme: Record<string, { gradient: string; border: string; iconWrap: string; iconColor: string; accent: string }> = {
  english: {
    gradient: "from-amber-500/20 via-amber-600/8 to-transparent",
    border: "border-amber-400/20",
    iconWrap: "bg-amber-500/15 border-amber-400/20",
    iconColor: "text-amber-300",
    accent: "amber",
  },
  ielts: {
    gradient: "from-emerald-600/12 via-emerald-500/6 to-transparent",
    border: "border-emerald-400/14",
    iconWrap: "bg-emerald-500/12 border-emerald-400/16",
    iconColor: "text-emerald-300",
    accent: "emerald",
  },
  math: {
    gradient: "from-cyan-500/16 via-blue-500/10 to-transparent",
    border: "border-cyan-400/14",
    iconWrap: "bg-cyan-500/12 border-cyan-400/16",
    iconColor: "text-cyan-300",
    accent: "cyan",
  },
  programming: {
    gradient: "from-sky-500/14 via-blue-600/10 to-transparent",
    border: "border-sky-400/14",
    iconWrap: "bg-sky-500/12 border-sky-400/16",
    iconColor: "text-sky-300",
    accent: "sky",
  },
  arabic: {
    gradient: "from-emerald-900/40 via-emerald-600/12 to-transparent",
    border: "border-emerald-400/14",
    iconWrap: "bg-emerald-500/12 border-emerald-400/16",
    iconColor: "text-emerald-300",
    accent: "emerald",
  },
  design: {
    gradient: "from-violet-500/14 via-fuchsia-500/10 to-transparent",
    border: "border-violet-400/14",
    iconWrap: "bg-violet-500/12 border-violet-400/16",
    iconColor: "text-violet-300",
    accent: "violet",
  },
};

export function CategoryCard({ category, courseCount, className, featured = false }: CategoryCardProps) {
  const Icon = categoryIcons[category.icon];
  const t = theme[category.id] ?? theme.design;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn(
        "group relative h-full overflow-hidden",
        featured && "ring-1 ring-amber-400/20 shadow-[0_0_32px_-12px_rgba(232,181,90,0.45)]",
        className,
      )}
    >
      {/* gradient wash */}
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", t.gradient)} aria-hidden="true" />
      {/* 3D object simulation — large faded icon behind */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 grid size-20 place-items-center opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.14]"
      >
        <Icon className="size-[54px]" />
      </div>

      {/* amber Hello bubble for Ingliz tili featured */}
      {category.id === "english" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-[3.4rem] rounded-2xl border border-amber-400/30 bg-amber-500/90 px-3.5 py-2 text-[15px] font-bold text-amber-950 shadow-lg"
          style={{ transform: "rotate(2deg)" }}
        >
          Hello
        </span>
      )}

      <Link
        href={`/categories/${category.slug}`}
        className={cn("relative flex h-full min-h-[11.5rem] flex-col justify-between p-5 text-left", stretchedLink)}
      >
        <div className="flex flex-col gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-10 place-items-center rounded-xl border backdrop-blur-sm [&>svg]:size-[20px] [&>svg]:stroke-[1.75]",
              t.iconWrap,
              t.iconColor,
            )}
          >
            <Icon />
          </span>

          <span className="text-[1.05rem] font-semibold tracking-[-0.015em] text-ink-900">{category.name}</span>
          {typeof courseCount === "number" ? (
            <span className="text-xs font-medium tracking-wide text-ink-500">
              {courseCount === 0 ? "0 ta kurs" : `${formatCount(courseCount)} ta kurs`}
            </span>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className="mt-4 grid size-7 place-items-center rounded-full border border-white/14 bg-white/6 text-ink-400 backdrop-blur-sm transition-colors duration-200 group-hover:border-white/22 group-hover:text-ink-900 group-hover:bg-white/10 [&>svg]:size-3.5"
        >
          <ArrowRight />
        </span>
      </Link>
    </Card>
  );
}
