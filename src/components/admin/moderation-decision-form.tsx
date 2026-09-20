"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  publishCourseAction,
  requestCourseChangesAction,
} from "@/server/actions/admin-moderation";
import {
  MODERATION_FEEDBACK_MAX_LENGTH,
  MODERATION_FEEDBACK_MIN_LENGTH,
  PUBLISH_CONFIRMATION_NOTE,
  REQUEST_CHANGES_CONFIRMATION_NOTE,
} from "@/lib/course-moderation";

/* -------------------------------------------------------------------------- */
/* Publish / request-changes controls — Phase 15.                              */
/*                                                                              */
/* TWO named decisions, no status picker. There is no field in either payload    */
/* that names a target state, and `.strict()` rejects one if a caller invents it. */
/*                                                                              */
/* `publishable` comes from the server's own rule check and is used ONLY to      */
/* explain a disabled button — the action re-runs the same rules under a row     */
/* lock, so re-enabling the button in devtools changes nothing.                  */
/*                                                                              */
/* Publishing is the one irreversible step in this phase, so the confirmation    */
/* note states plainly what becomes public and that the teacher loses edit       */
/* access to it.                                                                 */
/* -------------------------------------------------------------------------- */

export function ModerationDecisionForm({
  reviewId,
  courseId,
  courseTitle,
  publishable,
  blockedReason,
  pending: isPending,
}: {
  reviewId: string;
  courseId: string;
  courseTitle: string;
  publishable: boolean;
  blockedReason: string | null;
  /**
   * Whether a DECISION is still possible. Same reasoning as the verification
   * form: the component stays mounted after the decision so its `role="status"`
   * confirmation is announced and stays on screen (an unmount would remove the
   * live region mid-announcement).
   */
  pending: boolean;
}) {
  const router = useRouter();
  const feedbackId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const trimmed = feedback.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MODERATION_FEEDBACK_MIN_LENGTH;

  function publish() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("reviewId", reviewId);
    form.set("courseId", courseId);
    startTransition(async () => {
      const result = await publishCourseAction(form);
      if (result.ok) {
        setDone(`“${courseTitle}” e’lon qilindi va saytda darhol ko‘rinadi.`);
        router.refresh();
        return;
      }
      setError(result.message ?? "Qarorni saqlab bo‘lmadi.");
    });
  }

  function requestChanges() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("reviewId", reviewId);
    form.set("courseId", courseId);
    form.set("feedback", trimmed);
    startTransition(async () => {
      const result = await requestCourseChangesAction(form);
      if (result.ok) {
        setDone("Kurs qoralamaga qaytarildi va sabab ustozga yuborildi.");
        setFeedback("");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.message ?? "Qarorni saqlab bo‘lmadi.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {isPending ? (
        <p className="text-sm leading-relaxed text-ink-700">{PUBLISH_CONFIRMATION_NOTE}</p>
      ) : (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          Bu ariza bo‘yicha qaror qabul qilingan. Qaror o‘zgartirilmaydi: e’lon
          qilingan kursni orqaga qaytarish bu bosqichda yo‘q, qaytarilgan kurs esa
          ustoz tuzatib qayta yuborishi mumkin.
        </p>
      )}

      {isPending && !publishable && blockedReason ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">E’lon qilish hozir mumkin emas. </span>
          {blockedReason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" hidden={!isPending}>
        <Button type="button" size="sm" onClick={publish} disabled={pending || !publishable}>
          <Send aria-hidden="true" className="size-4" />
          E’lon qilish
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={open}
          aria-controls={feedbackId}
          onClick={() => {
            setOpen((value) => !value);
            setError(null);
          }}
          disabled={pending}
        >
          <Undo2 aria-hidden="true" className="size-4" />
          O‘zgartirish so‘rash
        </Button>
      </div>

      {open && isPending ? (
        <div id={feedbackId} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-4">
          <p className="text-sm leading-relaxed text-ink-700">
            {REQUEST_CHANGES_CONFIRMATION_NOTE}
          </p>
          <label htmlFor={`${feedbackId}-input`} className="text-sm font-medium text-ink-700">
            Sabab (majburiy, kamida {MODERATION_FEEDBACK_MIN_LENGTH} belgi)
          </label>
          <textarea
            id={`${feedbackId}-input`}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={MODERATION_FEEDBACK_MAX_LENGTH}
            rows={3}
            aria-describedby={`${feedbackId}-hint`}
            aria-invalid={tooShort || undefined}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600"
          />
          <p id={`${feedbackId}-hint`} className="text-sm text-ink-500">
            Ustozga aynan shu matn ko‘rinadi. Kurs qoralamaga qaytadi va ustoz uni
            tuzatib qayta yuborishi mumkin.
          </p>
          <div>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={requestChanges}
              disabled={pending || trimmed.length < MODERATION_FEEDBACK_MIN_LENGTH}
            >
              Sabab bilan qaytarish
            </Button>
          </div>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Saqlanmoqda…</span> : null}
        {done ? <span className="font-medium text-ink-900">{done}</span> : null}
        {error ? <span className="font-medium text-danger-ink">{error}</span> : null}
      </p>
    </div>
  );
}
