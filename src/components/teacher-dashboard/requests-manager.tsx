import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RequestDecisionForm } from "./request-decision-form";
import {
  ENROLLMENT_STATUS_LABEL,
  enrollmentStatusTone,
  isFinalStatus,
  type EnrollmentStatus,
} from "@/lib/enrollment-status";
import {
  TEACHER_PAYMENT_LABEL,
  teacherPaymentView,
  type PaymentStatus,
} from "@/lib/payment-status";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Teacher request management — Phase 13, server-rendered.                     */
/*                                                                              */
/* Rows come from the enrollment service already scoped to the signed-in        */
/* teacher's courses, so another teacher's requests are never read into this    */
/* view rather than being filtered out of it.                                   */
/*                                                                              */
/* Accept/reject controls appear ONLY while the request is still `submitted`.   */
/* Decided requests show factual final-state copy instead of disabled buttons,  */
/* which would suggest the action might still be possible.                      */
/*                                                                              */
/* The status filter is URL state (`?status=`), so it survives refresh and      */
/* back/forward like the rest of the product.                                   */
/* -------------------------------------------------------------------------- */

export interface RequestRow {
  id: string;
  status: EnrollmentStatus;
  note: string;
  decisionReason: string | null;
  createdAt: Date;
  courseTitle: string;
  groupTitle: string;
  studentName: string;
  /** Drives only whether payment applies — no amount is ever shown. */
  coursePriceUzs: number;
  /** Live payment status for this enrollment, if one exists. */
  paymentStatus: PaymentStatus | null;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "submitted", label: "Yuborilgan" },
  { value: "accepted", label: "Qabul qilindi" },
  { value: "rejected", label: "Rad etildi" },
  { value: "cancelled", label: "Bekor qilindi" },
];

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Honest, factual final-state copy. No payment is ever implied. */
function finalStateNote(status: EnrollmentStatus): string {
  if (status === "accepted") return "Qabul qilingan — o‘quvchi guruhga kiritildi.";
  if (status === "rejected") return "Rad etilgan.";
  return "O‘quvchi bekor qilgan.";
}

export function RequestsManager({
  requests,
  counts,
  activeFilter,
}: {
  requests: RequestRow[];
  counts: Record<EnrollmentStatus, number> & { total: number };
  activeFilter: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Status filter — plain links, so it works without JavaScript. */}
      <nav aria-label="Holat bo‘yicha filtr">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.value;
            const total =
              filter.value === "all"
                ? counts.total
                : counts[filter.value as EnrollmentStatus];
            return (
              <li key={filter.value}>
                <Link
                  href={
                    filter.value === "all"
                      ? "/teacher/dashboard/requests"
                      : `/teacher/dashboard/requests?status=${filter.value}`
                  }
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium",
                    "transition-colors duration-fast",
                    isActive
                      ? "border-accent-600 bg-accent-50 text-accent-700"
                      : "border-line text-ink-700 hover:border-ink-300",
                    focusRing,
                  )}
                >
                  {filter.label}
                  <span className="text-ink-400">{total}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {requests.length === 0 ? (
        <EmptyState title="Bu holatda so‘rov yo‘q" as="h2">
          O‘quvchilar kurslaringizga yozilish so‘rovi yuborsa, ular shu yerda
          ko‘rinadi va shu yerdan qabul qilinadi yoki rad etiladi.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink-900">
                    <Link
                      href={`/teacher/dashboard/requests/${request.id}`}
                      className={cn("underline-offset-2 hover:underline", focusRing)}
                    >
                      {request.studentName}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {request.courseTitle} · {request.groupTitle}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-400">
                    Yuborilgan: {formatDate(request.createdAt)}
                  </p>
                  {request.note ? (
                    <p className="mt-2 text-sm text-ink-700">“{request.note}”</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Status is text inside a badge — never colour alone. */}
                  <Badge variant={enrollmentStatusTone(request.status)}>
                    {ENROLLMENT_STATUS_LABEL[request.status]}
                  </Badge>

                  {/*
                    PAYMENT PROJECTION FOR THE TEACHER — Phase 14.
                    Three factual words and nothing else: no amount, no
                    provider data, no transaction id, and no control. A teacher
                    must never be able to mark a payment as paid, so this is
                    read-only by construction: there is no action attached.
                  */}
                  {request.status === "accepted" ? (
                    <Badge variant="neutral">
                      {
                        TEACHER_PAYMENT_LABEL[
                          teacherPaymentView(
                            request.coursePriceUzs === 0,
                            request.paymentStatus,
                          )
                        ]
                      }
                    </Badge>
                  ) : null}
                </div>
              </div>

              {isFinalStatus(request.status) ? (
                <p className="text-sm text-ink-500">
                  {finalStateNote(request.status)}
                  {request.decisionReason ? ` Sabab: ${request.decisionReason}` : ""}
                </p>
              ) : (
                <RequestDecisionForm requestId={request.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
