import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui";
import { cn, stretchedLink } from "@/lib/utils";
import { formatCount, formatPrice } from "@/lib/format";
import { courseFormatLabels } from "@/data/courses";
import type { Course } from "@/data/models";
import { Rating, VerifiedMark } from "./rating";
import { SaveButton } from "./save-button";

export interface CourseCardProps {
  course: Course;
  className?: string;
  priority?: boolean;
  featured?: boolean;
}

export function CourseCard({ course, className, priority = false, featured = false }: CourseCardProps) {
  const { id, slug, title, teacher, format, location, priceUzs, image, rating, reviews, students } = course;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn(
        "group flex h-full flex-col overflow-hidden",
        featured && "ring-1 ring-amber-400/25 shadow-[0_0_36px_-12px_rgba(232,181,90,0.55)] border-amber-400/20",
        className,
      )}
    >
      <div className="media-premium relative aspect-[16/10] w-full overflow-hidden bg-surface-muted">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 80rem) 280px, (min-width: 64rem) 376px, (min-width: 48rem) 340px, calc(100vw - 40px)"
            priority={priority}
            className="motion-card-media object-cover"
          />
        ) : null}

        {/* top pills */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          {featured ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-amber-400/30 bg-amber-500/90 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-md">
              🔥 Ommabop kurs
            </span>
          ) : (
            <Badge variant={format === "online" ? "accent" : format === "offline" ? "warning" : "neutral"} tone="soft" size="sm">
              {courseFormatLabels[format]}
            </Badge>
          )}
          <span className="inline-flex items-center gap-1 rounded-pill border border-white/20 bg-black/35 px-2 py-1 text-xs font-medium text-white backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Online
          </span>
        </div>

        <SaveButton title={title} kind="course" entityId={id} className="absolute bottom-3 right-3 z-10" />

        {/* subtle speak-learn-grow watermark for Ingliz tili like reference */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-3 z-10 hidden font-serif text-[11px] italic leading-none text-white/60 md:block"
        >
          Speak
          <br />
          Learn
          <br />
          Grow
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-5">
        <h3 className="text-[1.05rem] leading-snug font-semibold tracking-[-0.012em] text-balance text-ink-900 line-clamp-2">
          <Link href={`/courses/${slug}`} className={stretchedLink}>
            <span className="line-clamp-2">{title}</span>
          </Link>
        </h3>

        <div className="flex items-center gap-2 text-sm text-ink-700">
          <Avatar name={teacher.name} size="sm" />
          <span className="font-medium">{teacher.name}</span>
          {teacher.verified ? <VerifiedMark /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" size="sm" className="border-white/10 bg-white/6">
            Beginner → Advanced
          </Badge>
          <Badge variant="neutral" size="sm" className="border-white/10 bg-white/6">
            120+ dars
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
            <Users aria-hidden="true" className="size-3.5" />
            {formatCount(students)}+
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Rating value={rating} reviews={reviews} />
          {location && format !== "online" ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-ink-500">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          ) : null}
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-ink-500">
          Amaliy metodlar bilan ingliz tilini oson va samarali o&apos;rganing. Speaking, Grammar, Listening va yana ko&apos;p!
        </p>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            href={`/courses/${slug}`}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors",
              featured
                ? "border-amber-400/30 bg-amber-500 text-amber-950 hover:bg-amber-400 shadow-[0_0_20px_-8px_rgba(232,181,90,0.7)]"
                : "border-white/12 bg-white/6 text-ink-900 hover:bg-white/10 hover:border-white/18 backdrop-blur-sm",
            )}
          >
            {featured ? "Batafsil" : "Ko'rish"} <ArrowRight className="size-4" />
          </Link>
          <span
            className={cn(
              "hidden text-sm font-bold sm:inline",
              priceUzs > 0 ? "text-ink-900" : "text-accent-400",
            )}
          >
            {priceUzs > 0 ? formatPrice(priceUzs) : "Bepul"}
          </span>
        </div>
      </div>
    </Card>
  );
}
