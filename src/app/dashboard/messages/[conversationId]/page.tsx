import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui";
import { ConversationContextLine } from "@/components/messaging/conversation-list";
import { MessageBubble } from "@/components/messaging/messaging-ui";
import { MessageComposer } from "@/components/messaging/message-composer";
import { requireRolePage } from "@/server/auth/guards";
import {
  getConversationForParticipant,
  listMessages,
  markConversationRead,
} from "@/server/messaging-service";
import { MESSAGING_COPY } from "@/lib/messaging";
import { cn, focusRing } from "@/lib/utils";

export const metadata: Metadata = { title: "Suhbat" };

/* -------------------------------------------------------------------------- */
/* /dashboard/messages/[conversationId] — one thread, the student's side.       */
/*                                                                              */
/* AUTHORIZATION: `getConversationForParticipant` derives both participants in  */
/* SQL and returns null for anything else — another student's thread, a         */
/* teacher's thread opened from the student route, an unknown id — and null     */
/* becomes the shell's ordinary 404. The id alone is worthless.                 */
/*                                                                              */
/* HISTORY: one cursor page of at most 30 messages, newest page by default.     */
/* `?before=<messageId>` renders the page immediately older than that message;  */
/* the cursor is validated against THIS conversation and ignored if it is not   */
/* part of it. There is no "load everything" path and no client-side slicing.   */
/*                                                                              */
/* READ STATE: the marker is advanced to the newest message that was actually   */
/* rendered. The write is idempotent and monotonic (it can only ever move       */
/* forward), so rendering twice — which a server render may legitimately do —   */
/* cannot corrupt it, and a message that arrives while the page is open stays   */
/* unread until it is really seen.                                              */
/* -------------------------------------------------------------------------- */

export default async function StudentConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { conversationId } = await params;
  const { before } = await searchParams;
  const user = await requireRolePage("student", `/dashboard/messages/${conversationId}`);

  const context = await getConversationForParticipant(conversationId, user.id);
  // A teacher's own thread is not reachable from the student route.
  if (!context || context.role !== "student") notFound();

  const page = await listMessages(conversationId, user.id, { before });
  const newestRendered = page.messages[page.messages.length - 1];
  if (newestRendered) {
    await markConversationRead(conversationId, user.id, newestRendered.id);
  }

  const oldestRendered = page.messages[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/messages"
          className={cn(
            "inline-flex items-center gap-1 text-sm text-ink-500",
            "transition-colors duration-fast hover:text-ink-900",
            focusRing,
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Xabarlarga qaytish
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          {context.counterpartName} bilan suhbat
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={context.writable ? "success" : "neutral"}>
            {context.writable ? "Ochiq" : MESSAGING_COPY.readOnlyShort}
          </Badge>
        </div>
      </header>

      <section
        aria-labelledby="suhbat-mazmuni"
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-6"
      >
        <h2 id="suhbat-mazmuni" className="text-xl font-semibold text-ink-900">
          Suhbat tafsilotlari
        </h2>
        <ConversationContextLine
          counterpartName={context.counterpartName}
          counterpartPublicSlug={context.counterpartPublicSlug}
          courseTitle={context.courseTitle}
          courseSlug={context.courseSlug}
          groupTitle={context.groupTitle}
        />
      </section>

      <section
        id="xabarlar"
        tabIndex={-1}
        aria-labelledby="xabarlar-sarlavha"
        className="flex flex-col gap-4 outline-none"
      >
        <h2 id="xabarlar-sarlavha" className="text-xl font-semibold text-ink-900">
          Xabarlar
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {page.hasMore && oldestRendered ? (
            <Link
              href={`/dashboard/messages/${conversationId}?before=${oldestRendered.id}#xabarlar`}
              className="text-sm font-medium text-accent-700 underline underline-offset-2"
            >
              {MESSAGING_COPY.olderPage}
            </Link>
          ) : null}
          {before ? (
            <Link
              href={`/dashboard/messages/${conversationId}#xabarlar`}
              className="text-sm font-medium text-accent-700 underline underline-offset-2"
            >
              {MESSAGING_COPY.backToLatest}
            </Link>
          ) : null}
        </div>

        {page.messages.length === 0 ? (
          <p className="text-base text-ink-500">{MESSAGING_COPY.noMessagesYet}</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {page.messages.map((message) => (
              <MessageBubble key={message.id} message={message} counterpartName={context.counterpartName} />
            ))}
          </ol>
        )}
      </section>

      {context.writable ? (
        <section
          aria-labelledby="yozish"
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-6"
        >
          <h2 id="yozish" className="text-xl font-semibold text-ink-900">
            Xabar yozish
          </h2>
          <MessageComposer conversationId={conversationId} />
        </section>
      ) : (
        <p className="rounded-xl border border-line bg-surface-muted p-4 text-base leading-relaxed text-ink-700">
          {MESSAGING_COPY.readOnlyNotice}
        </p>
      )}
    </div>
  );
}
