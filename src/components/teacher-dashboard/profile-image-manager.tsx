"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button } from "@/components/ui";
import { UploadField } from "@/components/media/upload-field";
import { MEDIA_PUBLIC_NOTE, MEDIA_REMOVED_NOTE } from "@/lib/media";
import { removeTeacherProfileImageAction, uploadTeacherProfileImageAction } from "@/server/actions/media";

/* -------------------------------------------------------------------------- */
/* Profile image manager — Phase 18.                                          */
/*                                                                              */
/* The image shown is ALREADY resolved on the server (managed asset first,       */
/* legacy `/media/...` path as fallback), so this island never has to know where  */
/* a picture came from — it only manages the managed one.                        */
/* -------------------------------------------------------------------------- */

export interface ProfileImageManagerProps {
  /** Whatever the profile should display right now. */
  displayUrl: string | null;
  /** TRUE only when a managed upload is the current image. */
  hasManagedImage: boolean;
  /** Teacher display name, used for the accessible label. */
  teacherName: string;
  /** Honest explanation when uploads are not configured in this deployment. */
  storageNote: string | null;
}

export function ProfileImageManager({
  displayUrl,
  hasManagedImage,
  teacherName,
  storageNote,
}: ProfileImageManagerProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(): void {
    startTransition(async () => {
      const form = new FormData();
      const result = await removeTeacherProfileImageAction(form);
      setConfirming(false);
      if (result.ok) {
        setStatus({ tone: "ok", text: MEDIA_REMOVED_NOTE });
        router.refresh();
      } else {
        setStatus({ tone: "error", text: result.message });
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink-900">Profil rasmi</h2>
        <p className="max-w-prose text-sm text-ink-500">{MEDIA_PUBLIC_NOTE}</p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        {/*
          One component owns "person image or initials", so the manager cannot
          drift from how the avatar is rendered everywhere else. The remote
          pattern for a managed image is configured narrowly in next.config.ts
          from the storage origin — never a wildcard host.
        */}
        <Avatar name={teacherName} src={displayUrl} size="xl" />

        <div className="flex flex-col gap-3">
          <UploadField
            purpose="teacher_profile_image"
            action={uploadTeacherProfileImageAction}
            label={displayUrl ? "Rasmni almashtirish" : "Rasm yuklash"}
            disabledNote={storageNote}
          />

          {hasManagedImage && !storageNote ? (
            confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-700">Rasmni o‘chirasizmi?</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={pending}
                  onClick={remove}
                >
                  Ha, o‘chirish
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                >
                  Bekor qilish
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Rasmni o‘chirish
              </Button>
            )
          ) : null}
        </div>
      </div>

      <p
        role={status?.tone === "error" ? "alert" : "status"}
        className={
          status === null
            ? "sr-only"
            : status.tone === "ok"
              ? "text-sm font-medium text-accent-700"
              : "text-sm font-medium text-danger-ink"
        }
      >
        {status?.text ?? ""}
      </p>
    </section>
  );
}
