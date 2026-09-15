import type { Metadata } from "next";
import { DbCoursesPanel } from "@/components/teacher-dashboard/db-courses-panel";
import { LegacyLocalDrafts } from "@/components/teacher-dashboard/legacy-local-drafts";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherDashboardCourses, getTeacherProfile } from "@/server/repo";
import { getTeacherModerationStates } from "@/server/moderation-service";
import type { CourseModerationView } from "@/components/teacher-dashboard/db-courses-panel";

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
  const [{ published, drafts }, profile, moderationStates] = await Promise.all([
    getTeacherDashboardCourses(user.id),
    getTeacherProfile(user.id),
    getTeacherModerationStates(user.id),
  ]);

  /*
   * A serializable moderation snapshot for the panel: the live review state, the
   * latest decided review and its feedback. Only this account's courses can be in
   * the map — the service queries by the session user id.
   */
  const moderation: Record<string, CourseModerationView> = {};
  for (const [courseId, state] of moderationStates) {
    moderation[courseId] = {
      reviewStatus: state.pendingReview?.status ?? state.latestDecision?.status ?? null,
      latestFeedback: state.latestDecision?.feedback ?? null,
    };
  }

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
        moderation={moderation}
      />
      <LegacyLocalDrafts />
    </div>
  );
}
