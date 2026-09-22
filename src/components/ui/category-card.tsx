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

const theme: Record<string, { gradient: string; glow: string; iconWrap: string; iconColor: string; badge?: string }> = {
  english: {
    gradient: "from-amber-500/18 via-amber-600/8 to-transparent",
    glow: "bg-amber-500/20",
    iconWrap: "bg-amber-500/14 border-amber-400/20",
    iconColor: "text-amber-300",
  },
  ielts: {
    gradient: "from-emerald-600/14 via-emerald-500/6 to-transparent",
    glow: "bg-emerald-500/18",
    iconWrap: "bg-emerald-500/12 border-emerald-400/16",
    iconColor: "text-emerald-300",
  },
  math: {
    gradient: "from-sky-500/16 via-blue-500/10 to-transparent",
    glow: "bg-sky-500/18",
    iconWrap: "bg-sky-500/12 border-sky-400/16",
    iconColor: "text-sky-300",
  },
  programming: {
    gradient: "from-cyan-500/14 via-blue-600/10 to-transparent",
    glow: "bg-cyan-500/18",
    iconWrap: "bg-cyan-500/12 border-cyan-400/16",
    iconColor: "text-cyan-300",
  },
  arabic: {
    gradient: "from-emerald-900/35 via-emerald-600/12 to-transparent",
    glow: "bg-emerald-500/14",
    iconWrap: "bg-emerald-500/12 border-emerald-400/16",
    iconColor: "text-emerald-300",
  },
  design: {
    gradient: "from-violet-500/14 via-fuchsia-500/10 to-transparent",
    glow: "bg-violet-500/18",
    iconWrap: "bg-violet-500/12 border-violet-400/16",
    iconColor: "text-violet-300",
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
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", t.gradient)} aria-hidden="true" />

      {/* soft glow behind 3D object */}
      <div className={cn("pointer-events-none absolute left-1/2 top-[44%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-60", t.glow)} aria-hidden="true" />

      {/* large faded background icon for depth */}
      <div aria-hidden="true" className="pointer-events-none absolute right-2 top-2 grid size-16 place-items-center opacity-[0.06] group-hover:opacity-[0.10]">
        <Icon className="size-[54px]" />
      </div>

      {category.id === "english" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-5 top-[3.2rem] rounded-2xl border border-amber-400/30 bg-amber-500 px-3 py-1.5 text-[13px] font-bold text-amber-950 shadow-lg"
          style={{ transform: "rotate(4deg)" }}
        >
          Hello
        </span>
      )}
      {category.id === "math" && (
        <span aria-hidden="true" className="pointer-events-none absolute right-6 top-[3.6rem] text-[20px] font-bold text-white/18">
          π
        </span>
      )}

      <Link href={`/categories/${category.slug}`} className={cn("relative flex h-full min-h-[12.5rem] flex-col p-5 text-left", stretchedLink)}>
        {/* centered 3D object */}
        <div className="flex flex-1 items-center justify-center pt-2">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-[72px] place-items-center rounded-2xl border backdrop-blur-sm shadow-sm transition-transform duration-300 group-hover:scale-[1.04] group-hover:rotate-[-1deg] [&>svg]:size-[30px] [&>svg]:stroke-[1.6]",
              t.iconWrap,
              t.iconColor,
            )}
          >
            <Icon />
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[1.02rem] font-semibold tracking-[-0.015em] text-ink-900">{category.name}</span>
            {typeof courseCount === "number" ? (
              <span className="text-xs font-medium text-ink-500">{formatCount(courseCount)} ta kurs</span>
            ) : null}
          </div>

          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full border border-white/14 bg-white/6 text-ink-400 backdrop-blur-sm transition-colors duration-200 group-hover:border-white/22 group-hover:bg-white/10 group-hover:text-ink-900 [&>svg]:size-3.5"
          >
            <ArrowRight />
          </span>
        </div>
      </Link>
    </Card>
  );
}
