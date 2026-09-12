import type { Metadata } from "next";
import { DbCoursesPanel } from "@/components/teacher-dashboard/db-courses-panel";
import { LegacyLocalDrafts } from "@/components/teacher-dashboard/legacy-local-drafts";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherDashboardCourses, getTeacherProfile } from "@/server/repo";

export const metadata: Metadata = { title: "Kurslarim" };

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard/courses — Phase 12.                                      */
/*                                                                              */
/* The PRIMARY list is server-rendered from the database for the SIGNED-IN      */
/* teacher: ownership comes from the session, never from a workspace id held    */
/* in the browser. localStorage is no longer part of this experience.           */
/*                                                                              */
/* Phase 10 local drafts are not deleted and not uploaded. They are listed      */
/* separately and labelled as legacy browser-only records (see                  */
/* LegacyLocalDrafts) so nothing the teacher typed silently disappears.         */
/*                                                                              */
/* RENDERING: dynamic — account data, never prerendered.                        */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export default async function TeacherCoursesPage() {
  const user = await requireRolePage("teacher", "/teacher/dashboard/courses");
  const [{ published, drafts }, profile] = await Promise.all([
    getTeacherDashboardCourses(user.id),
    getTeacherProfile(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Kurslarim
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Hisobingizga bog‘langan kurslar va server qoralamalari.
        </p>
      </header>
      <DbCoursesPanel
        published={published}
        drafts={drafts}
        teacherSlug={profile?.slug ?? null}
      />
      <LegacyLocalDrafts />
    </div>
  );
}
