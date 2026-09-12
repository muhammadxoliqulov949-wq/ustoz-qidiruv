import type { Metadata } from "next";
import { teacherDirectory } from "@/data/teacher-dashboard";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherCoursesPanel } from "@/components/teacher-dashboard/courses-panel";
import { requireRolePage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Kurslarim" };

/* /teacher/dashboard/courses — own courses via the canonical course→teacher link. */
export default async function TeacherCoursesPage() {
  await requireRolePage("teacher", "/teacher/dashboard/courses");
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const demoEnabled = demoWorkspaceEnabled();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Kurslarim
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Katalogda e’lon qilingan kurslaringiz, guruhlar va qolgan joylar.
        </p>
      </header>
      <TeacherCoursesPanel directory={teacherDirectory} demoEnabled={demoEnabled} />
    </div>
  );
}
