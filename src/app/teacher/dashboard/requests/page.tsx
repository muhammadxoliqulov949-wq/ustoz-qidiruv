import type { Metadata } from "next";
import { RequestsManager } from "@/components/teacher-dashboard/requests-manager";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherRequestCounts, listTeacherRequests } from "@/server/enrollment-service";
import { getPaymentStatusByEnrollment } from "@/server/payments/payment-service";
import { getTeacherRefundStates } from "@/server/refund-service";
import type { EnrollmentStatus } from "@/lib/enrollment-status";

export const metadata: Metadata = { title: "So‘rovlar" };

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard/requests — Phase 13 request management.                  */
/*                                                                              */
/* Rows are read through the enrollment service, scoped in SQL to courses owned */
/* by the signed-in teacher. Dynamic: account data that changes whenever a      */
/* student submits or withdraws, so it is never prerendered.                    */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const VALID: EnrollmentStatus[] = ["submitted", "accepted", "rejected", "cancelled"];

export default async function TeacherRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRolePage("teacher", "/teacher/dashboard/requests");
  const query = await searchParams;

  // Unknown values fall back to "all" rather than erroring.
  const raw = typeof query.status === "string" ? query.status : "all";
  const status = VALID.includes(raw as EnrollmentStatus) ? (raw as EnrollmentStatus) : undefined;

  const [requests, counts] = await Promise.all([
    listTeacherRequests(user.id, status ? { status } : {}),
    getTeacherRequestCounts(user.id),
  ]);

  // Minimal factual payment projection, batched. The teacher sees only whether
  // an accepted place has been paid for — never an amount or provider detail.
  const payments = await getPaymentStatusByEnrollment(
    requests.filter((request) => request.status === "accepted").map((request) => request.id),
  );
  /*
   * Phase 17 — the refund projection, batched and scoped to THIS teacher's
   * courses (the service joins `courses.teacher_user_id`), so a guessed
   * enrollment id returns nothing. Read-only: a teacher cannot decide a refund.
   */
  const refunds = await getTeacherRefundStates(
    requests.map((request) => request.id),
    user.id,
  );
  const rows = requests.map((request) => ({
    ...request,
    paymentStatus: payments.get(request.id)?.status ?? null,
    refundStatus: refunds.get(request.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          So‘rovlar
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Kurslaringizga kelgan yozilish so‘rovlarini shu yerda qabul qilasiz
          yoki rad etasiz. To‘lovni o‘quvchining o‘zi amalga oshiradi.
        </p>
      </header>
      <RequestsManager
        requests={rows}
        counts={counts}
        activeFilter={status ?? "all"}
      />
    </div>
  );
}
