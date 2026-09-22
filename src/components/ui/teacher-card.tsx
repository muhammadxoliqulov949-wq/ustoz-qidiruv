import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn, stretchedLink } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { Teacher } from "@/data/models";
import { Rating, VerifiedMark } from "./rating";

export interface TeacherCardProps {
  teacher: Teacher;
  className?: string;
  featured?: boolean;
}

export function TeacherCard({ teacher, className, featured = false }: TeacherCardProps) {
  const { slug, name, photo, verified, specialization, rating, reviews, students, experienceYears, languages, activeCourses } = teacher;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn(
        "group flex h-full flex-col overflow-hidden",
        featured && "ring-1 ring-amber-400/25 shadow-[0_0_32px_-12px_rgba(232,181,90,0.5)]",
        className,
      )}
    >
      <div className="media-premium relative aspect-[5/4] w-full overflow-hidden bg-surface-muted">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            sizes="(min-width: 80rem) 280px, (min-width: 48rem) 46vw, calc(100vw - 40px)"
            className="motion-card-media object-cover object-[center_18%]"
          />
        ) : null}

        {/* format pill + onlayn */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <span className="rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
            Onlayn & Oflayn
          </span>
        </div>
        <span className="absolute bottom-3 right-3 z-10 hidden rounded-full bg-amber-500 p-2 text-amber-950 shadow-lg transition-transform duration-300 group-hover:translate-x-0.5 md:grid">
          <ArrowRight className="size-4" />
        </span>

        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-3 z-10 font-serif text-[10px] italic leading-none text-white/55">
          Ustoz bor —
          <br />
          bilim bor
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[1.05rem] leading-snug font-semibold text-ink-900">
            <Link href={`/teachers/${slug}`} className={stretchedLink}>
              {name}
            </Link>
          </h3>
          {verified ? <VerifiedMark /> : null}
        </div>

        <p className="text-[0.8125rem] font-medium tracking-wide text-ink-500 uppercase">{specialization}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={rating} reviews={reviews} />
          <span className="text-xs text-ink-500">
            {formatCount(students)} o&apos;quvchi · {experienceYears} yillik tajriba
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm">
          {languages.slice(0, 3).map((lang) => (
            <Badge key={lang} variant="neutral" size="sm">
              {lang}
            </Badge>
          ))}
          <Badge variant="accent" size="sm" className="ml-auto">
            {activeCourses} ta kurs
          </Badge>
        </div>
      </div>
    </Card>
  );
}
