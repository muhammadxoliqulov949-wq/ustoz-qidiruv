import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CancelRequestButton } from "./cancel-request-button";
import { listStudentRequests } from "@/server/enrollment-service";
import {
  ENROLLMENT_STATUS_LABEL,
  ENROLLMENT_STATUS_NOTE,
  allowedTransitions,
  enrollmentStatusTone,
} from "@/lib/enrollment-status";
import { focusRing, cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* AccountRequests — the student's real enrollment requests (Phase 11,         */
/* completed in Phase 13 now that teachers can actually decide them).          */
/*                                                                              */
/* Rendered on the server from rows scoped to the session user, so there is no  */
/* client fetch, no id in the URL and no CLS from a hydration swap.             */
/*                                                                              */
/* The status label, the explanatory note and whether "cancel" is offered all   */
/* come from the shared transition contract — this component contains NO        */
/* status rules of its own, so student and teacher surfaces can never drift.    */
/*                                                                              */
/* HONESTY: an accepted request says a place is reserved and that payment is    */
/* not connected yet. There is no "paid", "active" or "completed" state,        */
/* because none of those exist in the product.                                  */
/* -------------------------------------------------------------------------- */

export async function AccountRequests({ userId }: { userId: string }) {
  const requests = await listStudentRequests(userId);

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
            // The student may withdraw only when the contract permits it.
            const canCancel = allowedTransitions("student", request.status).includes("cancelled");
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
                  <div className="flex items-center gap-2.5">
                    {/* Text in the badge, never colour alone. */}
                    <Badge variant={enrollmentStatusTone(request.status)}>
                      {ENROLLMENT_STATUS_LABEL[request.status]}
                    </Badge>
                    {canCancel ? <CancelRequestButton requestId={request.id} /> : null}
                  </div>
                </div>

                <p className="text-sm text-ink-500">
                  {ENROLLMENT_STATUS_NOTE[request.status]}
                </p>

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
