import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import {
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_RATE_LIMIT_PER_MINUTE,
  MESSAGES_PAGE_SIZE,
  conversationHref,
  enrollmentAllowsMessaging,
  type MessagingRole,
} from "@/lib/messaging";

/* -------------------------------------------------------------------------- */
/* Messaging service — Phase 16.                                               */
/*                                                                              */
/* All private-communication logic lives here. Server actions authenticate and  */
/* validate; route components only render what this module hands them. No       */
/* Drizzle in JSX.                                                              */
/*                                                                              */
/* THE FOUR RULES THIS MODULE EXISTS TO ENFORCE                                 */
/*                                                                              */
/* 1. PARTICIPANTS ARE DERIVED, NEVER ACCEPTED. Every query resolves the        */
/*    student from `enrollment_requests.student_user_id` and the teacher from   */
/*    `courses.teacher_user_id`, then compares them to the SESSION user. No     */
/*    function in this file takes a student id, a teacher id or a participant   */
/*    list, so there is nothing for a caller to forge.                          */
/*                                                                              */
/* 2. IF YOU ARE NOT A PARTICIPANT, THE CONVERSATION DOES NOT EXIST. Every      */
/*    refusal — wrong student, wrong teacher, unknown id, admin — returns the   */
/*    same `not_found` shape, so conversation ids cannot be probed.             */
/*                                                                              */
/* 3. WRITABILITY IS RE-DERIVED ON EVERY WRITE, INSIDE THE TRANSACTION. The     */
/*    composer is hidden for a cancelled enrollment, but the send path checks   */
/*    the enrollment status itself (row locked) — a replayed request, a stale   */
/*    page or a hand-made POST is refused server-side.                          */
/*                                                                              */
/* 4. READ STATE IS DERIVED FROM A MONOTONIC MARKER. `conversation_reads` holds */
/*    the newest message a participant has seen; unread is a tuple comparison,  */
/*    so a retry cannot double-count and a refresh cannot lose the position.    */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type EnrollmentStatus = (typeof schema.enrollmentStatus.enumValues)[number];

export type MessagingErrorCode =
  | "not_found"
  | "not_writable"
  | "invalid_body"
  | "rate_limited"
  | "server_error";

export type MessagingResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: MessagingErrorCode; message: string };

/* ------------------------------- projections ------------------------------- */

/** One row of the conversation list. Deliberately narrow: no phone, no email,
 *  no payment ids, no other enrollment of the same student. */
export interface ConversationSummary {
  id: string;
  enrollmentRequestId: string;
  enrollmentStatus: EnrollmentStatus;
  /** The OTHER participant's display name (never a phone number). */
  counterpartName: string;
  /** Public teacher profile slug — only when that profile is public. */
  counterpartPublicSlug: string | null;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
  updatedAt: Date;
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
}

/** Everything the conversation screen needs about the context it is showing. */
export interface ConversationContext {
  id: string;
  enrollmentRequestId: string;
  role: MessagingRole;
  enrollmentStatus: EnrollmentStatus;
  writable: boolean;
  counterpartName: string;
  counterpartPublicSlug: string | null;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
  createdAt: Date;
}

export interface MessageView {
  id: string;
  body: string;
  senderUserId: string;
  createdAt: Date;
  /** True when the SESSION user wrote it. */
  mine: boolean;
}

export interface MessagePage {
  /** Chronological (oldest → newest) — the shape the UI renders. */
  messages: MessageView[];
  /** True when message history continues before this page. */
  hasMore: boolean;
}

/* --------------------------------- helpers --------------------------------- */

/**
 * The participant predicate, written once.
 *
 * `me` is matched against BOTH derived participants, so the same expression
 * authorizes a student on their own thread and a teacher on theirs — and an
 * admin, who owns neither profile, matches nothing.
 */
function participantWhere(me: string) {
  return or(
    eq(schema.enrollmentRequests.studentUserId, me),
    eq(schema.courses.teacherUserId, me),
  );
}

const unreadCountSql = (me: string) => sql<number>`(
  select count(*)::int from messages m
  left join conversation_reads r
    on r.conversation_id = m.conversation_id and r.user_id = ${me}
  where m.conversation_id = ${schema.conversations.id}
    and m.sender_user_id <> ${me}
    and (
      r.last_read_message_id is null
      or (m.created_at, m.id) > (r.last_read_at, r.last_read_message_id)
    )
)`;

