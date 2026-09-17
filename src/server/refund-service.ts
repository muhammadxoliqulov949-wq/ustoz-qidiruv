import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { recordAdminEvent } from "./audit-service";
import {
  COMPLETED_STATUS,
  LIVE_REFUND_STATUSES,
  REFUND_FEEDBACK_MAX_LENGTH,
  REFUND_REASON_MAX_LENGTH,
  REFUND_STATUS_NOTE,
  isLiveRefundStatus,
  refundEligibility,
  type RefundStatus,
} from "@/lib/refund";

/* -------------------------------------------------------------------------- */
/* Refund service — Phase 17.                                                  */
/*                                                                              */
/* The ONE place that decides what a refund is allowed to become. Pages and     */
/* server actions only call these functions; no Drizzle in JSX.                 */
/*                                                                              */
/* THE RULE THIS MODULE EXISTS TO ENFORCE                                       */
/*   Money is only "refunded" when the PROVIDER says it is.                     */
/*                                                                              */
/*   requested         student asked. Nothing has moved. Seat stays occupied.   */
/*   awaiting_provider an admin approved the policy decision. The merchant      */
/*                     operator still has to return the money in the Payme      */
/*                     merchant cabinet — the official documentation exposes NO */
/*                     outbound refund endpoint, so this wait is real.          */
/*   completed         an AUTHENTICATED `CancelTransaction` cancelled an        */
/*                     already PERFORMED provider transaction (state -2). The   */
/*                     enrollment becomes `cancelled` in the same transaction,  */
/*                     which releases the seat.                                 */
/*   rejected          an admin declined. Enrollment and seat are UNTOUCHED.    */
/*   failed            the provider operation genuinely failed, recorded by the */
/*                     merchant operator. Enrollment and seat are UNTOUCHED.    */
/*                                                                              */
/* There is deliberately NO function that completes a refund from a page, a     */
/* button or an admin action. The only writer of `completed` is                 */
/* `reconcileProviderRefund`, and it is only reached from the Payme adapter     */
/* after the provider's own cancelling call has been authenticated.             */
/*                                                                              */
/* CONCURRENCY                                                                  */
/* Every mutation locks the PAYMENT row (`SELECT … FOR UPDATE`) and re-reads     */
/* inside the transaction. The payment is the single financial resource here,   */
/* so it is the mutex: a student request, an admin decision, a second admin     */
/* decision and a provider callback all serialise on it. A partial unique index */
/* (`refund_requests_one_live_per_payment`) makes two live requests physically  */
/* impossible even if the lock is ever bypassed.                                */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type NotificationType = (typeof schema.notificationType.enumValues)[number];

export type RefundErrorCode =
  | "not_found"
  | "invalid_transition"
  | "not_eligible"
  | "unpaid"
  | "already_reversed"
  | "server_error";

export type RefundResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: RefundErrorCode; message: string };

/* ------------------------------- helpers ----------------------------------- */

async function notify(
  tx: Tx,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    href?: string;
  },
): Promise<void> {
  await tx.insert(schema.notifications).values({
    id: newId("ntf"),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    href: input.href ?? null,
  });
}

/** Append to the immutable refund history. Never an update, never a delete. */
async function recordRefundEvent(
  tx: Tx,
  input: {
    refundRequestId: string;
    /** NULL means the PROVIDER acted — see the schema comment. */
    actorUserId: string | null;
    type: (typeof schema.refundEventType.enumValues)[number];
    from: RefundStatus | null;
    to: RefundStatus;
    providerTransactionId?: string | null;
    reasonCode?: number | null;
    metadata?: string | null;
  },
): Promise<void> {
  await tx.insert(schema.refundEvents).values({
    id: newId("rev"),
    refundRequestId: input.refundRequestId,
    actorUserId: input.actorUserId,
    type: input.type,
    fromStatus: input.from,
    toStatus: input.to,
    providerTransactionId: input.providerTransactionId ?? null,
    reasonCode: input.reasonCode ?? null,
    metadata: input.metadata?.slice(0, 500) ?? null,
  });
}

/**
 * The payment's own history entry. The refusal to fake anything shows up here
 * too: a refund is recorded on the payment as `provider_refund_confirmed` only
 * from provider evidence.
 */
async function recordPaymentEvent(
  tx: Tx,
  input: { paymentId: string; providerTransactionId: string; reasonCode: number | null },
): Promise<void> {
  await tx.insert(schema.paymentEvents).values({
    id: newId("pev"),
    paymentId: input.paymentId,
    type: "provider_refund_confirmed",
    providerTransactionId: input.providerTransactionId,
    metadata:
      input.reasonCode === null ? "provider_state=-2" : `provider_state=-2,reason=${input.reasonCode}`,
  });
}

