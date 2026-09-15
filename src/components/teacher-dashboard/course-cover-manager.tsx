"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { UploadField } from "@/components/media/upload-field";
import { MEDIA_REMOVED_NOTE } from "@/lib/media";
import { removeCourseCoverAction, uploadCourseCoverAction } from "@/server/actions/media";

/* -------------------------------------------------------------------------- */
/* Course cover manager — Phase 18.                                            */
/*                                                                              */
/* `editable` is decided on the SERVER from the course lifecycle (Phase 15's     */
/* lock rules) and only controls what is SHOWN: the actions re-check ownership    */
/* and status against the database, so a crafted request from a frozen course    */
/* is refused regardless of what this island renders.                           */
/* -------------------------------------------------------------------------- */

export interface CourseCoverManagerProps {
  courseId: string;
  coverUrl: string | null;
  editable: boolean;
  /** Why editing is locked right now (under review, or published). */
  lockedNote: string | null;
  /** Honest explanation when uploads are not configured in this deployment. */
  storageNote: string | null;
}

export function CourseCoverManager({
  courseId,
  coverUrl,
  editable,
  lockedNote,
  storageNote,
}: CourseCoverManagerProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(): void {
    startTransition(async () => {
      const form = new FormData();
      form.set("courseId", courseId);
      const result = await removeCourseCoverAction(form);
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
        <h2 className="text-lg font-semibold text-ink-900">Kurs muqovasi</h2>
        <p className="max-w-prose text-sm text-ink-500">
          Muqova kurs kartochkasida va kurs sahifasida ko‘rinadi. Keng (landshaft)
          rasm yaxshi natija beradi.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-muted">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-400">
              Muqova yo‘q
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {editable && !lockedNote ? (
            <UploadField
              purpose="course_cover_image"
              action={uploadCourseCoverAction}
              extraFields={{ courseId }}
              label={coverUrl ? "Muqovani almashtirish" : "Muqova yuklash"}
              disabledNote={storageNote}
            />
          ) : (
            <p className="max-w-prose text-sm text-ink-500">
              {storageNote ?? lockedNote ?? "Muqovani hozir o‘zgartirib bo‘lmaydi."}
            </p>
          )}

          {editable && !lockedNote && coverUrl && !storageNote ? (
            confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-700">Muqovani o‘chirasizmi?</span>
                <Button type="button" variant="secondary" size="sm" loading={pending} onClick={remove}>
                  Ha, o‘chirish
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Bekor qilish
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Muqovani o‘chirish
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
              : "text-sm font-medium text-red-700"
        }
      >
        {status?.text ?? ""}
      </p>
    </section>
  );
}