const lastMessageBodySql = sql<string | null>`(
  select m.body from messages m
  where m.conversation_id = ${schema.conversations.id}
  order by m.created_at desc, m.id desc
  limit 1
)`;

const lastMessageAtSql = sql<Date | null>`(
  select m.created_at from messages m
  where m.conversation_id = ${schema.conversations.id}
  order by m.created_at desc, m.id desc
  limit 1
)`;

/**
 * Both participants, resolved from the enrollment. Returned by every locked
 * read so callers reason about the SAME derivation the database does.
 */
interface ParticipantRow {
  conversationId: string;
  enrollmentRequestId: string;
  enrollmentStatus: EnrollmentStatus;
  studentUserId: string;
  studentName: string;
  teacherUserId: string;
  teacherName: string;
  teacherSlug: string;
  teacherIsPublic: boolean;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
  createdAt: Date;
}

/** Locks the conversation row and re-derives both participants. */
async function lockConversation(tx: Tx, conversationId: string): Promise<ParticipantRow | null> {
  const rows = await tx
    .select({
      conversationId: schema.conversations.id,
      enrollmentRequestId: schema.conversations.enrollmentRequestId,
      enrollmentStatus: schema.enrollmentRequests.status,
      studentUserId: schema.enrollmentRequests.studentUserId,
      studentName: schema.studentProfiles.name,
      teacherUserId: schema.courses.teacherUserId,
      teacherName: schema.teacherProfiles.name,
      teacherSlug: schema.teacherProfiles.slug,
      teacherIsPublic: schema.teacherProfiles.isPublic,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupTitle: schema.courseGroups.title,
      createdAt: schema.conversations.createdAt,
    })
    .from(schema.conversations)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.conversations.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(eq(schema.conversations.id, conversationId))
    // Serialises concurrent sends (and creation) for this one thread.
    .for("update", { of: schema.conversations })
    .limit(1);

  return rows[0] ?? null;
}

/* ---------------------------- conversation reads ---------------------------- */

/**
 * Conversations the SESSION user participates in, latest activity first.
 *
 * ONE function serves both dashboards on purpose: the participant predicate IS
 * the role, so a student can only ever match threads of their own enrollment
 * and a teacher only threads of their own courses. Two near-identical queries
 * would be two places to get that predicate wrong.
 */
export async function listConversations(me: string): Promise<ConversationSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.conversations.id,
      enrollmentRequestId: schema.conversations.enrollmentRequestId,
      enrollmentStatus: schema.enrollmentRequests.status,
      counterpartName: sql<string>`case
        when ${schema.enrollmentRequests.studentUserId} = ${me}
        then ${schema.teacherProfiles.name}
        else ${schema.studentProfiles.name}
      end`,
      counterpartPublicSlug: sql<string | null>`case
        when ${schema.enrollmentRequests.studentUserId} = ${me}
          and ${schema.teacherProfiles.isPublic} = true
        then ${schema.teacherProfiles.slug}
        else null
      end`,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupTitle: schema.courseGroups.title,
      updatedAt: schema.conversations.updatedAt,
      lastMessageBody: lastMessageBodySql,
      lastMessageAt: lastMessageAtSql,
      unreadCount: unreadCountSql(me),
    })
    .from(schema.conversations)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.conversations.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(participantWhere(me))
    .orderBy(desc(schema.conversations.updatedAt), desc(schema.conversations.id));

  return rows.map((row) => ({ ...row, unreadCount: Number(row.unreadCount) }));
}

/**
 * Unread MESSAGES across every conversation of the session user.
 *
 * Used by the two dashboard shells for the nav badge. Derived from the read
 * markers — never from a counter column, so it cannot drift.
 */
export async function countUnreadMessages(me: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.conversations.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .where(
      and(
        participantWhere(me),
        sql`${schema.messages.senderUserId} <> ${me}`,
        sql`not exists (
          select 1 from conversation_reads r
          where r.conversation_id = ${schema.conversations.id}
            and r.user_id = ${me}
            and (
              (${schema.messages.createdAt}, ${schema.messages.id})
                <= (r.last_read_at, r.last_read_message_id)
            )
        )`,
      ),
    );

  return Number(rows[0]?.total ?? 0);
}

