import type { Metadata } from "next";
import { ProfilePanel } from "@/components/dashboard/profile-panel";
import { SavedProfile } from "@/components/dashboard/saved-profile";
import { requireRolePage } from "@/server/auth/guards";
import { getStudentProfile } from "@/server/repo";

export const metadata: Metadata = {
  title: "Profil",
};

/* /dashboard/profile — the persisted profile (server, from the session) above
 * the Phase 6 StudentAnswers editor, which remains a local draft until it is
 * explicitly saved. Two sources, clearly labelled, never blended. */
export default async function DashboardProfilePage() {
  const user = await requireRolePage("student", "/dashboard/profile");
  const profile = await getStudentProfile(user.id);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Profil
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          O‘quvchi ma’lumotlari va o‘qish afzalliklari — onboarding bilan bir xil
          maydonlar.
        </p>
      </header>
      <SavedProfile profile={profile} />
      <ProfilePanel />
    </div>
  );
}
