import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { cn, focusRing } from "@/lib/utils";
import type { VerificationRequestState, VerificationState } from "@/lib/teacher-verification";
import {
  VERIFICATION_REQUEST_STATE_LABEL,
  VERIFICATION_REQUEST_STATE_TONE,
  VERIFICATION_STATE_LABEL,
  VERIFICATION_STATE_TONE,
} from "@/lib/teacher-verification";
import type { CourseState, ModerationReviewState } from "@/lib/course-moderation";
import {
  COURSE_STATE_LABEL,
  COURSE_STATE_TONE,
  MODERATION_REVIEW_STATE_LABEL,
  MODERATION_REVIEW_STATE_TONE,
} from "@/lib/course-moderation";

/* -------------------------------------------------------------------------- */
/* Admin presentational pieces — Phase 15.                                      */
/*                                                                              */
/* SERVER components with no state: they render labels that come from the same  */
/* shared dictionaries the services and actions use, so a queue row, a detail    */
/* page and the teacher's own screen can never disagree about what a state is    */
/* called. Every badge carries its WORD as well as its colour (status is never   */
/* colour-only), and each one is a real <span> inside a definition list or a     */
/* table cell — nothing here is a chart, a KPI tile or a progress bar.           */
/* -------------------------------------------------------------------------- */

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Tashkent",
});

const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});

/**
 * Dates are formatted on the SERVER in a fixed timezone and rendered as text.
 * A client-side formatter would render a different string on hydration and
 * shift the layout (CLS), and "3 minutes ago" would be wrong the moment it is
 * cached.
 */
export function formatAdminDate(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function formatAdminDateTime(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/** `datetime` attribute for a real <time> element (machine-readable value). */
export function isoDate(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function VerificationBadge({
  state,
  size = "sm",
}: {
  state: VerificationState;
  size?: "sm" | "md";
}) {
  return (
    <Badge variant={VERIFICATION_STATE_TONE[state]} size={size}>
      {VERIFICATION_STATE_LABEL[state]}
    </Badge>
  );
}

export function RequestStateBadge({ state }: { state: VerificationRequestState }) {
  return (
    <Badge variant={VERIFICATION_REQUEST_STATE_TONE[state]}>
      {VERIFICATION_REQUEST_STATE_LABEL[state]}
    </Badge>
  );
}

export function CourseStateBadge({ state }: { state: CourseState }) {
  return <Badge variant={COURSE_STATE_TONE[state]}>{COURSE_STATE_LABEL[state]}</Badge>;
}

export function ReviewStateBadge({ state }: { state: ModerationReviewState }) {
  return (
    <Badge variant={MODERATION_REVIEW_STATE_TONE[state]}>
      {MODERATION_REVIEW_STATE_LABEL[state]}
    </Badge>
  );
}

/**
 * One definition-list row. The admin screens are full of label/value pairs
 * (applicant name, specialization, submission date…), and a <dl> is the honest
 * markup for them — a screen reader announces the label with the value instead
 * of reading a column of orphaned strings.
 */
export function AdminField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-base text-ink-900">{children}</dd>
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "depth-card flex flex-col gap-4 rounded-xl border p-5 md:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-prose text-base leading-relaxed text-ink-700">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A filtered queue link. `aria-current` marks the active filter, and the count
 *  is part of the label so the filter is never a colour-only state. */
export function AdminFilterLink({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm backdrop-blur-sm",
          "transition-colors duration-fast",
          active
            ? "border-accent-600/50 bg-accent-50 font-semibold text-accent-400 ring-1 ring-accent-600/20 ring-inset"
            : "border-white/12 bg-white/[0.05] font-medium text-ink-700 hover:border-white/18 hover:text-ink-900 hover:bg-white/[0.08]",
          focusRing,
        )}
      >
        {label}
        {typeof count === "number" ? (
          /*
           * Phase 24 (contrast): on the ACTIVE pill the count sits on the
           * accent-50 tint, where ink-500 measures 4.38:1 — just under AA for
           * 13px text. The active pill therefore uses the accent-700 "text on
           * soft" role (9.6:1); the inactive pill keeps ink-500 on white
           * (4.98:1). Same type, same size, only the role-correct colour.
           */
          <span
            className={`tabular-nums ${active ? "text-accent-400" : "text-ink-500"}`}
          >
            {count}
            <span className="sr-only"> ta</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}
