import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CancelRequestButton } from "./cancel-request-button";
import { OpenConversationButton } from "@/components/messaging/open-conversation-button";
import { PayButton } from "@/components/payments/pay-button";
import { listStudentRequests } from "@/server/enrollment-service";
import { getPaymentStatusByEnrollment } from "@/server/payments/payment-service";
import { paymentsEnabled } from "@/server/env";
import {
  ENROLLMENT_STATUS_LABEL,
  ENROLLMENT_STATUS_NOTE,
  allowedTransitions,
  enrollmentStatusTone,
} from "@/lib/enrollment-status";
import {
  FREE_COURSE_NOTE,
  PAID_CANCELLATION_BLOCKED,
  PAYMENT_REQUIRED_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_NOTE,
  PAYMENT_UNAVAILABLE_NOTE,
  canRetryPayment,
  paymentStatusTone,
} from "@/lib/payment-status";
import { formatSom } from "@/lib/money";
import { focusRing, cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* AccountRequests — the student's real enrollment requests.                   */
/*                                                                              */
/* Phase 14 adds the PAYMENT projection. Note that enrollment status and        */
/* payment status are rendered as two separate facts, because they are two      */
/* separate domains: "Qabul qilindi" + "To'lov kutilmoqda" is a normal state,   */
/* not a contradiction.                                                         */
/*                                                                              */
/* Everything here is derived on the server. The payment status shown is read   */
/* from the database — never from a query parameter, and never from anything    */
/* the browser reported about how a provider redirect went.                     */
/*                                                                              */
/* HONESTY: a paid student is "to'lov qilindi", never "completed", "active" or  */
/* "certified". Paying for a course is not finishing it.                        */
/* -------------------------------------------------------------------------- */

export async function AccountRequests({ userId }: { userId: string }) {
  const requests = await listStudentRequests(userId);

  // One batched query for the payment projection, not one per card.
  const acceptedIds = requests
    .filter((request) => request.status === "accepted")
    .map((request) => request.id);
  const payments = await getPaymentStatusByEnrollment(acceptedIds);
  const canPay = paymentsEnabled();

  return (
    <section aria-labelledby="account-requests" className="flex flex-col gap-3">
      <h2 id="account-requests" className="text-xl font-semibold text-ink-900">
        Hisobingizdagi so‘rovlar
      </h2>
      {requests.length === 0 ? (
        <EmptyState title="Hali so‘rov yuborilmagan" as="h3">
          Kurs sahifasidagi yozilish shaklini to‘ldirsangiz, so‘rov shu yerda
          hisobingizga bog‘langan holda saqlanadi.
          <p className="mt-3">
            <Link href="/courses" className="font-medium text-accent-700 underline underline-offset-2">
              Kurslarni ko‘rish
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((request) => {
            const payment = payments.get(request.id) ?? null;
            const isAccepted = request.status === "accepted";
            const isFree = request.coursePriceUzs === 0;
            const isPaid = payment?.status === "succeeded";

            // A paid place cannot be self-cancelled: refunds do not exist.
            const contractAllowsCancel = allowedTransitions("student", request.status).includes(
              "cancelled",
            );
            const canCancel = contractAllowsCancel && !isPaid;

            return (
              <li
                key={request.id}
                className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/courses/${request.courseSlug}`}
                      className={cn(
                        "text-base font-semibold text-ink-900 underline-offset-2 hover:underline",
                        focusRing,
                      )}
                    >
                      {request.courseTitle}
                    </Link>
                    <p className="mt-0.5 text-sm text-ink-500">{request.groupTitle}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Enrollment status — text in the badge, never colour alone. */}
                    <Badge variant={enrollmentStatusTone(request.status)}>
                      {ENROLLMENT_STATUS_LABEL[request.status]}
                    </Badge>

                    {/* Payment status — a SEPARATE fact, only once accepted. */}
                    {isAccepted ? (
                      isFree ? (
                        <Badge variant="neutral">Bepul — to‘lov talab qilinmaydi</Badge>
                      ) : payment ? (
                        <Badge variant={paymentStatusTone(payment.status)}>
                          {PAYMENT_STATUS_LABEL[payment.status]}
                        </Badge>
                      ) : (
                        <Badge variant="accent">{PAYMENT_REQUIRED_LABEL}</Badge>
                      )
                    ) : null}

                    {canCancel ? <CancelRequestButton requestId={request.id} /> : null}
                  </div>
                </div>

                <p className="text-sm text-ink-500">
                  {ENROLLMENT_STATUS_NOTE[request.status]}
                </p>

                {/*
                  Phase 16 entry point — shown ONLY for an accepted place, and it
                  posts an ENROLLMENT id: the server derives both participants.
                  Payment state is irrelevant here (accepted + unpaid, accepted +
                  paid and a free course all allow messaging), and a cancelled
                  request gets no button because its thread is read-only.
                */}
                {isAccepted ? (
                  <div className="border-t border-line pt-2.5">
                    <OpenConversationButton
                      enrollmentRequestId={request.id}
                      label="Ustozga yozish"
                    />
                  </div>
                ) : null}

                {/* Payment detail for an accepted place. */}
                {isAccepted ? (
                  isFree ? (
                    <p className="text-sm text-ink-500">{FREE_COURSE_NOTE}</p>
                  ) : (
                    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
                      {payment ? (
                        <>
                          <p className="text-sm text-ink-500">
                            {PAYMENT_STATUS_NOTE[payment.status]}
                          </p>
                          <p className="text-sm">
                            <Link
                              href={`/dashboard/payments/${payment.id}`}
                              className={cn(
                                "font-medium text-accent-700 underline underline-offset-2",
                                focusRing,
                              )}
                            >
                              To‘lov tafsilotlari
                            </Link>
                          </p>
                          {isPaid ? (
                            <p className="text-sm text-ink-500">
                              {PAID_CANCELLATION_BLOCKED}
                            </p>
                          ) : null}
                        </>
                      ) : canPay ? (
                        <PayButton
                          enrollmentRequestId={request.id}
                          amountLabel={formatSom(request.coursePriceUzs)}
                        />
                      ) : (
                        <p className="text-sm text-ink-500">{PAYMENT_UNAVAILABLE_NOTE}</p>
                      )}

                      {/* Retry after a cancelled or failed attempt. */}
                      {payment && canRetryPayment(payment.status) && canPay ? (
                        <PayButton
                          enrollmentRequestId={request.id}
                          amountLabel={formatSom(request.coursePriceUzs)}
                        />
                      ) : null}
                    </div>
                  )
                ) : null}

                {request.status === "rejected" && request.decisionReason ? (
                  <p className="text-sm text-ink-700">
                    O‘qituvchi izohi: {request.decisionReason}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