/**
 * The conversation screen context, or null.
 *
 * Null covers EVERY refusal: unknown id, another student's thread, another
 * teacher's thread, an admin. The page renders a plain 404 for all of them.
 */
export async function getConversationForParticipant(
  conversationId: string,
  me: string,
): Promise<ConversationContext | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.conversations.id,
      enrollmentRequestId: schema.conversations.enrollmentRequestId,
      enrollmentStatus: schema.enrollmentRequests.status,
      studentUserId: schema.enrollmentRequests.studentUserId,
      studentName: schema.studentProfiles.name,
      teacherUserId: schema.courses.teacherUserId,
      teacherName: schema.teacherProfiles.name,
      teacherSlug: schema.teacherProfiles.slug,
      teacherIsPublic: schema.teacherProfiles.isPublic,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupTitle: schema.courseGroups.title,
      createdAt: schema.conversations.createdAt,
    })
    .from(schema.conversations)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.conversations.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(and(eq(schema.conversations.id, conversationId), participantWhere(me)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const isStudent = row.studentUserId === me;
  return {
    id: row.id,
    enrollmentRequestId: row.enrollmentRequestId,
    role: isStudent ? "student" : "teacher",
    enrollmentStatus: row.enrollmentStatus,
    writable: enrollmentAllowsMessaging(row.enrollmentStatus),
    counterpartName: isStudent ? row.teacherName : row.studentName,
    counterpartPublicSlug: isStudent && row.teacherIsPublic ? row.teacherSlug : null,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    groupTitle: row.groupTitle,
    createdAt: row.createdAt,
  };
}

/* --------------------------------- creation -------------------------------- */

/**
 * Get-or-create the thread for one enrollment request.
 *
 * Called by the "write to the teacher/student" button, so a conversation is
 * only ever born from a legitimate enrollment the caller participates in.
 * Creation requires an ACCEPTED request; an existing thread is returned for an
 * accepted OR cancelled one (cancelled threads stay readable).
 *
 * The enrollment row is locked first, which serialises two simultaneous opens
 * of the same request; the unique index is the second line of defence.
 */
export async function getOrCreateEnrollmentConversation(
  enrollmentRequestId: string,
  me: string,
): Promise<MessagingResult<{ conversationId: string; created: boolean; role: MessagingRole }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const enrollmentRows = await tx
        .select({
          id: schema.enrollmentRequests.id,
          status: schema.enrollmentRequests.status,
          studentUserId: schema.enrollmentRequests.studentUserId,
          teacherUserId: schema.courses.teacherUserId,
        })
        .from(schema.enrollmentRequests)
        .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
        .where(eq(schema.enrollmentRequests.id, enrollmentRequestId))
        .for("update", { of: schema.enrollmentRequests })
        .limit(1);

      const enrollment = enrollmentRows[0];
      // Not-a-participant and not-found are the SAME answer.
      if (!enrollment || (enrollment.studentUserId !== me && enrollment.teacherUserId !== me)) {
        return {
          ok: false as const,
          code: "not_found" as const,
          message: "Yozilish so‘rovi topilmadi.",
        };
      }

      const role: MessagingRole = enrollment.studentUserId === me ? "student" : "teacher";

      const existing = await tx
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.enrollmentRequestId, enrollmentRequestId))
        .limit(1);
      if (existing[0]) {
        return { ok: true as const, data: { conversationId: existing[0].id, created: false, role } };
      }

      // A NEW thread is only legitimate for an accepted place. Cancelled,
      // submitted and rejected requests cannot open messaging.
      if (!enrollmentAllowsMessaging(enrollment.status)) {
        return {
          ok: false as const,
          code: "not_writable" as const,
          message: "Suhbat faqat qabul qilingan yozilish uchun ochiladi.",
        };
      }

      const conversationId = newId("cnv");
      await tx
        .insert(schema.conversations)
        .values({ id: conversationId, enrollmentRequestId })
        .onConflictDoNothing({ target: schema.conversations.enrollmentRequestId });

      const created = await tx
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.enrollmentRequestId, enrollmentRequestId))
        .limit(1);

      return {
        ok: true as const,
        data: { conversationId: created[0]?.id ?? conversationId, created: true, role },
      };
    });
  } catch (error) {
    console.error("getOrCreateEnrollmentConversation failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Suhbatni ochib bo‘lmadi." };
  }
}

