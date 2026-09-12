import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CancelRequestButton } from "./cancel-request-button";
import { getStudentEnrollmentRequests } from "@/server/repo";

/* -------------------------------------------------------------------------- */
/* AccountRequests — the first REAL, server-persisted student data in the      */
/* product (Phase 11). Rendered on the server from rows scoped to the session  */
/* user, so there is no client fetch, no id in the URL and no CLS from a       */
/* hydration swap. Cancellation is the only mutation offered: approving a      */
/* request belongs to the teacher workflow, which this phase does not ship.    */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL = { submitted: "Yuborilgan", cancelled: "Bekor qilingan" } as const;

export async function AccountRequests({ userId }: { userId: string }) {
  const requests = await getStudentEnrollmentRequests(userId);

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
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs"
            >
              <div className="min-w-0">
                <Link
                  href={`/courses/${request.courseSlug}`}
                  className="text-base font-semibold text-ink-900 underline-offset-2 hover:underline"
                >
                  {request.courseTitle}
                </Link>
                <p className="mt-0.5 text-sm text-ink-500">{request.groupTitle}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge variant={request.status === "submitted" ? "accent" : "neutral"}>
                  {STATUS_LABEL[request.status]}
                </Badge>
                {request.status === "submitted" ? (
                  <CancelRequestButton requestId={request.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
