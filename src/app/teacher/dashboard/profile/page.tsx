import type { Metadata } from "next";
import { teacherDirectory } from "@/data/teacher-dashboard";
import { TeacherProfilePanel } from "@/components/teacher-dashboard/profile-panel";

export const metadata: Metadata = { title: "Profil" };

/* /teacher/dashboard/profile — catalog record (read-only) + Phase 6 teacher draft. */
export default function TeacherProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Profil
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Ommaviy profil ma’lumotlari va Phase 6 ustoz onboarding qoralamasi.
        </p>
      </header>
      <TeacherProfilePanel directory={teacherDirectory} />
    </div>
  );
}
