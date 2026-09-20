"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui";
import { publishReviewAction, rejectReviewAction } from "@/server/actions/reviews";
import {
  REVIEW_PUBLISH_CONFIRMATION_NOTE,
  REVIEW_REASON_MAX_LENGTH,
  REVIEW_REASON_MIN_LENGTH,
  REVIEW_REJECT_CONFIRMATION_NOTE,
  canTransitionReview,
  type ReviewStatus,
} from "@/lib/reviews";

/* -------------------------------------------------------------------------- */
/* Review moderation controls — Phase 19.                                      */
/*                                                                              */
/* TWO named decisions, no status picker: `publishReviewAction` and                */
/* `rejectReviewAction`. There is no field that names a target state, so a caller  */
/* cannot ask for `status = 'published'` — and neither action is reachable without */
/* an admin session, which the server checks again inside the transaction.         */
/*                                                                              */
/* WHAT THE BUTTONS PROMISE is stated on screen: publishing makes the text public  */
/* and moves a course's and a teacher's rating immediately. The operator is told   */
/* that before they click, not after.                                              */
/*                                                                              */
/* The optional reason is optional: leaving it blank is a valid rejection. When one */
/* IS written it must clear the same minimum the database CHECK enforces, so the   */
/* form cannot produce a rejection the table would refuse.                         */
/*                                                                              */
/* The component stays mounted after a decision so its `role="status"` region      */
/* survives to be announced, and the buttons follow the SAME transition table the  */
/* service consults — so the UI can never offer a decision the server would        */
/* refuse.                                                                        */
/* -------------------------------------------------------------------------- */

export function ReviewDecisionForm({
  reviewId,
  courseSlug,
  status,
}: {
  reviewId: string;
  courseSlug: string;
  status: ReviewStatus;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canPublish = canTransitionReview("admin", status, "published");
  const canReject = canTransitionReview("admin", status, "rejected");
  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REVIEW_REASON_MIN_LENGTH;

  function publish() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("reviewId", reviewId);
    form.set("courseSlug", courseSlug);
    startTransition(async () => {
      const result = await publishReviewAction(form);
      if (result.ok) {
        setDone("Fikr e’lon qilindi va reyting yangilandi.");
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function reject() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("reviewId", reviewId);
    form.set("courseSlug", courseSlug);
    form.set("reason", trimmed);
    startTransition(async () => {
      const result = await rejectReviewAction(form);
      if (result.ok) {
        setDone("Fikr e’lon qilinmadi va reytingdan chiqarildi.");
        setReason("");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  if (!canPublish && !canReject) {
    return (
      <p className="text-sm leading-relaxed text-ink-500">
        Bu holatdagi fikr bo‘yicha qaror qabul qilinmaydi. O‘quvchi uni tahrirlab
        qayta yuborsa, ariza yana navbatga tushadi.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canPublish ? (
          <Button type="button" size="sm" onClick={publish} disabled={pending}>
            <Send aria-hidden="true" className="size-4" />
            E’lon qilish
          </Button>
        ) : null}
        {canReject ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={open}
            aria-controls={reasonId}
            onClick={() => {
              setOpen((value) => !value);
              setError(null);
            }}
            disabled={pending}
          >
            <X aria-hidden="true" className="size-4" />
            E’lon qilmaslik
          </Button>
        ) : null}
      </div>

      {open && canReject ? (
        <div
          id={reasonId}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-4"
        >
          <p className="text-sm leading-relaxed text-ink-700">{REVIEW_REJECT_CONFIRMATION_NOTE}</p>
          <label htmlFor={`${reasonId}-input`} className="text-sm font-medium text-ink-700">
            Sabab (ixtiyoriy, yozilsa kamida {REVIEW_REASON_MIN_LENGTH} belgi)
          </label>
          <textarea
            id={`${reasonId}-input`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REVIEW_REASON_MAX_LENGTH}
            rows={3}
            aria-describedby={`${reasonId}-hint`}
            aria-invalid={tooShort || undefined}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600"
          />
          <p id={`${reasonId}-hint`} className="text-sm text-ink-500">
            Bo‘sh qoldirsangiz qaror sababsiz qabul qilinadi. Yozilsa o‘quvchiga
            aynan shu matn ko‘rinadi.
          </p>
          <div>
            <Button type="button" size="sm" variant="danger" onClick={reject} disabled={pending || tooShort}>
              E’lon qilmaslik
            </Button>
          </div>
        </div>
      ) : null}

      {canPublish && !open ? (
        <p className="text-sm leading-relaxed text-ink-500">{REVIEW_PUBLISH_CONFIRMATION_NOTE}</p>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Saqlanmoqda…</span> : null}
        {done ? <span className="font-medium text-ink-900">{done}</span> : null}
        {error ? <span className="font-medium text-danger-ink">{error}</span> : null}
      </p>
    </div>
  );
}
