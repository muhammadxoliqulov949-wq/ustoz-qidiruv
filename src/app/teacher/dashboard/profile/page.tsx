import type { Metadata } from "next";
import { teacherDirectory } from "@/data/teacher-dashboard";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherProfilePanel } from "@/components/teacher-dashboard/profile-panel";
import { TeacherSavedProfile } from "@/components/teacher-dashboard/saved-profile";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherProfile } from "@/server/repo";
import { ProfileImageManager } from "@/components/teacher-dashboard/profile-image-manager";
import { teacherProfileMedia } from "@/server/file-service";
import { storageStatus } from "@/server/storage";
import { MEDIA_STORAGE_DISABLED_NOTE } from "@/lib/media";

export const metadata: Metadata = { title: "Profil" };

/* /teacher/dashboard/profile — catalog record (read-only) + Phase 6 teacher draft. */
export default async function TeacherProfilePage() {
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const user = await requireRolePage("teacher", "/teacher/dashboard/profile");
  const profile = await getTeacherProfile(user.id);
  const demoEnabled = demoWorkspaceEnabled();

  /*
   * PHASE 18 MEDIA. The MANAGED image wins; the legacy `/media/...` path that
   * seeded profiles carry stays as the fallback, so a teacher who never uploads
   * sees exactly what they saw before this phase.
   */
  const media = await teacherProfileMedia(user.id);
  const storage = storageStatus();
  const displayPhoto = media.managedUrl ?? profile?.photo ?? null;
  const storageNote = storage.enabled ? null : MEDIA_STORAGE_DISABLED_NOTE;

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
      <ProfileImageManager
        displayUrl={displayPhoto}
        hasManagedImage={media.hasManaged}
        teacherName={profile?.name ?? "Ustoz"}
        storageNote={storageNote}
      />
      <TeacherSavedProfile profile={profile} />
      <TeacherProfilePanel directory={teacherDirectory} demoEnabled={demoEnabled} />
    </div>
  );
}
