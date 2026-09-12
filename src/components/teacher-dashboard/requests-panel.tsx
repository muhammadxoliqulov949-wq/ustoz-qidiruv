"use client";

import Link from "next/link";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WorkspaceGate } from "./workspace-gate";
import { TeacherRequestCard } from "./request-card";
import type { TeacherDirectory } from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* So'rovlar — the teacher-side view of local Phase 7 state.                    */
/*                                                                              */
/* Hard limits made explicit in the UI: Phase 7 keeps ONE enrollment draft in   */
/* this browser, so at most one item can ever appear, and only when its course  */
/* belongs to this workspace (ownership guard in lib/teacher-workspace.         */
/* toTeacherRequest). No student list is invented, no history is fabricated,    */
/* and no approve/reject/payment/message control exists.                         */
/* -------------------------------------------------------------------------- */

export function TeacherRequestsPanel({ directory, demoEnabled = false }: { directory: TeacherDirectory; demoEnabled?: boolean }) {
  return (
    <WorkspaceGate directory={directory} demoEnabled={demoEnabled} heading="So‘rovlar" minHeight="min-h-[34rem]">
      {(workspace, state) => (
        <div className="flex flex-col gap-6">
          <AuthNotice variant="warning" title="Bu server so‘rovlari emas">
            Yozilish infratuzilmasi ulanmagan: platformada o‘quvchilarning
            so‘rovlari to‘planmaydi. Bu bo‘lim faqat shu brauzerdagi Phase 7
            qoralamasini ko‘rsatadi va u ham kurslaringizdan biriga tegishli
            bo‘lsagina chiqadi. Bir vaqtda bitta qoralama saqlanadi, shuning
            uchun bu yerda ro‘yxat tarixi bo‘lmaydi.
          </AuthNotice>

          <section aria-labelledby="tw-requests" className="flex flex-col gap-4">
            <h2 id="tw-requests" className="text-xl font-semibold text-ink-900">
              Mahalliy so‘rovlar{" "}
              <span className="text-base font-normal text-ink-500">
                ({state.requests.length})
              </span>
            </h2>

            {state.requests.length === 0 ? (
              <EmptyState title="So‘rov yo‘q">
                Shu brauzerda <strong>{workspace.name}</strong> kurslariga
                tegishli yozilish qoralamasi topilmadi. Boshqa ustozning kursi
                uchun boshlangan qoralama bu yerda ko‘rinmaydi.
                <p className="mt-3">
                  <Link
                    href="/courses"
                    className="font-medium text-accent-700 underline underline-offset-2"
                  >
                    Katalogni ko‘rish
                  </Link>
                </p>
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-4">
                {state.requests.map((request) => (
                  <li key={request.courseId}>
                    <TeacherRequestCard request={request} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </WorkspaceGate>
  );
}
