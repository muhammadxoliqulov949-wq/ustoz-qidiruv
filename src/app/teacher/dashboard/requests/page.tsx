import type { Metadata } from "next";
import { teacherDirectory } from "@/data/teacher-dashboard";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherRequestsPanel } from "@/components/teacher-dashboard/requests-panel";
import { TeacherAccountRequests } from "@/components/teacher-dashboard/account-requests";
import { requireRolePage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "So‘rovlar" };

/* /teacher/dashboard/requests — local Phase 7 state, ownership-guarded. */
export default async function TeacherRequestsPage() {
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const user = await requireRolePage("teacher", "/teacher/dashboard/requests");
  const demoEnabled = demoWorkspaceEnabled();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          So‘rovlar
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Kurslaringizga tegishli mahalliy prototip yozilish ma’lumotlari.
        </p>
      </header>
      <TeacherAccountRequests userId={user.id} />
      <TeacherRequestsPanel directory={teacherDirectory} demoEnabled={demoEnabled} />
    </div>
  );
}
