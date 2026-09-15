import Link from "next/link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ButtonLink } from "@/components/ui";
import { ConversationRow } from "./messaging-ui";
import { MESSAGING_COPY, type MessagingRole } from "@/lib/messaging";
import type { ConversationSummary } from "@/server/messaging-service";

/* -------------------------------------------------------------------------- */
/* Conversation list — Phase 16. Server component.                              */
/*                                                                              */
/* Empty states explain the REAL rule (messaging opens after a teacher accepts)  */
/* instead of showing filler rows, and point at the one place the flow can       */
/* start: the enrollment request card.                                          */
/* -------------------------------------------------------------------------- */

export function ConversationList({
  summaries,
  role,
}: {
  summaries: ConversationSummary[];
  role: MessagingRole;
}) {
  if (summaries.length === 0) {
    return (
      <EmptyState title={role === "student" ? MESSAGING_COPY.studentEmpty : MESSAGING_COPY.teacherEmpty}>
        <p>{role === "student" ? MESSAGING_COPY.studentEmptyNote : MESSAGING_COPY.teacherEmptyNote}</p>
        <p className="mt-3">
          <ButtonLink
            href={role === "student" ? "/dashboard/courses" : "/teacher/dashboard/requests"}
            variant="outline"
            size="sm"
          >
            {role === "student" ? "So‘rovlarim" : "So‘rovlar"}
          </ButtonLink>
        </p>
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {summaries.map((summary) => (
        <ConversationRow key={summary.id} summary={summary} role={role} />
      ))}
    </ul>
  );
}

/** The "who is this" line at the top of a thread. */
export function ConversationContextLine({
  counterpartName,
  counterpartPublicSlug,
  courseTitle,
  courseSlug,
  groupTitle,
}: {
  counterpartName: string;
  counterpartPublicSlug: string | null;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
}) {
  return (
    <dl className="flex flex-col gap-1 text-sm text-ink-700">
      <div className="flex flex-wrap gap-1">
        <dt className="font-medium text-ink-900">Suhbatdosh:</dt>
        <dd>
          {counterpartPublicSlug ? (
            <Link
              href={`/teachers/${counterpartPublicSlug}`}
              className="text-accent-700 underline underline-offset-2"
            >
              {counterpartName}
            </Link>
          ) : (
            counterpartName
          )}
        </dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="font-medium text-ink-900">Kurs:</dt>
        <dd>
          <Link
            href={`/courses/${courseSlug}`}
            className="text-accent-700 underline underline-offset-2"
          >
            {courseTitle}
          </Link>
        </dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="font-medium text-ink-900">Guruh:</dt>
        <dd>{groupTitle}</dd>
      </div>
      <div className="flex flex-wrap gap-1">
        <dt className="font-medium text-ink-900">Maxfiylik:</dt>
        <dd>{MESSAGING_COPY.noPhoneNote}</dd>
      </div>
    </dl>
  );
}
