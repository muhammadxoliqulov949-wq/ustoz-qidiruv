import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { newId } from "../auth/ids";
import { somToTiyin, SUPPORTED_CURRENCY } from "@/lib/money";
import { LIVE_PAYMENT_STATUSES, type PaymentStatus } from "@/lib/payment-status";
import { paymentFailure, type PaymentResult } from "./provider";
import { PAYME_STATE } from "./payme-protocol";
import { insertNotification } from "../notification-service";

/* -------------------------------------------------------------------------- */
/* Payment service — Phase 14. Provider-agnostic payment domain logic.         */
/*                                                                              */
/* This module owns the rules; the Payme adapter owns the protocol. Anything in */
/* here would be equally true for CLICK.                                        */
/*                                                                              */
/* FOUR INVARIANTS THIS MODULE EXISTS TO ENFORCE                                */
/*                                                                              */
/* 1. MONEY IS NEVER CLIENT-SUPPLIED. The amount is derived from the course     */
/*    price attached to the accepted enrollment, converted to tiyin here, and   */
/*    frozen on the payment row. No function in this file accepts an amount     */
/*    argument from a caller that a browser could influence.                     */
/*                                                                              */
/* 2. ONE LIVE OBLIGATION PER ENROLLMENT. Enforced by a partial unique index,   */
/*    so two simultaneous "pay" clicks cannot create two charges. The           */
/*    application ALSO checks, but the database is what makes it true.           */
/*                                                                              */
/* 3. ONLY A VERIFIED PROVIDER CALLBACK CAN MARK A PAYMENT SUCCEEDED. There is  */
/*    no exported function that sets `succeeded` from a browser-reachable path. */
/*    `markPerformed` is called exclusively by the authenticated callback.       */
/*                                                                              */
/* 4. PAYMENT NEVER TOUCHES CAPACITY. Seats belong to `enrollment.status =      */
/*    'accepted'`. Nothing here reads or writes seat counts.                     */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/* --------------------------------- history --------------------------------- */

type PaymentEventType = (typeof schema.paymentEventType.enumValues)[number];

/**
 * Append to the immutable payment history, inside the caller's transaction so
 * history can never describe an effect that was rolled back.
 *
 * `metadata` is restricted to short, non-sensitive text. Credentials, headers
 * and card data are never passed here — this product never sees a card at all.
 */
async function recordPaymentEvent(
  tx: Tx,
  input: {
    paymentId: string;
    type: PaymentEventType;
    providerTransactionId?: string | null;
    metadata?: string | null;
  },
): Promise<void> {
  await tx.insert(schema.paymentEvents).values({
    id: newId("pev"),
    paymentId: input.paymentId,
    type: input.type,
    providerTransactionId: input.providerTransactionId ?? null,
    metadata: input.metadata ? input.metadata.slice(0, 500) : null,
  });
}

/* ------------------------------- eligibility -------------------------------- */

export interface PayableEnrollment {
  enrollmentRequestId: string;
  studentUserId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  priceUzs: number;
  isFree: boolean;
}

/**
 * Load an accepted enrollment that this student owns, with its course price.
 *
 * OWNERSHIP IS IN THE SQL PREDICATE, so another student's enrollment is
 * indistinguishable from one that does not exist. Status is checked here too:
 * only an ACCEPTED enrollment can ever be paid for.
 */
