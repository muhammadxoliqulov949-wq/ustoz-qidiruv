"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  rejectTeacherVerificationAction,
  verifyTeacherAction,
} from "@/server/actions/admin-verification";
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from "@/lib/teacher-verification";

/* -------------------------------------------------------------------------- */
/* Verify / reject controls — Phase 15.                                        */
/*                                                                              */
/* Rendered only when the server says a live application exists, and the server */
/* re-checks that under a row lock anyway: a stale tab that still shows these    */
/* buttons gets a typed error, not a second decision.                            */
/*                                                                              */
/* The reviewer identity is NOT a prop and NOT a hidden field — the action reads */
/* it from the session. Nothing here can attribute a decision to another admin.  */
/*                                                                              */
/* Wording: rejecting sends the teacher a REQUIRED, visible reason and returns   */
/* their profile to `unverified` so they can fix it and re-apply. The confirm    */
/* note says exactly that, because "Rad etish" alone sounds terminal.            */
/* -------------------------------------------------------------------------- */

export function VerificationDecisionForm({
  requestId,
  teacherUserId,
  teacherName,
  pending: isPending,
}: {
  requestId: string;
  teacherUserId: string;
  teacherName: string;
  /**
   * Whether a DECISION is still possible.
   *
   * The form stays mounted after a decision (with the controls removed) rather
   * than being replaced by a different element: React would then unmount this
   * component and the `role="status"` confirmation would vanish before a screen
   * reader could finish announcing it. Keeping one element in place means the
   * result is announced AND remains visible.
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
  const tooShort = trimmed.length > 0 && trimmed.length < FEEDBACK_MIN_LENGTH;

  function approve() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("requestId", requestId);
    form.set("teacherUserId", teacherUserId);
    startTransition(async () => {
      const result = await verifyTeacherAction(form);
      if (result.ok) {
        setDone(`${teacherName} tasdiqlandi va ustozga bildirishnoma yuborildi.`);
        router.refresh();
        return;
      }
      setError(result.message ?? "Qarorni saqlab bo‘lmadi.");
    });
  }

  function reject() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("requestId", requestId);
    form.set("teacherUserId", teacherUserId);
    form.set("feedback", trimmed);
    startTransition(async () => {
      const result = await rejectTeacherVerificationAction(form);
      if (result.ok) {
        setDone(`Ariza qaytarildi va sabab ustozga yuborildi.`);
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
        <p className="text-sm leading-relaxed text-ink-700">
          Tasdiqlansa ustoz profili tasdiqlangan hisoblanadi va kursini e’lon qilish
          huquqi paydo bo‘ladi. Qaytarilsa profil yana “tasdiqlanmagan” holatga
          o‘tadi, sabab ustozga yuboriladi va u tuzatib qayta yuborishi mumkin.
        </p>
      ) : (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          Bu ariza bo‘yicha qaror qabul qilingan. Qaror o‘zgartirilmaydi — ustoz
          qayta ariza yuborsa, yangi ariza navbatga tushadi.
        </p>
      )}

      <div className="flex flex-wrap gap-2" hidden={!isPending}>
        <Button type="button" size="sm" onClick={approve} disabled={pending}>
          <Check aria-hidden="true" className="size-4" />
          Tasdiqlash
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
          <X aria-hidden="true" className="size-4" />
          Qaytarish
        </Button>
      </div>

      {open && isPending ? (
        <div id={feedbackId} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-4">
          <label htmlFor={`${feedbackId}-input`} className="text-sm font-medium text-ink-700">
            Sabab (majburiy, kamida {FEEDBACK_MIN_LENGTH} belgi)
          </label>
          <textarea
            id={`${feedbackId}-input`}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={FEEDBACK_MAX_LENGTH}
            rows={3}
            aria-describedby={`${feedbackId}-hint`}
            aria-invalid={tooShort || undefined}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600"
          />
          <p id={`${feedbackId}-hint`} className="text-sm text-ink-500">
            Ustozga aynan shu matn ko‘rinadi: nimani to‘ldirishi yoki o‘zgartirishi
            kerakligini qisqa va aniq yozing.
          </p>
          <div>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={reject}
              disabled={pending || trimmed.length < FEEDBACK_MIN_LENGTH}
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