/* ---------------------------------- history -------------------------------- */

/**
 * ONE page of history, cursor-based.
 *
 * Newest page by default; `before` renders the page immediately older than a
 * given message (which must belong to this conversation — otherwise the cursor
 * is ignored rather than trusted). Ordering is `(created_at, id)` in both
 * directions, so tied timestamps still have exactly one deterministic order.
 */
export async function listMessages(
  conversationId: string,
  viewerUserId: string,
  options: { before?: string | null; limit?: number } = {},
): Promise<MessagePage> {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? MESSAGES_PAGE_SIZE, 1), 50);

  let cursor: { createdAt: Date; id: string } | null = null;
  if (options.before) {
    const cursorRows = await db
      .select({ id: schema.messages.id, createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.id, options.before),
          eq(schema.messages.conversationId, conversationId),
        ),
      )
      .limit(1);
    cursor = cursorRows[0] ?? null;
  }

  const rows = await db
    .select({
      id: schema.messages.id,
      body: schema.messages.body,
      senderUserId: schema.messages.senderUserId,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(
      cursor
        ? and(
            eq(schema.messages.conversationId, conversationId),
            sql`(${schema.messages.createdAt}, ${schema.messages.id}) < (${cursor.createdAt}, ${cursor.id})`,
          )
        : eq(schema.messages.conversationId, conversationId),
    )
    .orderBy(desc(schema.messages.createdAt), desc(schema.messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows
    .slice(0, limit)
    .reverse()
    .map((row) => ({ ...row, mine: row.senderUserId === viewerUserId }));
  return { messages: page, hasMore };
}

/* ---------------------------------- writes --------------------------------- */

/**
 * Send one message.
 *
 * Order, all inside one transaction:
 *   1. lock the conversation row;
 *   2. re-derive both participants and the enrollment status;
 *   3. refuse non-participants (as not-found) and non-accepted enrollments;
 *   4. enforce the per-sender minute budget;
 *   5. insert the immutable message and bump the thread's activity time;
 *   6. create ONE collapsed recipient notification.
 *
 * The recipient is `student XOR teacher`, so a sender can never notify
 * themselves, and the notification cannot describe a message that rolled back.
 */
export async function sendMessage(
  conversationId: string,
  senderUserId: string,
  rawBody: string,
): Promise<MessagingResult<{ messageId: string; createdAt: Date }>> {
  const db = getDb();

  const body = rawBody.replace(/\r\n/g, "\n").trim();
  if (body.length === 0 || body.length > MESSAGE_BODY_MAX_LENGTH) {
    return {
      ok: false,
      code: "invalid_body",
      message: `Xabar 1–${MESSAGE_BODY_MAX_LENGTH} belgidan iborat bo‘lsin.`,
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const thread = await lockConversation(tx, conversationId);
      if (!thread) {
        return {
          ok: false as const,
          code: "not_found" as const,
          message: "Suhbat topilmadi.",
        };
      }

      const isStudent = thread.studentUserId === senderUserId;
      const isTeacher = thread.teacherUserId === senderUserId;
      if (!isStudent && !isTeacher) {
        return {
          ok: false as const,
          code: "not_found" as const,
          message: "Suhbat topilmadi.",
        };
      }

      // Re-derived from the locked row: a cancelled enrollment is read-only
      // even if the page that submitted this request still showed a composer.
      if (!enrollmentAllowsMessaging(thread.enrollmentStatus)) {
        return {
          ok: false as const,
          code: "not_writable" as const,
          message: "Yozilish bekor qilingan. Suhbat faqat o‘qish rejimida.",
        };
      }

      const recent = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.senderUserId, senderUserId),
            sql`${schema.messages.createdAt} > now() - interval '1 minute'`,
          ),
        );
      if (Number(recent[0]?.total ?? 0) >= MESSAGE_RATE_LIMIT_PER_MINUTE) {
        return {
          ok: false as const,
          code: "rate_limited" as const,
          message: "Juda ko‘p xabar yuborildi. Bir daqiqadan so‘ng qayta urinib ko‘ring.",
        };
      }

      const messageId = newId("msg");
      const inserted = await tx
        .insert(schema.messages)
        .values({ id: messageId, conversationId, senderUserId, body })
        .returning();
      const createdAt = inserted[0]?.createdAt ?? new Date();

      await tx
        .update(schema.conversations)
        .set({ updatedAt: sql`now()` })
        .where(eq(schema.conversations.id, conversationId));

      /* ------------------------- collapsed notification ------------------------ */
      const recipientUserId = isStudent ? thread.teacherUserId : thread.studentUserId;
      const recipientRole: MessagingRole = isStudent ? "teacher" : "student";
      const href = conversationHref(recipientRole, conversationId);

      // SPAM CONTROL: at most ONE unread "new message" notification per
      // conversation. A twenty-message burst pings the bell once; the counter
      // that keeps moving is the unread badge, which is DB-derived.
      const already = await tx
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, recipientUserId),
            eq(schema.notifications.type, "message_received"),
            eq(schema.notifications.href, href),
            sql`${schema.notifications.readAt} is null`,
          ),
        )
        .limit(1);

      if (!already[0]) {
        const senderName = isStudent ? thread.studentName : thread.teacherName;
        await tx.insert(schema.notifications).values({
          id: newId("ntf"),
          userId: recipientUserId,
          type: "message_received",
          title: "Yangi xabar",
          body: `${senderName} · ${thread.courseTitle}`.slice(0, 500),
          href,
        });
      }

      return { ok: true as const, data: { messageId, createdAt } };
    });
  } catch (error) {
    console.error("sendMessage failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Xabarni yuborib bo‘lmadi." };
  }
}