export async function getPayableEnrollment(
  enrollmentRequestId: string,
  studentUserId: string,
  tx?: Tx,
): Promise<PayableEnrollment | null> {
  const db = tx ?? getDb();
  const rows = await db
    .select({
      enrollmentRequestId: schema.enrollmentRequests.id,
      studentUserId: schema.enrollmentRequests.studentUserId,
      status: schema.enrollmentRequests.status,
      courseId: schema.courses.id,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      priceUzs: schema.courses.priceUzs,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .where(
      and(
        eq(schema.enrollmentRequests.id, enrollmentRequestId),
        eq(schema.enrollmentRequests.studentUserId, studentUserId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  // Payment exists only for an ACCEPTED place.
  if (row.status !== "accepted") return null;

  return {
    enrollmentRequestId: row.enrollmentRequestId,
    studentUserId: row.studentUserId,
    courseId: row.courseId,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    priceUzs: row.priceUzs,
    isFree: row.priceUzs === 0,
  };
}

/* ------------------------------ payment lookup ------------------------------ */

export interface PaymentView {
  id: string;
  enrollmentRequestId: string;
  studentUserId: string;
  amountTiyin: bigint;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
}

function toView(row: typeof schema.payments.$inferSelect): PaymentView {
  return {
    id: row.id,
    enrollmentRequestId: row.enrollmentRequestId,
    studentUserId: row.studentUserId,
    amountTiyin: row.amountTiyin,
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
  };
}

/** The live (pending or succeeded) payment for an enrollment, if any. */
export async function getLivePaymentForEnrollment(
  enrollmentRequestId: string,
  tx?: Tx,
): Promise<PaymentView | null> {
  const db = tx ?? getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.enrollmentRequestId, enrollmentRequestId),
        inArray(schema.payments.status, [...LIVE_PAYMENT_STATUSES]),
      ),
    )
    .limit(1);
  return rows[0] ? toView(rows[0]) : null;
}

/**
 * One payment, scoped to its owner.
 *
 * The student id is part of the predicate, so a payment id belonging to
 * somebody else simply does not resolve — the id leaks nothing.
 */
export async function getPaymentForStudent(
  paymentId: string,
  studentUserId: string,
): Promise<PaymentView | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.studentUserId, studentUserId)))
    .limit(1);
  return rows[0] ? toView(rows[0]) : null;
}

/** Live payment status for many enrollments at once (dashboard projection). */
export async function getPaymentStatusByEnrollment(
  enrollmentRequestIds: string[],
): Promise<Map<string, PaymentView>> {
  const result = new Map<string, PaymentView>();
  if (enrollmentRequestIds.length === 0) return result;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        inArray(schema.payments.enrollmentRequestId, enrollmentRequestIds),
        inArray(schema.payments.status, [...LIVE_PAYMENT_STATUSES]),
      ),
    );
  for (const row of rows) result.set(row.enrollmentRequestId, toView(row));
  return result;
}

/**
 * True when this enrollment has a SUCCEEDED payment.
 *
 * Used by the enrollment domain to refuse self-service cancellation of a place
 * that has been paid for, because refunds do not exist yet.
 */
export async function hasSucceededPayment(
  enrollmentRequestId: string,
  tx?: Tx,
): Promise<boolean> {
  const db = tx ?? getDb();
  const rows = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.enrollmentRequestId, enrollmentRequestId),
        eq(schema.payments.status, "succeeded"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/* ------------------------------- obligation --------------------------------- */

/**
 * Create -- or return the existing -- payment obligation for an accepted
 * enrollment.
 *
 * IDEMPOTENT BY DESIGN. Two simultaneous "pay" clicks race on the partial
 * unique index `payments_one_live_per_enrollment`; the loser catches the
 * violation and re-reads the winner's row, so the student ends up with ONE
 * obligation rather than two charges.
 *
 * THE PRICE SNAPSHOT IS TAKEN HERE, ONCE. A later course-price edit cannot
 * change an existing payment, because nothing recomputes `amountTiyin`.
 */
export async function ensurePaymentForEnrollment(
  enrollmentRequestId: string,
  studentUserId: string,
): Promise<PaymentResult<{ payment: PaymentView; created: boolean }>> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const enrollment = await getPayableEnrollment(enrollmentRequestId, studentUserId, tx);
      if (!enrollment) {
        return paymentFailure("not_found", "Yozilish topilmadi yoki hali qabul qilinmagan.");
      }
      // A free course never enters payment infrastructure at all.
      if (enrollment.isFree) {
        return paymentFailure("not_payable", "Kurs bepul. To‘lov talab qilinmaydi.");
      }

      const existing = await getLivePaymentForEnrollment(enrollmentRequestId, tx);
      if (existing) {
        // Already paid: nothing more to do, and definitely not a second charge.
        return { ok: true as const, payment: existing, created: false };
      }

      // Amount derived SERVER-SIDE from the course price. Never from input.
      const amountTiyin = somToTiyin(enrollment.priceUzs);
      const paymentId = newId("pay");

      await tx.insert(schema.payments).values({
        id: paymentId,
        enrollmentRequestId,
        studentUserId,
        provider: "payme",
        amountTiyin,
        currency: SUPPORTED_CURRENCY,
        status: "pending",
      });

      await recordPaymentEvent(tx, {
        paymentId,
        type: "payment_created",
        metadata: `course=${enrollment.courseSlug}`,
      });

      const created = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, paymentId))
        .limit(1);

      return { ok: true as const, payment: toView(created[0]), created: true };
    });
  } catch (error) {
    // A unique-violation means a concurrent request won the race. That is a
    // SUCCESS for the student -- re-read and return the winning obligation.
    const existing = await getLivePaymentForEnrollment(enrollmentRequestId);
    if (existing) {
      return { ok: true, payment: existing, created: false };
    }
    console.error("ensurePaymentForEnrollment failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return paymentFailure("server_error", "To‘lovni boshlab bo‘lmadi.");
  }
}

