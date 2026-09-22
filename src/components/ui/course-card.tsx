import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
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
  /**
   * Phase 24 (LCP): the first card of a results grid IS the Largest Contentful
   * Paint on /courses and /categories/[slug], and Next flagged it exactly for
   * that ("add loading=eager"). Only that card gets `priority` — preloading a
   * whole grid would compete with the document for bandwidth and make the
   * metric worse, not better.
   */
  priority?: boolean;
}

/**
 * Marketplace course card.
 *
 * Structure: the title carries a stretched <Link> (after:absolute inset-0)
 * making the whole card clickable, while the Save control sits above it
 * (z-10) and stops propagation — a single tab stop for the card, keyboard
 * focus is painted by Card's focus-within ring. Image scale is the only
 * hover flourish; no permanent CTA inside the card.
 */
export function CourseCard({ course, className, priority = false }: CourseCardProps) {
  const {
    id,
    slug,
    title,
    teacher,
    format,
    location,
    priceUzs,
    image,
    rating,
    reviews,
    students,
  } = course;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn("group flex h-full flex-col", className)}
    >
      {/* Media band — 16:10, full bleed */}
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
        <SaveButton
          title={title}
          kind="course"
          entityId={id}
          className="absolute top-3 right-3"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge variant={format === "online" ? "accent" : format === "offline" ? "warning" : "neutral"} tone="soft">{courseFormatLabels[format]}</Badge>
          {location && format !== "online" ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-sm text-ink-500">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          ) : null}
        </div>

        <h3 className="text-[1.0625rem] leading-snug font-semibold tracking-[-0.012em] text-balance text-ink-900 line-clamp-2">
          <Link href={`/courses/${slug}`} className={stretchedLink}>
            <span className="line-clamp-2">{title}</span>
          </Link>
        </h3>

        <div className="flex items-center gap-2 text-sm text-ink-700">
          <Avatar name={teacher.name} size="sm" />
          <span className="font-medium">{teacher.name}</span>
          {teacher.verified ? <VerifiedMark /> : null}
        </div>

        <div className="flex items-center gap-3">
          <Rating value={rating} reviews={reviews} />
          <span className="inline-flex items-center gap-1 text-sm text-ink-500">
            <Users aria-hidden="true" className="size-4" />
            {formatCount(students)}
          </span>
        </div>

        <div className="mt-auto flex items-baseline justify-between rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-sm">
          <p
            className={cn(
              "text-[1.05rem] font-bold tracking-[-0.015em]",
              priceUzs > 0 ? "text-ink-900" : "text-accent-400",
            )}
          >
            {formatPrice(priceUzs)}
            {priceUzs > 0 ? (
              <span className="text-sm font-normal text-ink-500"> / oyiga</span>
            ) : null}
          </p>
          {priceUzs === 0 ? (
            <Badge variant="accent" size="sm">Bepul</Badge>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
