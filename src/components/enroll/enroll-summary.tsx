import Link from "next/link";
import { CalendarDays, MapPin, Wifi } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { cn, focusRing } from "@/lib/utils";
import {
  groupScheduleLabel,
  groupWhereLabel,
  isFull,
  type EnrollCourseLite,
  type EnrollGroupLite,
} from "@/lib/enroll";

/* -------------------------------------------------------------------------- */
/* EnrollSummary — the always-visible “what am I booking” card. Rendered ONCE:   */
/* it sits above the step card on mobile (single column) and becomes the right   */
/* sticky rail on desktop — same tree, no duplicated markup, no drift. All       */
/* rows are pure projections of catalog data + resolved group.                   */
/* -------------------------------------------------------------------------- */

export interface EnrollSummaryProps {
  course: EnrollCourseLite;
  group: EnrollGroupLite | null;
  className?: string;
}

export function EnrollSummary({ course, group, className }: EnrollSummaryProps) {
  const WhereIcon = group?.format === "online" ? Wifi : MapPin;
  return (
    <aside
      aria-label="Yozilayotgan kurs"
      className={cn("rounded-xl border border-line bg-surface p-5 shadow-xs", className)}
    >
      {course.category ? <Badge variant="accent">{course.category}</Badge> : null}
      <h2 className="mt-2 text-lg leading-snug font-semibold text-ink-900">
        <Link
          href={`/courses/${course.slug}`}
          className={cn(
            "rounded-sm transition-colors duration-fast hover:text-accent-700",
            focusRing,
          )}
        >
          {course.title}
        </Link>
      </h2>

      {course.teacherSlug ? (
        <Link
          href={`/teachers/${course.teacherSlug}`}
          className={cn(
            "mt-3 inline-flex min-w-0 items-center gap-2.5 rounded-pill py-0.5 pe-2",
            "transition-colors duration-fast hover:text-accent-700",
            focusRing,
          )}
        >
          <Avatar name={course.teacherName} size="sm" />
          <span className="truncate text-sm font-medium text-ink-900">
            {course.teacherName}
          </span>
        </Link>
      ) : (
        <span className="mt-3 inline-flex min-w-0 items-center gap-2.5">
          <Avatar name={course.teacherName} size="sm" />
          <span className="truncate text-sm font-medium text-ink-900">
            {course.teacherName}
          </span>
        </span>
      )}

      <div className="mt-4 border-t border-line pt-3 text-sm">
        {group ? (
          <>
            <p className="flex items-center justify-between gap-3">
              <span className="font-semibold text-ink-900">{group.title}</span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  isFull(group) ? "text-ink-500" : "text-accent-700",
                )}
              >
                {isFull(group) ? "Guruh to‘lgan" : `${group.seatsRemaining} ta joy bor`}
              </span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-ink-700">
              <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-ink-400" />
              {groupScheduleLabel(group)} · {group.startDateLabel}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-ink-700">
              <WhereIcon aria-hidden="true" className="size-3.5 shrink-0 text-ink-400" />
              {group.formatLabel} · {groupWhereLabel(group)}
            </p>
          </>
        ) : (
          <p className="text-ink-500">
            Guruh hali tanlanmagan — 1-qadamda tanlaysiz.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-sm text-ink-500">Narx</span>
        <span className="text-base font-semibold text-ink-900">{course.priceSummary}</span>
      </div>
      {course.priceUzs > 0 ? (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
          To‘lov bosqichi backend bilan keladi — karta ma’lumotlari hozircha
          so‘ralmaydi.
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-500">Bepul kurs — to‘lov bosqichi yo‘q.</p>
      )}
    </aside>
  );
}
