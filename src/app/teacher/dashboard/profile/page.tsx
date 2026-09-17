import type { Metadata } from "next";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherProfileEditor } from "@/components/teacher-dashboard/profile-editor";
import { TeacherProfilePanel } from "@/components/teacher-dashboard/profile-panel";
import { TeacherSavedProfile } from "@/components/teacher-dashboard/saved-profile";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherProfile } from "@/server/repo";
import { ProfileImageManager } from "@/components/teacher-dashboard/profile-image-manager";
import { teacherProfileMedia } from "@/server/file-service";
import { storageStatus } from "@/server/storage";
import { MEDIA_STORAGE_DISABLED_NOTE } from "@/lib/media";
import { profileToEditValues } from "@/lib/teacher-profile";

export const metadata: Metadata = { title: "Profil" };

/*
 * /teacher/dashboard/profile — the teacher's OWN persisted profile, editable.
 *
 * Order matters: the managed image uploader, then the form that writes the
 * `teacher_profiles` row, then a read-only echo of what is stored, then the
 * legacy browser-only draft panel. The editable form is not optional here — it
 * is the only way to fill the fields /teacher/dashboard/verification requires.
 */
export default async function TeacherProfilePage() {
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const user = await requireRolePage("teacher", "/teacher/dashboard/profile");
  const profile = await getTeacherProfile(user.id);
  const demoEnabled = demoWorkspaceEnabled();
  /* Phase 20: the legacy catalogue projection is loaded ONLY for the dev-only
   * demo inspector. Production (flag off) never imports fixture inventory. */
  const directory = demoEnabled
    ? (await import("@/data/teacher-dashboard")).teacherDirectory
    : { workspaces: [] };

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
      {/* The persisted profile, editable — the fields verification requires. */}
      <TeacherProfileEditor
        initialValues={profileToEditValues(profile)}
        verificationState={profile?.verification ?? "unverified"}
      />
      <TeacherSavedProfile profile={profile} />
      <TeacherProfilePanel directory={directory} demoEnabled={demoEnabled} />
    </div>
  );
}
