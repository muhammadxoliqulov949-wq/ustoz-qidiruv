"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Send, Star, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  createReviewAction,
  updateReviewAction,
  withdrawReviewAction,
} from "@/server/actions/reviews";
import {
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_BODY_MIN_LENGTH,
  REVIEW_EDIT_RETURNS_TO_PENDING_NOTE,
  REVIEW_ELIGIBILITY_LABEL,
  REVIEW_PUBLISHED_LABEL,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_SUBMIT_LABEL,
  REVIEW_WITHDRAWN_LABEL,
  canStudentEdit,
  canStudentWithdraw,
  normalizeReviewBody,
  type ReviewStatus,
} from "@/lib/reviews";

/* -------------------------------------------------------------------------- */
/* Review form — Phase 19. The ONE client island this phase adds.              */
/*                                                                              */
/* WHAT IT SENDS: the course, which of the student's own accepted enrollments the  */
/* review is about, a rating and a body. Nothing else. There is no author field,   */
/* no status field, no role and no student id — the server takes the author from   */
/* the session cookie and `.strict()` REJECTS a payload that invents one, so       */
/* "identity is never an input" is true at the wire, not just in the service.      */
/*                                                                              */
/* WHAT IT PROMISES: only what the workflow does. Submitting says the review goes  */
/* to moderation; it never says "published". Editing a published review says       */
/* plainly that it leaves the page and the rating until it is approved again.      */
/*                                                                              */
/* WHY IT EXISTS AS AN ISLAND: a rating picker, a live character count and an      */
/* inline result need state. Everything else on the page — the list, the counts,   */
/* the eligibility copy — is server-rendered and stays that way.                   */
/*                                                                              */
/* A11Y: real labelled controls, `aria-invalid` + a hint on the body, a radio      */
/* group for the rating (keyboard-operable, each option announced), and a          */
/* `role="status"` live region for the outcome.                                    */
/* -------------------------------------------------------------------------- */

const RATINGS = [1, 2, 3, 4, 5] as const;

const RATING_LABELS: Record<number, string> = {
  1: "1 — juda yomon",
  2: "2 — yomon",
  3: "3 — o‘rtacha",
  4: "4 — yaxshi",
  5: "5 — a’lo",
};

export interface ReviewFormEnrollment {
  id: string;
  groupTitle: string;
}

