import Image from "next/image";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { cn, stretchedLink } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { Teacher } from "@/data/models";
import { Rating, VerifiedMark } from "./rating";

export interface TeacherCardProps {
  teacher: Teacher;
  className?: string;
}

/**
 * Teacher profile card — photography dominates; the text band below is a
 * compact identity + trust summary. Whole card is a stretched-link target
 * (no independent controls inside, so a single tab stop suffices).
 */
export function TeacherCard({ teacher, className }: TeacherCardProps) {
  const {
    slug,
    name,
    photo,
    verified,
    specialization,
    rating,
    reviews,
    students,
    experienceYears,
    languages,
    activeCourses,
  } = teacher;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn("group flex h-full flex-col", className)}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-surface-muted">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            sizes="(min-width: 80rem) 280px, (min-width: 48rem) 46vw, calc(100vw - 40px)"
            className="object-cover object-[center_18%] transition-transform duration-base motion-reduce:transition-none group-hover:scale-[1.015]"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-lg">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg leading-snug font-semibold text-ink-900">
            <Link
              href={`/teachers/${slug}`}
              prefetch={false} // Phase 3: drop once the profile route exists
            className={stretchedLink}
            >
              {name}
            </Link>
          </h3>
          {verified ? <VerifiedMark /> : null}
        </div>

        <p className="text-sm text-ink-500">{specialization}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={rating} reviews={reviews} />
          <span className="text-sm text-ink-500">
            {formatCount(students)} o‘quvchi · {experienceYears} yillik tajriba
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3.5">
          {languages.map((lang) => (
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
