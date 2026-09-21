import Image from "next/image";
import Link from "next/link";
import { MapPin, Wifi } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Rating, VerifiedMark } from "@/components/ui/rating";
import { SaveButton } from "@/components/ui/save-button";
import { cn, stretchedLink } from "@/lib/utils";
import { formatCount, formatPrice } from "@/lib/format";
import { cityLabel, courseFormatLabels } from "@/data/courses";
import type { TeacherRow } from "@/data/teacher-rows";

/* -------------------------------------------------------------------------- */
/* TeacherBrowseCard — the /teachers grid card (Phase 5). Same family as the     */
/* home TeacherCard (photo dominates, one tab stop), tuned for comparison:       */
/* identity + trust, what the teacher actually offers (formats/cities,          */
/* languages) and pricing derived from their real courses. Nothing here is       */
/* invented — availability and price are computed from the course catalog.       */
/* -------------------------------------------------------------------------- */

export function TeacherBrowseCard({
  row,
  className,
  priority = false,
}: {
  row: TeacherRow;
  className?: string;
  /**
   * Phase 24 (LCP): the first card of the /teachers grid is the Largest
   * Contentful Paint of that page and Next flagged it as lazy-loaded. Only the
   * first card is promoted — see the same prop on CourseCard.
   */
  priority?: boolean;
}) {
  const { teacher, cities, formats, minPriceUzs, courseIds } = row;
  const { id, slug, name, photo, verified, specialization } = teacher;

  const priceLabel =
    minPriceUzs === null
      ? null
      : minPriceUzs === 0
        ? "Bepul kurslari bor"
        : `${formatPrice(minPriceUzs)}dan`;

  return (
    <Card
      variant="interactive"
      padded={false}
      className={cn("group flex h-full flex-col", className)}
    >
      <div className="media-premium relative aspect-[5/4] w-full overflow-hidden bg-surface-muted">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            sizes="(min-width: 80rem) 280px, (min-width: 48rem) 46vw, calc(100vw - 40px)"
            priority={priority}
            className="motion-card-media object-cover object-[center_18%]"
          />
        ) : null}
        <SaveButton
          title={name}
          kind="teacher"
          entityId={id}
          className="absolute top-3 right-3"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg leading-snug font-semibold text-ink-900">
            <Link href={`/teachers/${slug}`} className={stretchedLink}>
              {name}
            </Link>
          </h3>
          {verified ? <VerifiedMark /> : null}
        </div>

        <p className="text-sm text-ink-500">{specialization}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating value={teacher.rating} reviews={teacher.reviews} />
          <span className="text-sm text-ink-500">
            {formatCount(teacher.students)} o‘quvchi · {teacher.experienceYears} yillik
            tajriba
          </span>
        </div>

        {/* What they actually offer — derived, never implied */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700">
          {formats.includes("online") ? (
            <span className="inline-flex items-center gap-1">
              <Wifi aria-hidden="true" className="size-3.5 text-ink-400" />
              {courseFormatLabels.online}
            </span>
          ) : null}
          {cities.length > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-ink-400" />
              {cityLabel(cities[0] ?? "")}
              {cities.length > 1 ? ` +${cities.length - 1}` : ""}
            </span>
          ) : null}
          {!formats.includes("online") && cities.length === 0 && formats.length > 0 ? (
            <span>{courseFormatLabels[formats[0] ?? "online"]}</span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-warm px-3 py-2.5">
          {teacher.languages.map((lang) => (
            <Badge key={lang} variant="neutral" size="sm">
              {lang}
            </Badge>
          ))}
          <span className="ml-auto text-sm font-medium text-ink-900">
            {courseIds.length} ta kurs
            {priceLabel ? (
              <span className="text-ink-500"> · {priceLabel}</span>
            ) : null}
          </span>
        </div>
      </div>
    </Card>
  );
}