export function ReviewForm({
  courseSlug,
  courseId,
  /** The student's accepted, already-started enrollments — server-provided. */
  enrollments,
  /** Present when the student already has a row to edit rather than create. */
  existing,
}: {
  courseSlug: string;
  courseId: string;
  enrollments: ReviewFormEnrollment[];
  existing: { id: string; rating: number; body: string; status: ReviewStatus } | null;
}) {
  const router = useRouter();
  const groupId = useId();
  const bodyId = useId();
  const hintId = useId();
  const statusId = useId();

  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const normalized = normalizeReviewBody(body);
  const tooShort = normalized.length > 0 && normalized.length < REVIEW_BODY_MIN_LENGTH;
  const ratingMissing = rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX;
  const canSave = !ratingMissing && normalized.length >= REVIEW_BODY_MIN_LENGTH && !pending;

  const isEdit = existing !== null && canStudentEdit(existing.status);
  const wasPublished = existing?.status === "published";

  function reset() {
    setError(null);
    setDone(null);
  }

  function openForm() {
    reset();
    setRating(existing?.rating ?? 0);
    setBody(existing?.body ?? "");
    setOpen(true);
  }

  function save() {
    reset();
    const form = new FormData();
    form.set("rating", String(rating));
    form.set("body", normalized);
    form.set("courseSlug", courseSlug);
    startTransition(async () => {
      const result = isEdit
        ? await updateReviewAction(withReviewId(form, existing!.id))
        : await createReviewAction(
            withCourseAndEnrollment(form, courseId, enrollmentId),
          );
      if (result.ok) {
        setDone(
          isEdit
            ? "Fikringiz yangilandi va tekshiruvga qaytdi."
            : "Fikringiz yuborildi va tekshiruvga olingan.",
        );
        setOpen(false);
        setBody("");
        setRating(0);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function withdraw() {
    if (!existing) return;
    reset();
    const form = new FormData();
    form.set("courseSlug", courseSlug);
    startTransition(async () => {
      const result = await withdrawReviewAction(withReviewId(form, existing.id));
      if (result.ok) {
        setDone("Fikringiz qaytarib olindi.");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  const remaining = REVIEW_BODY_MAX_LENGTH - normalized.length;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink-900">
            {existing ? "Sizning fikringiz" : REVIEW_SUBMIT_LABEL}
          </p>
          <p className="mt-0.5 text-sm text-ink-500">
            {REVIEW_ELIGIBILITY_LABEL} sifatida yozasiz. Fikr administrator
            tekshiruvidan so‘ng e’lon qilinadi.
          </p>
        </div>
        {existing ? (
          <div className="flex flex-wrap gap-2">
            {isEdit ? (
              <Button type="button" size="sm" variant="outline" onClick={openForm} disabled={pending}>
                <Pencil aria-hidden="true" className="size-4" />
                Tahrirlash
              </Button>
            ) : null}
            {canStudentWithdraw(existing.status) ? (
              <Button type="button" size="sm" variant="ghost" onClick={withdraw} disabled={pending}>
                <Undo2 aria-hidden="true" className="size-4" />
                Qaytarib olish
              </Button>
            ) : null}
          </div>
        ) : (
          <Button type="button" size="sm" onClick={openForm} disabled={pending || open}>
            <Send aria-hidden="true" className="size-4" />
            {REVIEW_SUBMIT_LABEL}
          </Button>
        )}
      </div>

      {existing ? (
        <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Star aria-hidden="true" className="size-4 fill-rating text-rating stroke-0" />
            {existing.rating.toFixed(1)}
            <span className="font-normal text-ink-500">
              {existing.status === "published"
                ? REVIEW_PUBLISHED_LABEL
                : existing.status === "withdrawn"
                  ? REVIEW_WITHDRAWN_LABEL
                  : "Tekshirilmoqda"}
            </span>
          </div>
          <p className="mt-2 text-base text-ink-700">{existing.body}</p>
        </div>
      ) : null}

      {open ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save();
          }}
        >
          {wasPublished ? (
            <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm leading-relaxed text-ink-700">
              {REVIEW_EDIT_RETURNS_TO_PENDING_NOTE}
            </p>
          ) : null}

          <fieldset>
            <legend className="text-sm font-medium text-ink-900">Bahoyingiz</legend>
            <div
              role="radiogroup"
              aria-label="Kursga baho"
              className="mt-2 flex flex-wrap gap-2"
            >
              {RATINGS.map((value) => {
                const selected = rating === value;
                return (
                  <label
                    key={value}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm transition-colors duration-fast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-600"
                    data-selected={selected || undefined}
                    style={
                      selected
                        ? { borderColor: "var(--color-accent-600)", background: "var(--color-accent-50)" }
                        : { borderColor: "var(--color-line)" }
                    }
                  >
                    <input
                      type="radio"
                      name={`${groupId}-rating`}
                      value={value}
                      checked={selected}
                      onChange={() => {
                        setRating(value);
                        reset();
                      }}
                      className="sr-only"
                    />
                    <Star
                      aria-hidden="true"
                      className={
                        selected ? "size-4 fill-rating text-rating stroke-0" : "size-4 text-ink-300"
                      }
                    />
                    <span className={selected ? "font-semibold text-ink-900" : "text-ink-700"}>
                      {value}
                    </span>
                    <span className="sr-only">{RATING_LABELS[value]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={bodyId} className="text-sm font-medium text-ink-900">
              Fikringiz
            </label>
            <textarea
              id={bodyId}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                reset();
              }}
              rows={5}
              maxLength={REVIEW_BODY_MAX_LENGTH}
              aria-describedby={hintId}
              aria-invalid={tooShort || undefined}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600"
            />
            <p id={hintId} className="text-sm text-ink-500">
              Kamida {REVIEW_BODY_MIN_LENGTH} belgi. Qolgan {Math.max(0, remaining)} belgi.
            </p>
          </div>

          {!isEdit && enrollments.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-900">Qaysi guruh bo‘yicha</span>
              <div className="flex flex-wrap gap-2">
                {enrollments.map((enrollment) => (
                  <label
                    key={enrollment.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm"
                  >
                    <input
                      type="radio"
                      name={`${groupId}-enrollment`}
                      value={enrollment.id}
                      checked={enrollmentId === enrollment.id}
                      onChange={() => setEnrollmentId(enrollment.id)}
                    />
                    {enrollment.groupTitle}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!canSave}>
              <Check aria-hidden="true" className="size-4" />
              {isEdit ? "O‘zgarishlarni yuborish" : REVIEW_SUBMIT_LABEL}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={pending}
            >
              Bekor qilish
            </Button>
          </div>
        </form>
      ) : null}

      <p id={statusId} role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Saqlanmoqda…</span> : null}
        {done ? <span className="font-medium text-ink-900">{done}</span> : null}
        {error ? <span className="font-medium text-danger-ink">{error}</span> : null}
      </p>
    </div>
  );
}

function withReviewId(form: FormData, reviewId: string): FormData {
  form.set("reviewId", reviewId);
  return form;
}

function withCourseAndEnrollment(
  form: FormData,
  courseId: string,
  enrollmentRequestId: string,
): FormData {
  form.set("courseId", courseId);
  form.set("enrollmentRequestId", enrollmentRequestId);
  return form;
}
