import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getTeacherEnrollmentRequests } from "@/server/repo";

/* -------------------------------------------------------------------------- */
/* Teacher-side enrollment requests — READ ONLY (Phase 11).                    */
/*                                                                              */
/* Scoped in SQL by `courses.teacherUserId = <session user>`, so a teacher      */
/* cannot see requests for another teacher's courses. Deliberately no accept /  */
/* reject control: the approval workflow is out of scope for this phase and a   */
/* button that did nothing (or silently flipped a status) would be dishonest.   */
/* Student phone numbers are not selected or displayed.                        */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL = { submitted: "Yuborilgan", cancelled: "Bekor qilingan" } as const;

export async function TeacherAccountRequests({ userId }: { userId: string }) {
  const requests = await getTeacherEnrollmentRequests(userId);

  return (
    <section aria-labelledby="teacher-account-requests" className="flex flex-col gap-3">
      <h2 id="teacher-account-requests" className="text-xl font-semibold text-ink-900">
        Hisobingizga kelgan so‘rovlar
      </h2>
      {requests.length === 0 ? (
        <EmptyState title="Hozircha so‘rov yo‘q" as="h3">
          O‘quvchilar hisobingizdagi kurslarga yozilish so‘rovi yuborsa, ular shu
          yerda ko‘rinadi. So‘rovni tasdiqlash yoki rad etish keyingi bosqichda
          qo‘shiladi.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink-900">{request.courseTitle}</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {request.groupTitle} · {request.studentName}
                </p>
              </div>
              <Badge variant={request.status === "submitted" ? "accent" : "neutral"}>
                {STATUS_LABEL[request.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
