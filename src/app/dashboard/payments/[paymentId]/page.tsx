import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { requireRolePage } from "@/server/auth/guards";
import {
  getPaymentForStudent,
  listPaymentEvents,
} from "@/server/payments/payment-service";
import { getRefundEligibility, listStudentRefunds } from "@/server/refund-service";
import { RefundRequestForm } from "@/components/dashboard/refund-request-form";
import {
  REFUND_FAILED_RETRY_NOTE,
  REFUND_PROVIDER_PENDING_NOTE,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_NOTE,
  refundStatusTone,
} from "@/lib/refund";
import {
  PAID_CANCELLATION_BLOCKED,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_NOTE,
  paymentStatusTone,
} from "@/lib/payment-status";
import { formatTiyin } from "@/lib/money";
import { cn, focusRing } from "@/lib/utils";

export const metadata: Metadata = {
  title: "To‘lov",
  robots: { index: false, follow: false },
};

/* -------------------------------------------------------------------------- */
/* /dashboard/payments/[paymentId] — payment status and return target.         */
/*                                                                              */
/* THIS PAGE IS ALSO THE PROVIDER RETURN URL, which makes one rule critical:    */
/*                                                                              */
/*   A REDIRECT BACK FROM PAYME IS NOT PROOF OF PAYMENT.                        */
/*                                                                              */
/* Anyone can navigate here, and anyone can append whatever query string they   */
/* like. So this page reads the payment status from the DATABASE and nothing    */
/* else: there is no `?success=` handling, no client-reported state, and no     */
/* code path on this page that can change a payment's status. Only the          */
/* authenticated Payme callback can do that.                                    */
/*                                                                              */
/* Ownership is in the SQL predicate, so another student's payment id simply    */
/* 404s and the id leaks nothing.                                               */
/*                                                                              */
/* PHASE 17 adds the REFUND section. It is a separate card on purpose: the       */
/* payment answers "did the money arrive?", the refund answers "did it go back,  */
/* and on whose authority?". The refund only ever reads `completed` when the     */
/* provider confirmed it, and the copy before that point says so.                */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  payment_created: "To‘lov yaratildi",
  provider_transaction_created: "Tranzaksiya boshlandi",
  payment_succeeded: "To‘lov tasdiqlandi",
  provider_cancelled: "Tranzaksiya bekor qilindi",
  // Phase 17. Only an authenticated provider confirmation produces this one.
  provider_refund_confirmed: "Provayder to‘lovni qaytardi",
  payment_failed: "To‘lov amalga oshmadi",
};

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const user = await requireRolePage("student", `/dashboard/payments/${paymentId}`);

  // Scoped to the session user. Not "fetch then check" — scoped in the query.
  const payment = await getPaymentForStudent(paymentId, user.id);
  if (!payment) notFound();

  const events = await listPaymentEvents(payment.id);
  const isPaid = payment.status === "succeeded";

  // Scoped to this student by both the payment and the student id.
  const refunds = await listStudentRefunds(user.id, { paymentId: payment.id });
  const eligibility = await getRefundEligibility(payment.enrollmentRequestId, user.id);
  const liveRefund = refunds.find(
    (refund) => refund.status === "requested" || refund.status === "awaiting_provider",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/courses"
          className={cn(
            "inline-flex items-center gap-1 text-sm text-ink-500",
            "transition-colors duration-fast hover:text-ink-900",
            focusRing,
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          So‘rovlarimga qaytish
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          To‘lov holati
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={paymentStatusTone(payment.status)}>
            {PAYMENT_STATUS_LABEL[payment.status]}
          </Badge>
          <span className="text-sm text-ink-500">
            Yaratilgan: {formatDate(payment.createdAt)}
          </span>
        </div>
      </header>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Tafsilotlar</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-400">Summa</dt>
            <dd className="mt-0.5 text-lg font-semibold text-ink-900">
              {formatTiyin(payment.amountTiyin)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-400">Holat</dt>
            <dd className="mt-0.5 font-medium text-ink-900">
              {PAYMENT_STATUS_LABEL[payment.status]}
            </dd>
          </div>
          {payment.paidAt ? (
            <div>
              <dt className="text-sm text-ink-400">To‘langan vaqt</dt>
              <dd className="mt-0.5 font-medium text-ink-900">
                {formatDate(payment.paidAt)}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 text-base text-ink-700">
          {PAYMENT_STATUS_NOTE[payment.status]}
        </p>

        {/*
          Explicitly tells the student what "paid" does and does not mean, and
          why the page may need a refresh: confirmation is asynchronous and
          comes from Payme, not from their browser returning here.
        */}
        {payment.status === "pending" ? (
          <p className="mt-2 text-sm text-ink-500">
            To‘lovni Payme sahifasida yakunlaganingizdan so‘ng, tasdiq bizga
            Payme tomonidan yuboriladi. Holat darhol yangilanmasa, sahifani
            yangilang.
          </p>
        ) : null}

        {isPaid ? (
          <p className="mt-2 text-sm text-ink-500">{PAID_CANCELLATION_BLOCKED}</p>
        ) : null}
      </Card>

      {/*
        The refund is a SEPARATE fact from the payment, so it gets its own card
        with its own wording. Nothing here can complete a refund: the student can
        only ASK, and the card says who decides and what has to happen before the
        money counts as returned.
      */}
      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Pulni qaytarish</h2>

        {refunds.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-4">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={refundStatusTone(refund.status)}>
                    {REFUND_STATUS_LABEL[refund.status]}
                  </Badge>
                  <span className="text-sm text-ink-500">
                    So‘ralgan: {formatDate(refund.requestedAt)}
                  </span>
                </div>
                <p className="text-sm text-ink-500">{REFUND_STATUS_NOTE[refund.status]}</p>
                <p className="text-sm text-ink-700">Sabab: {refund.reason}</p>
                {refund.adminFeedback ? (
                  <p className="text-sm text-ink-700">Administrator izohi: {refund.adminFeedback}</p>
                ) : null}
                {refund.status === "awaiting_provider" ? (
                  <p className="text-sm text-ink-500">{REFUND_PROVIDER_PENDING_NOTE}</p>
                ) : null}
                {refund.status === "completed" && refund.completedAt ? (
                  <p className="text-sm text-ink-500">
                    Qaytarilgan vaqt: {formatDate(refund.completedAt)}
                  </p>
                ) : null}
                {refund.status === "rejected" || refund.status === "failed" ? (
                  <p className="text-sm text-ink-500">{REFUND_FAILED_RETRY_NOTE}</p>
                ) : null}
                {refund.systemInitiated ? (
                  <p className="text-sm text-ink-500">
                    Bu qaytarish ilova orqali so‘ralmagan — provayder tomonidan qayd etilgan.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {eligibility.eligible && !liveRefund ? (
          <div className="mt-4">
            <RefundRequestForm
              enrollmentRequestId={payment.enrollmentRequestId}
              amountLabel={formatTiyin(payment.amountTiyin)}
            />
          </div>
        ) : null}

        {refunds.length === 0 && !eligibility.eligible ? (
          <p className="mt-3 text-sm text-ink-500">
            {eligibility.reason ?? "Bu to‘lov uchun qaytarish so‘rovi yuborilmaydi."}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">To‘lov tarixi</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="text-sm text-ink-700">
              <span className="text-ink-400">{formatDate(event.createdAt)}</span>{" "}
              {EVENT_LABEL[event.type] ?? event.type}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
