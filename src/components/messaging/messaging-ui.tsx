import Link from "next/link";
import { Badge } from "@/components/ui";
import { cn, focusRing } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { MESSAGING_COPY, messagePreview, type MessagingRole } from "@/lib/messaging";
import type { ConversationSummary, MessageView } from "@/server/messaging-service";

/* -------------------------------------------------------------------------- */
/* Messaging presentational pieces — Phase 16.                                  */
/*                                                                              */
/* SERVER components with no state. Dates are formatted on the server in a       */
/* fixed timezone (Asia/Tashkent) and rendered as text: a client-side formatter  */
/* would print a different string on hydration and shift the layout.             */
/*                                                                              */
/* NOTHING HERE IS A BUBBLE-CHAT GIMMICK. A conversation row is a real <a> with  */
/* the counterpart name, the course, the group, a one-line preview and — when    */
/* there are unseen messages — the words “N ta yangi xabar”. Unread is never     */
/* colour-only, phone numbers are never rendered, and there is no avatar stack,  */
/* no typing indicator and no read receipt.                                      */
/* -------------------------------------------------------------------------- */

const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});

/** "14 sen 2026, 09:30" — server-rendered, timezone-stable, no relative time. */
export function formatMessageTime(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function isoDateTime(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** One conversation in either dashboard's list. */
export function ConversationRow({
  summary,
  role,
}: {
  summary: ConversationSummary;
  role: MessagingRole;
}) {
  const readOnly = summary.enrollmentStatus === "cancelled";
  const href =
    role === "student"
      ? `/dashboard/messages/${summary.id}`
      : `/teacher/dashboard/messages/${summary.id}`;

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={href}
            className={cn(
              "text-base font-semibold text-ink-900 underline-offset-2 hover:underline",
              focusRing,
            )}
          >
            {summary.counterpartName}
          </Link>
          <p className="mt-0.5 text-sm text-ink-500">
            {summary.courseTitle} · {summary.groupTitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? (
            <Badge variant="neutral">{MESSAGING_COPY.readOnlyShort}</Badge>
          ) : null}
          {summary.unreadCount > 0 ? (
            // A WORD, not a red dot: the count survives greyscale and screen readers.
            <Badge variant="accent">
              {formatCount(summary.unreadCount)} ta yangi xabar
            </Badge>
          ) : null}
          <time
            dateTime={isoDateTime(summary.lastMessageAt ?? summary.updatedAt)}
            className="text-sm text-ink-500"
          >
            {formatMessageTime(summary.lastMessageAt ?? summary.updatedAt)}
          </time>
        </div>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-ink-700">
        {summary.lastMessageBody ? (
          messagePreview(summary.lastMessageBody)
        ) : (
          <span className="text-ink-500">{MESSAGING_COPY.noMessagesYet}</span>
        )}
      </p>
    </li>
  );
}

/** One message in the thread. Plain text in, plain text out. */
export function MessageBubble({
  message,
  counterpartName,
}: {
  message: MessageView;
  counterpartName: string;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3.5",
        message.mine ? "border-accent-100 bg-accent-50/60" : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">
          {message.mine ? "Siz" : counterpartName}
        </p>
        <time
          dateTime={isoDateTime(message.createdAt)}
          className="text-xs text-ink-500"
        >
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      {/*
        Plain text, escaped by React. `whitespace-pre-wrap` keeps the line breaks
        the author typed without ever interpreting markup, and `break-words`
        keeps a pasted URL from forcing a horizontal scrollbar at 390px.
      */}
      <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-ink-800">
        {message.body}
      </p>
    </li>
  );
}