/**
 * Advance the session user's read marker to one message they actually saw.
 *
 * MONOTONIC: the marker only ever moves forward, so a retry, a stale tab or a
 * double render cannot rewind it, and a message that arrives while the page is
 * being read stays unread (its tuple sorts strictly after the marker).
 * The message must belong to this conversation — enforced here AND by the
 * composite foreign key on `conversation_reads`.
 */
export async function markConversationRead(
  conversationId: string,
  me: string,
  lastMessageId: string,
): Promise<MessagingResult<{ advanced: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const thread = await lockConversation(tx, conversationId);
      if (!thread || (thread.studentUserId !== me && thread.teacherUserId !== me)) {
        return { ok: false as const, code: "not_found" as const, message: "Suhbat topilmadi." };
      }

      const markerRows = await tx
        .select({ id: schema.messages.id, createdAt: schema.messages.createdAt })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.id, lastMessageId),
            eq(schema.messages.conversationId, conversationId),
          ),
        )
        .limit(1);
      const marker = markerRows[0];
      if (!marker) {
        return { ok: false as const, code: "not_found" as const, message: "Xabar topilmadi." };
      }

      const existing = await tx
        .select({
          lastReadMessageId: schema.conversationReads.lastReadMessageId,
          lastReadAt: schema.conversationReads.lastReadAt,
        })
        .from(schema.conversationReads)
        .where(
          and(
            eq(schema.conversationReads.conversationId, conversationId),
            eq(schema.conversationReads.userId, me),
          ),
        )
        .limit(1);
      const current = existing[0];
      if (current) {
        const isNewer =
          marker.createdAt > current.lastReadAt ||
          (marker.createdAt.getTime() === current.lastReadAt.getTime() &&
            marker.id > current.lastReadMessageId);
        if (!isNewer) return { ok: true as const, data: { advanced: false } };
      }

      await tx
        .insert(schema.conversationReads)
        .values({
          conversationId,
          userId: me,
          lastReadMessageId: marker.id,
          lastReadAt: marker.createdAt,
        })
        .onConflictDoUpdate({
          target: [schema.conversationReads.conversationId, schema.conversationReads.userId],
          set: {
            lastReadMessageId: marker.id,
            lastReadAt: marker.createdAt,
            updatedAt: sql`now()`,
          },
          // Belt and braces for two simultaneous advances.
          setWhere: sql`(${schema.conversationReads.lastReadAt}, ${schema.conversationReads.lastReadMessageId}) < (${marker.createdAt}, ${marker.id})`,
        });

      return { ok: true as const, data: { advanced: true } };
    });
  } catch (error) {
    console.error("markConversationRead failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "O‘qilgan deb belgilab bo‘lmadi." };
  }
}