/** The payment row is the mutex for every financial transition of an enrollment. */
async function lockPayment(tx: Tx, paymentId: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`);
}

/** Everything a refund row needs from its payment + enrollment + course. */
interface RefundContext {
  paymentId: string;
  paymentStatus: (typeof schema.paymentStatus.enumValues)[number];
  amountTiyin: bigint;
  enrollmentRequestId: string;
  enrollmentStatus: (typeof schema.enrollmentStatus.enumValues)[number];
  studentUserId: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
  teacherUserId: string;
}

async function loadContext(tx: Tx, paymentId: string): Promise<RefundContext | null> {
  const rows = await tx
    .select({
      paymentId: schema.payments.id,
      paymentStatus: schema.payments.status,
      amountTiyin: schema.payments.amountTiyin,
      enrollmentRequestId: schema.enrollmentRequests.id,
      enrollmentStatus: schema.enrollmentRequests.status,
      studentUserId: schema.enrollmentRequests.studentUserId,
      studentName: schema.studentProfiles.name,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupTitle: schema.courseGroups.title,
      teacherUserId: schema.courses.teacherUserId,
    })
    .from(schema.payments)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.payments.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  const row = rows[0];
  return row ?? null;
}

/**
 * `enrollment_requests.status` → `cancelled`, with a NULL-actor event when the
 * PROVIDER caused it, and the teacher told that the place is free again.
 *
 * Seat release is implicit: occupancy is a COUNT of `accepted` rows, so moving
 * the row out of `accepted` frees the seat in the same transaction with no
 * counter to repair.
 */
async function cancelEnrollmentForRefund(
  tx: Tx,
  context: RefundContext,
  actor: { userId: string } | { system: true },
): Promise<boolean> {
  if (context.enrollmentStatus !== "accepted") return false;

  await tx
    .update(schema.enrollmentRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.enrollmentRequests.id, context.enrollmentRequestId));

  await tx.insert(schema.enrollmentEvents).values({
    id: newId("evt"),
    enrollmentRequestId: context.enrollmentRequestId,
    // NULL = no session user did this; the provider did. See schema comment.
    actorUserId: "userId" in actor ? actor.userId : null,
    fromStatus: "accepted",
    toStatus: "cancelled",
  });

  await notify(tx, {
    userId: context.teacherUserId,
    type: "refund_completed",
    title: "To‘lov qaytarildi — joy bo‘shadi",
    body: `${context.studentName} — ${context.courseTitle} (${context.groupTitle}). Guruhda joy bo‘shadi.`,
    href: "/teacher/dashboard/requests",
  });

  return true;
}

/* ------------------------------ student reads ------------------------------ */

export interface StudentRefundView {
  id: string;
  enrollmentRequestId: string;
  paymentId: string;
  status: RefundStatus;
  amountTiyin: bigint;
  reason: string;
  adminFeedback: string | null;
  systemInitiated: boolean;
  requestedAt: Date;
  reviewedAt: Date | null;
  completedAt: Date | null;
}

/**
 * A student's own refunds, newest first.
 *
 * The student id is part of the SQL predicate, so another student's refund id
 * does not resolve at all — the id leaks nothing.
 */
export async function listStudentRefunds(
  studentUserId: string,
  options: { paymentId?: string; enrollmentRequestId?: string } = {},
): Promise<StudentRefundView[]> {
  const db = getDb();
  const predicates = [eq(schema.refundRequests.studentUserId, studentUserId)];
  if (options.paymentId) predicates.push(eq(schema.refundRequests.paymentId, options.paymentId));
  if (options.enrollmentRequestId) {
    predicates.push(eq(schema.refundRequests.enrollmentRequestId, options.enrollmentRequestId));
  }

  return db
    .select({
      id: schema.refundRequests.id,
      enrollmentRequestId: schema.refundRequests.enrollmentRequestId,
      paymentId: schema.refundRequests.paymentId,
      status: schema.refundRequests.status,
      amountTiyin: schema.refundRequests.amountTiyin,
      reason: schema.refundRequests.reason,
      adminFeedback: schema.refundRequests.adminFeedback,
      systemInitiated: schema.refundRequests.systemInitiated,
      requestedAt: schema.refundRequests.requestedAt,
      reviewedAt: schema.refundRequests.reviewedAt,
      completedAt: schema.refundRequests.completedAt,
    })
    .from(schema.refundRequests)
    .where(and(...predicates))
    .orderBy(desc(schema.refundRequests.requestedAt));
}

export interface RefundEventView {
  id: string;
  type: (typeof schema.refundEventType.enumValues)[number];
  fromStatus: RefundStatus | null;
  toStatus: RefundStatus;
  actorUserId: string | null;
  /** TRUE when no session user caused the step — the provider did. */
  actorIsProvider: boolean;
  providerTransactionId: string | null;
  reasonCode: number | null;
  metadata: string | null;
  createdAt: Date;
}

async function listRefundEvents(tx: Tx | ReturnType<typeof getDb>, refundRequestId: string) {
  const rows = await tx
    .select({
      id: schema.refundEvents.id,
      type: schema.refundEvents.type,
      fromStatus: schema.refundEvents.fromStatus,
      toStatus: schema.refundEvents.toStatus,
      actorUserId: schema.refundEvents.actorUserId,
      providerTransactionId: schema.refundEvents.providerTransactionId,
      reasonCode: schema.refundEvents.reasonCode,
      metadata: schema.refundEvents.metadata,
      createdAt: schema.refundEvents.createdAt,
    })
    .from(schema.refundEvents)
    .where(eq(schema.refundEvents.refundRequestId, refundRequestId))
    .orderBy(asc(schema.refundEvents.createdAt), asc(schema.refundEvents.id));

  return rows.map((row) => ({ ...row, actorIsProvider: row.actorUserId === null })) as RefundEventView[];
}

/** One refund, scoped to its owner. Returns null for anybody else's id. */
export async function getRefundForStudent(
  refundRequestId: string,
  studentUserId: string,
): Promise<{ refund: StudentRefundView; events: RefundEventView[] } | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.refundRequests.id,
      enrollmentRequestId: schema.refundRequests.enrollmentRequestId,
      paymentId: schema.refundRequests.paymentId,
      status: schema.refundRequests.status,
      amountTiyin: schema.refundRequests.amountTiyin,
      reason: schema.refundRequests.reason,
      adminFeedback: schema.refundRequests.adminFeedback,
      systemInitiated: schema.refundRequests.systemInitiated,
      requestedAt: schema.refundRequests.requestedAt,
      reviewedAt: schema.refundRequests.reviewedAt,
      completedAt: schema.refundRequests.completedAt,
    })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.id, refundRequestId),
        eq(schema.refundRequests.studentUserId, studentUserId),
      ),
    )
    .limit(1);

  const refund = rows[0];
  if (!refund) return null;
  return { refund, events: await listRefundEvents(db, refundRequestId) };
}

/**
 * Refund state per enrollment, for the STUDENT's own dashboard cards.
 *
 * Ownership is in the predicate. The map value is a list because a rejected
 * attempt followed by a successful one is legitimate history: the card shows
 * the live attempt if there is one and otherwise the most recent outcome.
 */
export async function listStudentRefundsByEnrollment(
  enrollmentRequestIds: string[],
  studentUserId: string,
): Promise<Map<string, StudentRefundView[]>> {
  const out = new Map<string, StudentRefundView[]>();
  if (enrollmentRequestIds.length === 0) return out;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.refundRequests.id,
      enrollmentRequestId: schema.refundRequests.enrollmentRequestId,
      paymentId: schema.refundRequests.paymentId,
      status: schema.refundRequests.status,
      amountTiyin: schema.refundRequests.amountTiyin,
      reason: schema.refundRequests.reason,
      adminFeedback: schema.refundRequests.adminFeedback,
      systemInitiated: schema.refundRequests.systemInitiated,
      requestedAt: schema.refundRequests.requestedAt,
      reviewedAt: schema.refundRequests.reviewedAt,
      completedAt: schema.refundRequests.completedAt,
    })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.studentUserId, studentUserId),
        inArray(schema.refundRequests.enrollmentRequestId, enrollmentRequestIds),
      ),
    )
    .orderBy(desc(schema.refundRequests.requestedAt));

  for (const row of rows) {
    const list = out.get(row.enrollmentRequestId) ?? [];
    list.push(row);
    out.set(row.enrollmentRequestId, list);
  }
  return out;
}

/**
 * TEACHER projection (read-only, minimal): the refund status of enrollments in
 * courses the teacher owns, and nothing else.
 *
 * The join to `courses.teacher_user_id` is the authorization, so a teacher
 * cannot ask about somebody else's enrollment even by guessing its id. No
 * amount, no payment id, no provider transaction id is returned — a teacher has
 * nothing to act on here.
 */
export async function getTeacherRefundStates(
  enrollmentRequestIds: string[],
  teacherUserId: string,
): Promise<Map<string, RefundStatus>> {
  const out = new Map<string, RefundStatus>();
  if (enrollmentRequestIds.length === 0) return out;

  const db = getDb();
  const rows = await db
    .select({
      enrollmentRequestId: schema.refundRequests.enrollmentRequestId,
      status: schema.refundRequests.status,
      requestedAt: schema.refundRequests.requestedAt,
    })
    .from(schema.refundRequests)
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.refundRequests.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .where(
      and(
        eq(schema.courses.teacherUserId, teacherUserId),
        inArray(schema.refundRequests.enrollmentRequestId, enrollmentRequestIds),
      ),
    )
    .orderBy(desc(schema.refundRequests.requestedAt));

  for (const row of rows) {
    if (!out.has(row.enrollmentRequestId)) out.set(row.enrollmentRequestId, row.status);
  }
  return out;
}

/* -------------------------------- eligibility ------------------------------- */

export interface RefundEligibilityView {
  eligible: boolean;
  reason: string | null;
  paymentId: string | null;
  amountTiyin: bigint | null;
  liveRefundId: string | null;
  liveRefundStatus: RefundStatus | null;
}

/**
 * "May this student ask for their money back?" — the same pure rule the UI uses
 * (`lib/refund.ts`), evaluated against the database for one enrollment.
 */
export async function getRefundEligibility(
  enrollmentRequestId: string,
  studentUserId: string,
): Promise<RefundEligibilityView> {
  const db = getDb();
  const rows = await db
    .select({
      status: schema.enrollmentRequests.status,
      priceUzs: schema.courses.priceUzs,
      paymentId: schema.payments.id,
      paymentStatus: schema.payments.status,
      amountTiyin: schema.payments.amountTiyin,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .leftJoin(
      schema.payments,
      eq(schema.payments.enrollmentRequestId, schema.enrollmentRequests.id),
    )
    .where(
      and(
        eq(schema.enrollmentRequests.id, enrollmentRequestId),
        eq(schema.enrollmentRequests.studentUserId, studentUserId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      eligible: false,
      reason: null,
      paymentId: null,
      amountTiyin: null,
      liveRefundId: null,
      liveRefundStatus: null,
    };
  }

  const live = row.paymentId
    ? (await listStudentRefunds(studentUserId, { paymentId: row.paymentId })).find((refund) =>
        isLiveRefundStatus(refund.status),
      )
    : undefined;

  const verdict = refundEligibility({
    enrollmentStatus: row.status,
    coursePriceUzs: row.priceUzs,
    paymentStatus: row.paymentStatus,
    hasLiveRefund: Boolean(live),
  });

  return {
    eligible: verdict.eligible,
    reason: verdict.eligible ? null : verdict.reason,
    paymentId: row.paymentId,
    amountTiyin: row.amountTiyin,
    liveRefundId: live?.id ?? null,
    liveRefundStatus: live?.status ?? null,
  };
}

/* ------------------------------- student write ------------------------------ */

/**
 * Request a FULL refund of a paid place.
 *
 * Idempotent by design: a repeat submission while a request is live returns the
 * existing request instead of creating a second one, so a double-click, a
 * retried form POST or an impatient second attempt cannot produce two logical
 * requests. The partial unique index makes the same guarantee at the storage
 * layer, which is what actually protects against two simultaneous submissions.
 */
export async function requestRefund(input: {
  enrollmentRequestId: string;
  studentUserId: string;
  reason: string;
}): Promise<RefundResult<{ refundRequestId: string; created: boolean; status: RefundStatus }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      // Ownership AND existence in one predicate: somebody else's enrollment
      // simply does not resolve, so no id can be probed for existence.
      const rows = await tx
        .select({ id: schema.enrollmentRequests.id, paymentId: schema.payments.id })
        .from(schema.enrollmentRequests)
        .leftJoin(
          schema.payments,
          and(
            eq(schema.payments.enrollmentRequestId, schema.enrollmentRequests.id),
            inArray(schema.payments.status, ["pending", "succeeded"]),
          ),
        )
        .where(
          and(
            eq(schema.enrollmentRequests.id, input.enrollmentRequestId),
            eq(schema.enrollmentRequests.studentUserId, input.studentUserId),
          ),
        )
        .limit(1);

      const target = rows[0];
      if (!target) return { ok: false as const, code: "not_found" as const, message: "Yozilish topilmadi." };
      if (!target.paymentId) {
        return {
          ok: false as const,
          code: "unpaid" as const,
          message: "Bu yozilish uchun to‘langan to‘lov topilmadi.",
        };
      }

      // The mutex for this enrollment's money.
      await lockPayment(tx, target.paymentId);
      const context = await loadContext(tx, target.paymentId);
      if (!context) {
        return { ok: false as const, code: "not_found" as const, message: "To‘lov topilmadi." };
      }

      const verdict = refundEligibility({
        enrollmentStatus: context.enrollmentStatus,
        coursePriceUzs: Number(context.amountTiyin),
        paymentStatus: context.paymentStatus,
        hasLiveRefund: false,
      });

      // A live request already exists → return it (idempotent repeat).
      const live = await tx
        .select({ id: schema.refundRequests.id, status: schema.refundRequests.status })
        .from(schema.refundRequests)
        .where(
          and(
            eq(schema.refundRequests.paymentId, context.paymentId),
            inArray(schema.refundRequests.status, [...LIVE_REFUND_STATUSES]),
          ),
        )
        .limit(1);
      if (live[0]) {
        return {
          ok: true as const,
          data: { refundRequestId: live[0].id, created: false, status: live[0].status },
        };
      }

      if (context.enrollmentStatus !== "accepted") {
        return { ok: false as const, code: "not_eligible" as const, message: verdict.eligible ? "Yozilish holati mos emas." : (verdict.reason ?? "") };
      }
      if (context.paymentStatus !== "succeeded") {
        return {
          ok: false as const,
          code: "unpaid" as const,
          message: "To‘lov hali tasdiqlanmagan — qaytarish so‘rovi faqat to‘langan yozilish uchun.",
        };
      }
      if (context.amountTiyin <= BigInt(0)) {
        return { ok: false as const, code: "not_eligible" as const, message: "Kurs bepul — qaytarish uchun to‘lov yo‘q." };
      }

      const refundRequestId = newId("rfd");
      const reason = input.reason.trim().slice(0, REFUND_REASON_MAX_LENGTH);
      const now = new Date();

      await tx.insert(schema.refundRequests).values({
        id: refundRequestId,
        paymentId: context.paymentId,
        enrollmentRequestId: context.enrollmentRequestId,
        studentUserId: context.studentUserId,
        // FULL refund, from the payment's IMMUTABLE snapshot — never from input.
        amountTiyin: context.amountTiyin,
        status: "requested",
        reason,
        requestedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await recordRefundEvent(tx, {
        refundRequestId,
        actorUserId: context.studentUserId,
        type: "requested",
        from: null,
        to: "requested",
        metadata: "full_refund",
      });

      // A receipt, so the student can find what they asked for later. This is
      // NOT a promise that the money is coming back.
      await notify(tx, {
        userId: context.studentUserId,
        type: "refund_requested",
        title: "Pulni qaytarish so‘rovi qabul qilindi",
        body: `${context.courseTitle} (${context.groupTitle}). So‘rov administrator ko‘rib chiqadi.`,
        href: "/dashboard/courses",
      });

      return {
        ok: true as const,
        data: { refundRequestId, created: true, status: "requested" as RefundStatus },
      };
    });
  } catch (error) {
    /*
     * Phase 22: the unique index is the last line of defence — two
     * simultaneous requests reach the INSERT and exactly one wins. The loser
     * re-reads the winner's live row (same pattern as payment initiation) so
     * a double-click answers with the request that exists rather than with
     * a failure. The lookup is ownership-checked: the enrollment id and the
     * session student id are both in the predicate.
     */
    if ((error as { code?: string }).code === "23505") {
      const winner = await db
        .select({ id: schema.refundRequests.id, status: schema.refundRequests.status })
        .from(schema.refundRequests)
        .where(
          and(
            eq(schema.refundRequests.enrollmentRequestId, input.enrollmentRequestId),
            eq(schema.refundRequests.studentUserId, input.studentUserId),
            inArray(schema.refundRequests.status, [...LIVE_REFUND_STATUSES]),
          ),
        )
        .limit(1);
      if (winner[0]) {
        return {
          ok: true as const,
          data: {
            refundRequestId: winner[0].id,
            created: false,
            status: winner[0].status as RefundStatus,
          },
        };
      }
    }
    console.error("requestRefund failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return {
      ok: false as const,
      code: "server_error" as const,
      message: "So‘rovni yuborib bo‘lmadi. Qayta urinib ko‘ring.",
    };
  }
}

/* -------------------------------- admin reads ------------------------------- */

export interface AdminRefundRow {
  id: string;
  status: RefundStatus;
  amountTiyin: bigint;
  reason: string;
  adminFeedback: string | null;
  systemInitiated: boolean;
  requestedAt: Date;
  reviewedAt: Date | null;
  completedAt: Date | null;
  studentUserId: string;
  studentName: string;
  courseTitle: string;
  courseSlug: string;
  groupTitle: string;
  teacherUserId: string;
  paymentId: string;
  paymentStatus: (typeof schema.paymentStatus.enumValues)[number];
  providerTransactionId: string | null;
}

const ADMIN_REFUND_COLUMNS = {
  id: schema.refundRequests.id,
  status: schema.refundRequests.status,
  amountTiyin: schema.refundRequests.amountTiyin,
  reason: schema.refundRequests.reason,
  adminFeedback: schema.refundRequests.adminFeedback,
  systemInitiated: schema.refundRequests.systemInitiated,
  requestedAt: schema.refundRequests.requestedAt,
  reviewedAt: schema.refundRequests.reviewedAt,
  completedAt: schema.refundRequests.completedAt,
  studentUserId: schema.refundRequests.studentUserId,
  studentName: schema.studentProfiles.name,
  courseTitle: schema.courses.title,
  courseSlug: schema.courses.slug,
  groupTitle: schema.courseGroups.title,
  teacherUserId: schema.courses.teacherUserId,
  paymentId: schema.refundRequests.paymentId,
  paymentStatus: schema.payments.status,
  providerTransactionId: schema.refundRequests.providerTransactionId,
} as const;

function adminRefundQuery() {
  const db = getDb();
  return db
    .select(ADMIN_REFUND_COLUMNS)
    .from(schema.refundRequests)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.refundRequests.paymentId))
    .innerJoin(
      schema.enrollmentRequests,
      eq(schema.enrollmentRequests.id, schema.refundRequests.enrollmentRequestId),
    )
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.refundRequests.studentUserId),
    );
}

/**
 * The refund queue.
 *
 * ORDER: live work first (`requested` before `awaiting_provider`), then history
 * newest-first. The ordering is applied in SQL, never by sorting a rendered
 * array, so the queue cannot disagree with itself between renders.
 *
 * `statuses` accepts a SET because "live" is two statuses, and the default view
 * of the queue is the work that is actually waiting — not the whole history.
 */
export async function listAdminRefunds(
  options: { status?: RefundStatus; statuses?: readonly RefundStatus[]; limit?: number; offset?: number } = {},
): Promise<AdminRefundRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const query = adminRefundQuery();
  const where = options.statuses
    ? inArray(schema.refundRequests.status, [...options.statuses])
    : options.status
      ? eq(schema.refundRequests.status, options.status)
      : undefined;

  const rows = await (where ? query.where(where) : query).orderBy(
    sql`CASE ${schema.refundRequests.status}
          WHEN 'requested' THEN 0
          WHEN 'awaiting_provider' THEN 1
          WHEN 'failed' THEN 2
          ELSE 3 END`,
    desc(schema.refundRequests.requestedAt),
    desc(schema.refundRequests.id),
  ).limit(limit).offset(offset);
  return rows;
}

export async function getRefundQueueCounts(): Promise<Record<RefundStatus | "live" | "all", number>> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.refundRequests.status, total: count(schema.refundRequests.id) })
    .from(schema.refundRequests)
    .groupBy(schema.refundRequests.status);

  const counts: Record<RefundStatus | "live" | "all", number> = {
    requested: 0,
    awaiting_provider: 0,
    completed: 0,
    rejected: 0,
    failed: 0,
    live: 0,
    all: 0,
  };
  for (const row of rows) {
    counts[row.status] = Number(row.total);
    counts.all += Number(row.total);
    if (isLiveRefundStatus(row.status)) counts.live += Number(row.total);
  }
  return counts;
}

export interface AdminRefundDetail {
  refund: AdminRefundRow;
  events: RefundEventView[];
  /** Provider transaction facts, when one is attached. Never credentials. */
  providerTransaction: {
    id: string;
    state: number;
    reasonCode: number | null;
    performedAt: bigint | null;
    cancelledAt: bigint | null;
  } | null;
  payment: {
    id: string;
    status: (typeof schema.paymentStatus.enumValues)[number];
    amountTiyin: bigint;
    currency: string;
    createdAt: Date;
    paidAt: Date | null;
    provider: (typeof schema.paymentProvider.enumValues)[number];
  };
}

/** One refund with everything an administrator needs to decide, and no secrets. */
export async function getRefundForAdmin(refundRequestId: string): Promise<AdminRefundDetail | null> {
  const db = getDb();
  const rows = await adminRefundQuery()
    .where(eq(schema.refundRequests.id, refundRequestId))
    .limit(1);
  const refund = rows[0];
  if (!refund) return null;

  const paymentRows = await db
    .select({
      id: schema.payments.id,
      status: schema.payments.status,
      amountTiyin: schema.payments.amountTiyin,
      currency: schema.payments.currency,
      createdAt: schema.payments.createdAt,
      paidAt: schema.payments.paidAt,
      provider: schema.payments.provider,
    })
    .from(schema.payments)
    .where(eq(schema.payments.id, refund.paymentId))
    .limit(1);

  const transactionRows = await db
    .select({
      id: schema.paymentTransactions.providerTransactionId,
      state: schema.paymentTransactions.state,
      reasonCode: schema.paymentTransactions.reasonCode,
      performedAt: schema.paymentTransactions.performedAt,
      cancelledAt: schema.paymentTransactions.cancelledAt,
    })
    .from(schema.paymentTransactions)
    .where(eq(schema.paymentTransactions.paymentId, refund.paymentId))
    .orderBy(desc(schema.paymentTransactions.createdAt));

  return {
    refund,
    events: await listRefundEvents(db, refundRequestId),
    providerTransaction: transactionRows[0] ?? null,
    payment: paymentRows[0]!,
  };
}

/* ------------------------------- admin writes ------------------------------- */

/**
 * Approve the policy decision.
 *
 * This is NOT completion, and the wording everywhere says so: the money is still
 * with the provider. The enrollment stays `accepted`, the seat stays occupied and
 * messaging stays writable. The provider offers no outbound refund endpoint, so
 * the merchant operator performs the actual refund in the Payme merchant cabinet
 * and the authenticated `CancelTransaction` callback finalises it.
 */
export async function approveRefund(input: {
  refundRequestId: string;
  adminUserId: string;
}): Promise<RefundResult<{ status: RefundStatus }>> {
  return decide(input.refundRequestId, input.adminUserId, async (tx, current, context) => {
    if (current.status !== "requested") {
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Bu so‘rov allaqachon ko‘rib chiqilgan.",
      };
    }
    // Re-verified inside the lock: a payment that was reversed while this admin
    // was reading the page must not be approved as if nothing happened.
    if (context.enrollmentStatus !== "accepted") {
      return {
        ok: false as const,
        code: "not_eligible" as const,
        message: "Yozilish endi qabul qilingan holatda emas.",
      };
    }
    if (context.paymentStatus !== "succeeded") {
      return {
        ok: false as const,
        code: "unpaid" as const,
        message: "To‘lov endi tasdiqlangan holatda emas.",
      };
    }

    const now = new Date();
    await tx
      .update(schema.refundRequests)
      .set({
        status: "awaiting_provider",
        reviewedByAdminUserId: input.adminUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.refundRequests.id, current.id));

    await recordRefundEvent(tx, {
      refundRequestId: current.id,
      actorUserId: input.adminUserId,
      type: "approved",
      from: "requested",
      to: "awaiting_provider",
      metadata: "manual_provider_operation_required",
    });

    await recordAdminEvent(tx, {
      adminUserId: input.adminUserId,
      action: "refund_approved",
      entityType: "refund",
      entityId: current.id,
      metadata: "status=awaiting_provider",
    });

    await notify(tx, {
      userId: current.studentUserId,
      type: "refund_approved",
      title: "Pulni qaytarish so‘rovi tasdiqlandi",
      body: `${context.courseTitle} (${context.groupTitle}). Pul qaytarilishi provayder orqali yakunlanadi.`,
      href: "/dashboard/courses",
    });

    return { ok: true as const, data: { status: "awaiting_provider" as RefundStatus } };
  });
}

/**
 * Decline the request. The student keeps their place and their money stays with
 * the course — nothing about the enrollment or the payment changes, which is
 * exactly why the student gets a required explanation.
 */
export async function rejectRefund(input: {
  refundRequestId: string;
  adminUserId: string;
  feedback: string;
}): Promise<RefundResult<{ status: RefundStatus }>> {
  return decide(input.refundRequestId, input.adminUserId, async (tx, current, context) => {
    if (current.status !== "requested") {
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Bu so‘rov allaqachon ko‘rib chiqilgan.",
      };
    }
    const feedback = input.feedback.trim().slice(0, REFUND_FEEDBACK_MAX_LENGTH);
    if (feedback.length === 0) {
      return { ok: false as const, code: "invalid_transition" as const, message: "Izoh majburiy." };
    }

    const now = new Date();
    await tx
      .update(schema.refundRequests)
      .set({
        status: "rejected",
        adminFeedback: feedback,
        reviewedByAdminUserId: input.adminUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.refundRequests.id, current.id));

    await recordRefundEvent(tx, {
      refundRequestId: current.id,
      actorUserId: input.adminUserId,
      type: "rejected",
      from: "requested",
      to: "rejected",
    });

    await recordAdminEvent(tx, {
      adminUserId: input.adminUserId,
      action: "refund_rejected",
      entityType: "refund",
      entityId: current.id,
      metadata: "status=rejected",
    });

    await notify(tx, {
      userId: current.studentUserId,
      type: "refund_rejected",
      title: "Pulni qaytarish so‘rovi rad etildi",
      body: `${context.courseTitle} (${context.groupTitle}). Izoh: ${feedback}`,
      href: "/dashboard/courses",
    });

    return { ok: true as const, data: { status: "rejected" as RefundStatus } };
  });
}

/**
 * Record that the provider operation genuinely FAILED (declined card, closed
 * card, provider-side error). Only legal from `awaiting_provider`, because an
 * operation that was never approved cannot have failed.
 *
 * The enrollment stays `accepted` and the seat stays occupied. Nothing is
 * cancelled "because the refund failed" — that would take the student's money
 * AND their place.
 */
export async function recordRefundFailure(input: {
  refundRequestId: string;
  adminUserId: string;
  feedback: string;
}): Promise<RefundResult<{ status: RefundStatus }>> {
  return decide(input.refundRequestId, input.adminUserId, async (tx, current, context) => {
    if (current.status !== "awaiting_provider") {
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Faqat provayderga yuborilgan so‘rov uchun natijani qayd etish mumkin.",
      };
    }
    const feedback = input.feedback.trim().slice(0, REFUND_FEEDBACK_MAX_LENGTH);
    if (feedback.length === 0) {
      return { ok: false as const, code: "invalid_transition" as const, message: "Izoh majburiy." };
    }

    const now = new Date();
    await tx
      .update(schema.refundRequests)
      .set({
        status: "failed",
        adminFeedback: feedback,
        reviewedByAdminUserId: input.adminUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.refundRequests.id, current.id));

    await recordRefundEvent(tx, {
      refundRequestId: current.id,
      actorUserId: input.adminUserId,
      type: "provider_refund_failed",
      from: "awaiting_provider",
      to: "failed",
    });

    await recordAdminEvent(tx, {
      adminUserId: input.adminUserId,
      action: "refund_failed",
      entityType: "refund",
      entityId: current.id,
      metadata: "status=failed",
    });

    await notify(tx, {
      userId: current.studentUserId,
      type: "refund_failed",
      title: "Pulni qaytarish amalga oshmadi",
      body: `${context.courseTitle} (${context.groupTitle}). Sabab: ${feedback}`,
      href: "/dashboard/courses",
    });

    return { ok: true as const, data: { status: "failed" as RefundStatus } };
  });
}

/**
 * Shared skeleton for an admin decision: lock the payment, re-read the refund
 * and the surrounding facts INSIDE the lock, then let the caller decide.
 *
 * Two admins acting at the same time therefore serialise: the first commits a
 * decision, the second re-reads a row that is no longer `requested` and gets a
 * typed refusal instead of overwriting it.
 */
async function decide(
  refundRequestId: string,
  adminUserId: string,
  handler: (
    tx: Tx,
    current: { id: string; status: RefundStatus; studentUserId: string },
    context: RefundContext,
  ) => Promise<RefundResult<{ status: RefundStatus }>>,
): Promise<RefundResult<{ status: RefundStatus }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: schema.refundRequests.id,
          status: schema.refundRequests.status,
          paymentId: schema.refundRequests.paymentId,
          studentUserId: schema.refundRequests.studentUserId,
        })
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, refundRequestId))
        .limit(1);
      const current = rows[0];
      if (!current) {
        return { ok: false as const, code: "not_found" as const, message: "So‘rov topilmadi." };
      }

      await lockPayment(tx, current.paymentId);
      const context = await loadContext(tx, current.paymentId);
      if (!context) {
        return { ok: false as const, code: "not_found" as const, message: "To‘lov topilmadi." };
      }

      // Re-read AFTER the lock: this is the state the decision applies to.
      const fresh = await tx
        .select({ status: schema.refundRequests.status })
        .from(schema.refundRequests)
        .where(eq(schema.refundRequests.id, refundRequestId))
        .limit(1);
      const status = fresh[0]!.status;

      return handler(
        tx,
        { id: current.id, status, studentUserId: current.studentUserId },
        context,
      );
    });
  } catch (error) {
    console.error("refund decision failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false as const, code: "server_error" as const, message: "Amalni bajarib bo‘lmadi." };
  }
}

/* --------------------------- provider reconciliation ------------------------ */

export type ReconcileOutcome =
  | "completed_existing_request"
  | "recorded_unsolicited_reversal"
  | "already_reconciled"
  | "not_a_refund";

export interface ReconcileResult {
  ok: true;
  outcome: ReconcileOutcome;
  refundRequestId: string | null;
}

/** The reason stored on a refund row the application itself did not ask for. */
export const SYSTEM_REVERSAL_REASON =
  "Provayder to‘lovni qaytardi (ilova orqali so‘ralmagan).";

/**
 * The ONLY writer of `completed`.
 *
 * Called by the Payme adapter after an AUTHENTICATED `CancelTransaction` that
 * cancelled an already PERFORMED transaction — i.e. money that had arrived and
 * has now been reversed at the provider. This is a genuine refund signal, and
 * the adapter maps the provider event onto the domain event
 * `provider_refund_confirmed` (a future CLICK adapter emits the same event; see
 * README).
 *
 * Two shapes of truth are handled:
 *   • a live request exists → it becomes `completed`, on the provider's
 *     authority, and the enrollment is cancelled (seat released);
 *   • NOBODY asked → the reversal is still recorded, as a `system_initiated`
 *     completed refund. Money that moved back is a fact; dropping it because no
 *     request exists would leave a paid-and-reversed enrollment looking paid.
 *
 * Idempotent: a retried callback finds an already-completed reconciliation for
 * this provider transaction and changes nothing.
 */
export async function reconcileProviderRefund(
  input: {
    providerTransactionId: string;
    reasonCode: number | null;
    cancelledAtMs: number;
  },
  tx?: Tx,
): Promise<ReconcileResult> {
  if (tx) return reconcileInner(tx, input);
  const db = getDb();
  return db.transaction(async (inner) => reconcileInner(inner, input));
}

async function reconcileInner(
  tx: Tx,
  input: { providerTransactionId: string; reasonCode: number | null; cancelledAtMs: number },
): Promise<ReconcileResult> {
  const transactionRows = await tx
    .select({
      paymentId: schema.paymentTransactions.paymentId,
      state: schema.paymentTransactions.state,
    })
    .from(schema.paymentTransactions)
    .where(eq(schema.paymentTransactions.providerTransactionId, input.providerTransactionId))
    .limit(1);
  const transaction = transactionRows[0];
  if (!transaction) {
    return { ok: true, outcome: "not_a_refund", refundRequestId: null };
  }

  await lockPayment(tx, transaction.paymentId);
  const context = await loadContext(tx, transaction.paymentId);
  if (!context) {
    return { ok: true, outcome: "not_a_refund", refundRequestId: null };
  }

  /*
   * Only a performed-then-cancelled transaction is a refund. A transaction that
   * was cancelled while still created (state -1) never moved money — that is a
   * failed payment attempt, and Phase 14's behaviour for it is unchanged. The
   * state is re-read inside the lock rather than trusted from the caller.
   */
  const state = await tx
    .select({ state: schema.paymentTransactions.state })
    .from(schema.paymentTransactions)
    .where(eq(schema.paymentTransactions.providerTransactionId, input.providerTransactionId))
    .limit(1);
  if (state[0]?.state !== -2) {
    return { ok: true, outcome: "not_a_refund", refundRequestId: null };
  }

  const completedAt = new Date(input.cancelledAtMs);

  // Idempotency: this provider transaction has already been reconciled.
  const already = await tx
    .select({ id: schema.refundRequests.id })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.paymentId, context.paymentId),
        eq(schema.refundRequests.providerTransactionId, input.providerTransactionId),
        eq(schema.refundRequests.status, COMPLETED_STATUS),
      ),
    )
    .limit(1);
  if (already[0]) {
    return { ok: true, outcome: "already_reconciled", refundRequestId: already[0].id };
  }

  const live = await tx
    .select({ id: schema.refundRequests.id, status: schema.refundRequests.status })
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.paymentId, context.paymentId),
        inArray(schema.refundRequests.status, [...LIVE_REFUND_STATUSES]),
      ),
    )
    .limit(1);

  const active = live[0];
  const refundRequestId = active?.id ?? newId("rfd");

  if (active) {
    await tx
      .update(schema.refundRequests)
      .set({
        status: COMPLETED_STATUS,
        completedAt,
        providerTransactionId: input.providerTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(schema.refundRequests.id, refundRequestId));

    await recordRefundEvent(tx, {
      refundRequestId,
      actorUserId: null,
      type: "provider_refund_completed",
      from: active.status,
      to: COMPLETED_STATUS,
      providerTransactionId: input.providerTransactionId,
      reasonCode: input.reasonCode,
      metadata: "provider_state=-2",
    });
  } else {
    // Nobody asked for this one. Financial truth still gets recorded.
    const now = new Date();
    await tx.insert(schema.refundRequests).values({
      id: refundRequestId,
      paymentId: context.paymentId,
      enrollmentRequestId: context.enrollmentRequestId,
      studentUserId: context.studentUserId,
      providerTransactionId: input.providerTransactionId,
      status: COMPLETED_STATUS,
      amountTiyin: context.amountTiyin,
      reason: SYSTEM_REVERSAL_REASON,
      systemInitiated: true,
      requestedAt: completedAt,
      completedAt,
      createdAt: now,
      updatedAt: now,
    });

    await recordRefundEvent(tx, {
      refundRequestId,
      actorUserId: null,
      type: "provider_reversal_recorded",
      from: null,
      to: COMPLETED_STATUS,
      providerTransactionId: input.providerTransactionId,
      reasonCode: input.reasonCode,
      metadata: "unsolicited_provider_reversal",
    });
  }

  await recordPaymentEvent(tx, {
    paymentId: context.paymentId,
    providerTransactionId: input.providerTransactionId,
    reasonCode: input.reasonCode,
  });

  // The place is given up only now — after the provider confirmed the money
  // went back. Never the other way round.
  const cancelled = await cancelEnrollmentForRefund(tx, context, { system: true });

  await notify(tx, {
    userId: context.studentUserId,
    type: active ? "refund_completed" : "refund_provider_reversal",
    title: active ? "To‘lov qaytarildi" : "To‘lov provayder tomonidan qaytarildi",
    body: active
      ? `${context.courseTitle} (${context.groupTitle}). Yozilish bekor qilindi${cancelled ? " va joy bo‘shatildi" : ""}.`
      : `${context.courseTitle} (${context.groupTitle}). To‘lov qaytarildi va yozilish bekor qilindi.`,
    href: "/dashboard/courses",
  });

  if (!active) {
    // The operator must know that money moved without an approved request:
    // either a student cancelled through Payme directly, or something needs
    // investigating.
    const admins = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"));
    for (const admin of admins) {
      await notify(tx, {
        userId: admin.id,
        type: "refund_provider_reversal",
        title: "Provayder qaytarishi: so‘rovsiz",
        body: `${context.studentName} — ${context.courseTitle} (${context.groupTitle}). Qaytarish tizim tomonidan qayd etildi.`,
        href: "/admin/refunds",
      });
    }
  }

  return {
    ok: true,
    outcome: active ? "completed_existing_request" : "recorded_unsolicited_reversal",
    refundRequestId,
  };
}

/** Copy for the student's card, resolved through the shared status contract. */
export function refundStatusNote(status: RefundStatus): string {
  return REFUND_STATUS_NOTE[status];
}