/**
 * Mark a pending obligation failed only when a server-side checkout operation
 * has a confirmed local failure. Provider protocol failures are not guessed here
 * and a Payme cancellation remains `cancelled`; this event is for a broken
 * checkout boundary that the student can safely retry. It is idempotent and
 * writes the in-app notice in the same transaction.
 */
export async function markPaymentFailed(input: {
  paymentId: string;
  reason: string;
}): Promise<PaymentResult<{ alreadyFailed: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM payments WHERE id = ${input.paymentId} FOR UPDATE`);
      const rows = await tx
        .select({ id: schema.payments.id, status: schema.payments.status, studentUserId: schema.payments.studentUserId })
        .from(schema.payments)
        .where(eq(schema.payments.id, input.paymentId))
        .limit(1);
      const payment = rows[0];
      if (!payment) return paymentFailure("not_found", "To‘lov topilmadi.");
      if (payment.status === "failed") return { ok: true as const, alreadyFailed: true };
      if (payment.status !== "pending") return paymentFailure("invalid_state", "To‘lov holati mos emas.");

      await tx
        .update(schema.payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.payments.id, input.paymentId));
      await recordPaymentEvent(tx, {
        paymentId: input.paymentId,
        type: "payment_failed",
        metadata: input.reason.replace(/[\r\n]+/g, " ").slice(0, 240),
      });
      await insertNotification(tx, {
        userId: payment.studentUserId,
        type: "payment_failed",
        title: "To‘lovni boshlashda xatolik",
        body: "To‘lovni boshlashda texnik xatolik yuz berdi. Qayta urinib ko‘rishingiz mumkin.",
        href: `/dashboard/payments/${input.paymentId}`,
      });
      return { ok: true as const, alreadyFailed: false };
    });
  } catch (error) {
    console.error("markPaymentFailed failed", { code: (error as { code?: string }).code ?? "unknown" });
    return paymentFailure("server_error", "To‘lov holatini saqlab bo‘lmadi.");
  }
}

/* --------------------------- provider transactions -------------------------- */

export interface ProviderTransactionView {
  id: string;
  paymentId: string;
  providerTransactionId: string;
  providerCreatedAt: bigint;
  state: number;
  reasonCode: number | null;
  performedAt: bigint | null;
  cancelledAt: bigint | null;
}

function toTxView(
  row: typeof schema.paymentTransactions.$inferSelect,
): ProviderTransactionView {
  return {
    id: row.id,
    paymentId: row.paymentId,
    providerTransactionId: row.providerTransactionId,
    providerCreatedAt: row.providerCreatedAt,
    state: row.state,
    reasonCode: row.reasonCode,
    performedAt: row.performedAt,
    cancelledAt: row.cancelledAt,
  };
}

/** Find a provider transaction by the provider's own id. */
export async function findProviderTransaction(
  providerTransactionId: string,
  tx?: Tx,
): Promise<ProviderTransactionView | null> {
  const db = tx ?? getDb();
  const rows = await db
    .select()
    .from(schema.paymentTransactions)
    .where(
      and(
        eq(schema.paymentTransactions.provider, "payme"),
        eq(schema.paymentTransactions.providerTransactionId, providerTransactionId),
      ),
    )
    .limit(1);
  return rows[0] ? toTxView(rows[0]) : null;
}

/** Any transaction still awaiting confirmation blocks creating another one. */
export async function findActiveTransactionForPayment(
  paymentId: string,
  tx?: Tx,
): Promise<ProviderTransactionView | null> {
  const db = tx ?? getDb();
  const rows = await db
    .select()
    .from(schema.paymentTransactions)
    .where(
      and(
        eq(schema.paymentTransactions.paymentId, paymentId),
        inArray(schema.paymentTransactions.state, [PAYME_STATE.CREATED, PAYME_STATE.PERFORMED]),
      ),
    )
    .limit(1);
  return rows[0] ? toTxView(rows[0]) : null;
}

/**
 * Record a newly created provider transaction.
 *
 * Idempotent: if the provider retries after a lost response, the unique index
 * on `provider_transaction_id` rejects the insert and we return the row that
 * already exists, so the retry sees the same answer as the first call — which
 * is exactly what the protocol requires.
 */
export async function createProviderTransaction(input: {
  paymentId: string;
  providerTransactionId: string;
  providerCreatedAt: number;
}): Promise<PaymentResult<{ transaction: ProviderTransactionView; created: boolean }>> {
  const db = getDb();
  const existing = await findProviderTransaction(input.providerTransactionId);
  if (existing) {
    return { ok: true, transaction: existing, created: false };
  }

  try {
    return await db.transaction(async (tx) => {
      const id = newId("ptx");
      await tx.insert(schema.paymentTransactions).values({
        id,
        paymentId: input.paymentId,
        provider: "payme",
        providerTransactionId: input.providerTransactionId,
        providerCreatedAt: BigInt(input.providerCreatedAt),
        state: PAYME_STATE.CREATED,
      });
      await recordPaymentEvent(tx, {
        paymentId: input.paymentId,
        type: "provider_transaction_created",
        providerTransactionId: input.providerTransactionId,
      });
      const rows = await tx
        .select()
        .from(schema.paymentTransactions)
        .where(eq(schema.paymentTransactions.id, id))
        .limit(1);
      return { ok: true as const, transaction: toTxView(rows[0]), created: true };
    });
  } catch {
    // Concurrent duplicate: the other writer won. Return its row.
    const raced = await findProviderTransaction(input.providerTransactionId);
    if (raced) return { ok: true, transaction: raced, created: false };
    return paymentFailure("server_error", "Tranzaksiyani yaratib bo‘lmadi.");
  }
}

/**
 * Mark a provider transaction performed and the payment succeeded.
 *
 * THE ONLY PATH TO `succeeded`. Called exclusively from the authenticated
 * provider callback — there is no browser-reachable route to this function.
 *
 * One transaction does all of it:
 *   1. lock the payment row (FOR UPDATE) — the serialisation point;
 *   2. re-read the provider transaction;
 *   3. if already performed, return the SAME result (idempotent retry);
 *   4. refuse any state that is not "created";
 *   5. mark performed, mark the payment succeeded, stamp paidAt;
 *   6. append history and notify the student;
 *   7. commit.
 *
 * A duplicate PerformTransaction therefore cannot double-notify or double-pay:
 * step 3 short-circuits before any write.
 */
export async function markPerformed(
  providerTransactionId: string,
  performedAtMs: number,
): Promise<
  PaymentResult<{ transaction: ProviderTransactionView; alreadyPerformed: boolean }>
> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const found = await findProviderTransaction(providerTransactionId, tx);
      if (!found) return paymentFailure("not_found", "Tranzaksiya topilmadi.");

      // Serialisation point: concurrent performs on this payment queue here.
      await tx.execute(
        sql`SELECT id FROM payments WHERE id = ${found.paymentId} FOR UPDATE`,
      );

      const current = await findProviderTransaction(providerTransactionId, tx);
      if (!current) return paymentFailure("not_found", "Tranzaksiya topilmadi.");

      // IDEMPOTENT RETRY: already performed → same answer, no new effects.
      if (current.state === PAYME_STATE.PERFORMED) {
        return { ok: true as const, transaction: current, alreadyPerformed: true };
      }
      // Anything other than "created" cannot be performed (cancelled, etc.).
      if (current.state !== PAYME_STATE.CREATED) {
        return paymentFailure("invalid_state", "Tranzaksiya holati mos emas.");
      }

      const now = new Date();
      await tx
        .update(schema.paymentTransactions)
        .set({
          state: PAYME_STATE.PERFORMED,
          performedAt: BigInt(performedAtMs),
          updatedAt: now,
        })
        .where(eq(schema.paymentTransactions.id, current.id));

      await tx
        .update(schema.payments)
        .set({ status: "succeeded", paidAt: now, updatedAt: now })
        .where(eq(schema.payments.id, current.paymentId));

      await recordPaymentEvent(tx, {
        paymentId: current.paymentId,
        type: "payment_succeeded",
        providerTransactionId,
      });

      // Notify the student, in the SAME transaction as the status change.
      const payRows = await tx
        .select({
          studentUserId: schema.payments.studentUserId,
          enrollmentRequestId: schema.payments.enrollmentRequestId,
        })
        .from(schema.payments)
        .where(eq(schema.payments.id, current.paymentId))
        .limit(1);
      const payment = payRows[0];
      if (payment) {
        await tx.insert(schema.notifications).values({
          id: newId("ntf"),
          userId: payment.studentUserId,
          type: "payment_succeeded",
          title: "To‘lov muvaffaqiyatli tasdiqlandi",
          body: "To‘lovingiz tasdiqlandi. Bu kursni tugatganingizni anglatmaydi.",
          href: `/dashboard/payments/${current.paymentId}`,
        });
      }

      const updated = await findProviderTransaction(providerTransactionId, tx);
      return {
        ok: true as const,
        transaction: updated as ProviderTransactionView,
        alreadyPerformed: false,
      };
    });
  } catch (error) {
    console.error("markPerformed failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return paymentFailure("server_error", "Tranzaksiyani yakunlab bo‘lmadi.");
  }
}

/**
 * Cancel a provider transaction.
 *
 * Distinguishes the three cases the protocol cares about:
 *   • still created (state 1)  → state -1, payment becomes `cancelled`;
 *   • already performed (2)    → state -2. The payment row stays `succeeded`
 *     because the money really was taken and refunds are NOT implemented.
 *     Recording -2 keeps us protocol-correct without inventing a refund the
 *     product cannot honour; the boundary is documented in the README.
 *   • already cancelled        → return the stored result unchanged.
 */
export async function markCancelled(
  providerTransactionId: string,
  cancelledAtMs: number,
  reasonCode: number | null,
  /**
   * PHASE 17 — the seam between "the provider cancelled a transaction" and "the
   * money went back".
   *
   * Cancelling a transaction that had already been PERFORMED (protocol state -2)
   * means money that arrived has been reversed: that is a genuine refund signal,
   * and the refund domain has to hear about it. The payment domain must not
   * learn what a refund is, so the refund service is injected here instead of
   * being imported, and it runs INSIDE THIS TRANSACTION — the -2 write, the
   * refund becoming `completed` and the enrollment becoming `cancelled` either
   * all commit or none of them do. A pre-perform cancel (state -1) never calls
   * it, because no money ever moved.
   */
  options?: {
    onCancelledAfterPerform?: (
      tx: Tx,
      info: {
        paymentId: string;
        providerTransactionId: string;
        reasonCode: number | null;
        cancelledAtMs: number;
      },
    ) => Promise<void>;
  },
): Promise<
  PaymentResult<{ transaction: ProviderTransactionView; alreadyCancelled: boolean }>
> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const found = await findProviderTransaction(providerTransactionId, tx);
      if (!found) return paymentFailure("not_found", "Tranzaksiya topilmadi.");

      await tx.execute(
        sql`SELECT id FROM payments WHERE id = ${found.paymentId} FOR UPDATE`,
      );

      const current = await findProviderTransaction(providerTransactionId, tx);
      if (!current) return paymentFailure("not_found", "Tranzaksiya topilmadi.");

      // IDEMPOTENT RETRY: already in a cancelled state → same answer.
      if (
        current.state === PAYME_STATE.CANCELLED ||
        current.state === PAYME_STATE.CANCELLED_AFTER_PERFORM
      ) {
        return { ok: true as const, transaction: current, alreadyCancelled: true };
      }

      const wasPerformed = current.state === PAYME_STATE.PERFORMED;
      const nextState = wasPerformed
        ? PAYME_STATE.CANCELLED_AFTER_PERFORM
        : PAYME_STATE.CANCELLED;
      const now = new Date();

      await tx
        .update(schema.paymentTransactions)
        .set({
          state: nextState,
          cancelledAt: BigInt(cancelledAtMs),
          reasonCode,
          updatedAt: now,
        })
        .where(eq(schema.paymentTransactions.id, current.id));

      if (!wasPerformed) {
        // Only an unperformed obligation becomes `cancelled`. A performed one
        // stays `succeeded`: the money moved, and we do not fake a refund.
        await tx
          .update(schema.payments)
          .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
          .where(eq(schema.payments.id, current.paymentId));
      }

      await recordPaymentEvent(tx, {
        paymentId: current.paymentId,
        type: "provider_cancelled",
        providerTransactionId,
        metadata: `state=${nextState}${reasonCode === null ? "" : `,reason=${reasonCode}`}`,
      });

      if (wasPerformed && options?.onCancelledAfterPerform) {
        // Same transaction: a failure here rolls the cancellation back too, so
        // a reversed payment can never be left without its refund record.
        await options.onCancelledAfterPerform(tx, {
          paymentId: current.paymentId,
          providerTransactionId,
          reasonCode,
          cancelledAtMs,
        });
      }

      const updated = await findProviderTransaction(providerTransactionId, tx);
      return {
        ok: true as const,
        transaction: updated as ProviderTransactionView,
        alreadyCancelled: false,
      };
    });
  } catch (error) {
    console.error("markCancelled failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return paymentFailure("server_error", "Tranzaksiyani bekor qilib bo‘lmadi.");
  }
}

/** Provider transactions created in a window — backs GetStatement. */
export async function listTransactionsBetween(
  fromMs: number,
  toMs: number,
): Promise<
  Array<{
    providerTransactionId: string;
    providerCreatedAt: bigint;
    amountTiyin: bigint;
    paymentId: string;
    state: number;
    reasonCode: number | null;
    performedAt: bigint | null;
    cancelledAt: bigint | null;
    createdAt: Date;
  }>
> {
  const db = getDb();
  return db
    .select({
      providerTransactionId: schema.paymentTransactions.providerTransactionId,
      providerCreatedAt: schema.paymentTransactions.providerCreatedAt,
      amountTiyin: schema.payments.amountTiyin,
      paymentId: schema.payments.id,
      state: schema.paymentTransactions.state,
      reasonCode: schema.paymentTransactions.reasonCode,
      performedAt: schema.paymentTransactions.performedAt,
      cancelledAt: schema.paymentTransactions.cancelledAt,
      createdAt: schema.paymentTransactions.createdAt,
    })
    .from(schema.paymentTransactions)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.paymentTransactions.paymentId))
    .where(
      and(
        sql`${schema.paymentTransactions.providerCreatedAt} >= ${String(fromMs)}::bigint`,
        sql`${schema.paymentTransactions.providerCreatedAt} <= ${String(toMs)}::bigint`,
      ),
    )
    .orderBy(desc(schema.paymentTransactions.providerCreatedAt));
}

/** Payment history for the student-facing detail page. */
export async function listPaymentEvents(paymentId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.paymentEvents.id,
      type: schema.paymentEvents.type,
      createdAt: schema.paymentEvents.createdAt,
    })
    .from(schema.paymentEvents)
    .where(eq(schema.paymentEvents.paymentId, paymentId))
    .orderBy(schema.paymentEvents.createdAt);
}
