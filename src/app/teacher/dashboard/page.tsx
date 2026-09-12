import { teacherDirectory } from "@/data/teacher-dashboard";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherOverviewPanels } from "@/components/teacher-dashboard/overview-panels";

/* /teacher/dashboard — teacher overview. Server page: owns the <h1> and hands
 * the derived directory projection to one client island. */
export default async function TeacherOverviewPage() {
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const demoEnabled = demoWorkspaceEnabled();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Ustoz paneli
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Kurslaringiz, guruhlar va profil holati — barchasi katalogdagi haqiqiy
          ma’lumotdan hisoblanadi.
        </p>
      </header>
      <TeacherOverviewPanels directory={teacherDirectory} demoEnabled={demoEnabled} />
    </div>
  );
}
