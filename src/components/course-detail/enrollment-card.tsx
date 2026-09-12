import { CalendarDays, MapPin, Wifi } from "lucide-react";
import type { Course, CourseGroup } from "@/data/models";
import { formatPrice } from "@/lib/format";
import { SaveButton } from "@/components/ui/save-button";
import { cn } from "@/lib/utils";
import { withNext } from "@/lib/safe-next";
import { EnrollDialog } from "./enroll-dialog";

/** Canonical /enroll href — same “first group needs no param” rule as the
 *  Phase 4 group picker, so links stay shareable and canonical. */
function enrollFlowHref(course: Course, group: CourseGroup): string {
  const base = `/enroll/${course.slug}`;
  return group.id === course.detail.groups[0]?.id ? base : `${base}?group=${group.id}`;
}

export interface EnrollmentCardProps {
  course: Course;
  group: CourseGroup;
  /** Second instance (mobile bar) gets its own labelled heading. */
  variant?: "card" | "bar";
  className?: string;
}

/** One-line group description, shared by the card, the bar and the dialog. */
export function groupSummaryLine(group: CourseGroup): string {
  const where =
    group.format === "online"
      ? "onlayn"
      : group.format === "hybrid"
        ? "sinf + onlayn"
        : (group.location ?? "sinfda");
  return `${group.title} · ${group.days.join(", ")} · soat ${group.startTime} · ${where}`;
}

export function priceSummaryLine(course: Course): string {
  if (course.priceUzs === 0) return "Bepul";
  const unit =
    course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta";
  return `${formatPrice(course.priceUzs)} / ${unit}`;
}

/**
 * Enrollment entry point — price, unit, format, the currently selected
 * group summary, mock availability, primary CTA (opens the handoff
 * dialog) and the secondary save action. Solid surface, never glass.
 * The summary is a pure projection of the `?group=` URL state the page
 * resolved server-side, so card and schedule section can never drift.
 */
export function EnrollmentCard({
  course,
  group,
  variant = "card",
  className,
}: EnrollmentCardProps) {
  const full = group.seatsRemaining === 0;
  const { format, location } = course;
  const FormatIcon = format === "online" ? Wifi : MapPin;
  const flowHref = enrollFlowHref(course, group);
  const loginHref = withNext("/login", flowHref);
  const registerHref = withNext("/register?role=student", flowHref);

  if (variant === "bar") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-2.5 backdrop-blur-[6px]",
          "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
          className,
        )}
      >
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink-900">
              {course.priceUzs === 0
                ? "Bepul"
                : formatPrice(course.priceUzs)}
            </p>
            <p className="truncate text-xs text-ink-500">
              {course.priceUzs === 0
                ? "bu kurs"
                : course.detail.pricePeriod === "month"
                  ? "oyiga · " + group.title
                  : "butun kurs uchun"}
            </p>
          </div>
          <EnrollDialog
            courseTitle={course.title}
            flowHref={flowHref}
            loginHref={loginHref}
            registerHref={registerHref}
            groupSummary={groupSummaryLine(group)}
            priceSummary={priceSummaryLine(course)}
            triggerLabel="Yozilish"
            triggerFullWidth={false}
            triggerClassName={cn("shrink-0 px-8", full && "pointer-events-none opacity-60")}
            titleId="enroll-bar-dialog-title"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Kursga yozilish"
      className={cn("rounded-xl border border-line bg-surface p-6 shadow-xs", className)}
    >
      <p className="text-2xl font-semibold text-ink-900">
        {course.priceUzs === 0 ? (
          "Bepul"
        ) : (
          <>
            {formatPrice(course.priceUzs)}
            <span className="ml-1 text-base font-normal text-ink-500">
              / {course.detail.pricePeriod === "month" ? "oyiga" : "butun kurs"}
            </span>
          </>
        )}
      </p>

      <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink-700">
        <li className="flex items-center gap-2">
          <FormatIcon className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
          {format === "online"
            ? "Onlayn darslar"
            : format === "offline"
              ? `Sinf darslari${location ? ` — ${location}` : ""}`
              : `Sinf + onlayn qatnashish${location ? ` (${location})` : ""}`}
        </li>
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
          <span>{groupSummaryLine(group)}</span>
        </li>
      </ul>

      <p className={cn("mt-4 text-sm", full ? "text-ink-500" : "text-accent-700")}>
        {full
          ? "Bu guruhda joylar tugagan — jadvaldan boshqa guruhni tanlang."
          : `Bu guruhda ${group.seatsRemaining} ta joy band emas.`}
      </p>

      <div className="mt-4">
        <EnrollDialog
          courseTitle={course.title}
          flowHref={flowHref}
          loginHref={loginHref}
          registerHref={registerHref}
          groupSummary={groupSummaryLine(group)}
          priceSummary={priceSummaryLine(course)}
          triggerLabel="Kursga yozilish"
          titleId="enroll-card-dialog-title"
          triggerClassName={full ? "pointer-events-none opacity-60" : undefined}
        />
        {full ? (
          <p className="mt-2 text-xs text-ink-500">
            Yozilish uchun avval bo‘sh guruhni tanlang.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5">
        <SaveButton
          title={course.title}
          className="bg-surface-muted shadow-none ring-1 ring-line"
        />
        <span className="text-sm text-ink-500">
          Kursni saqlash — saqlanganlar profilingizda ko‘rinadi
        </span>
      </div>
    </div>
  );
}
