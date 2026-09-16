import { Star } from "lucide-react";
import type { Course } from "@/data/models";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import {
  REVIEW_ANONYMOUS_NOTE,
  REVIEW_ELIGIBILITY_LABEL,
  REVIEW_NOT_ENROLLED_NOTE,
  REVIEW_NOT_STARTED_NOTE,
  REVIEW_PENDING_LABEL,
  REVIEW_PENDING_NOTE,
  REVIEW_REJECTED_LABEL,
  REVIEW_REJECTED_NOTE,
  REVIEWS_AGGREGATE_NOTE,
  REVIEWS_EMPTY_BODY,
  REVIEWS_EMPTY_TITLE,
  REVIEW_STATUS_LABEL,
} from "@/lib/reviews";
import type { OwnReviewView, PublicReviewView, ReviewEligibility } from "@/server/review-service";
import { formatDateUz } from "./date";
import { ReviewForm } from "./review-form";

/* -------------------------------------------------------------------------- */
/* Written testimonials — Phase 19, PostgreSQL-backed.                         */
/*                                                                              */
/* WHAT CHANGED. This component used to import a compiled-in list of fictional    */
/* reviews. It now renders only what `getCourseReviewContext` read from the        */
/* database, and that read selects `status = 'published'` rows in SQL. There is no */
/* fixture to fall back to — the file that held them is deleted — so a course with */
/* no approved reviews shows the honest empty state and nothing else.             */
/*                                                                              */
/* THE NUMBERS AND THE LIST NOW AGREE BY CONSTRUCTION. `course.reviews` is         */
/* `courses.reviews_count`, which is a cached count of exactly these rows, so the  */
/* "part of N reviews" line can no longer describe a number the list contradicts.  */
/* When the count is zero the copy says zero rather than implying a bigger set.    */
/*                                                                              */
/* PRIVACY. Each entry is the safe projection: a rating, the text, a date and the  */
/* shared author label. No name, no phone, no email, no user id — not because they */
/* are hidden here, but because the query never selected them. The body is         */
/* rendered as a React text child, so it is escaped and raw HTML cannot execute.   */
/*                                                                              */
/* THE STUDENT PANEL is server-decided: eligibility, the student's own row and     */
/* whether they may submit are all computed from the session and the database. A   */
/* visitor who cannot write sees an explanation, never a disabled form that        */
/* pretends they could.                                                          */
/* -------------------------------------------------------------------------- */

export interface CourseReviewsProps {
  course: Course;
  /** Published reviews, newest first — already the safe public projection. */
  reviews: PublicReviewView[];
  eligibility: ReviewEligibility;
  /** The signed-in student's own review, whatever its status. */
  own: OwnReviewView | null;
  canSubmit: boolean;
}

export function CourseReviews({ course, reviews, eligibility, own, canSubmit }: CourseReviewsProps) {
  const aggregateLabel =
    course.reviews > 0
      ? `Bu ko‘rsatilgan — ${formatCount(course.reviews)} ta e’lon qilingan fikrning bir qismi.`
      : REVIEWS_AGGREGATE_NOTE;

  return (
    <div className="flex flex-col gap-6">
      <StudentReviewPanel
        course={course}
        eligibility={eligibility}
        own={own}
        canSubmit={canSubmit}
      />

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
          <p className="text-base font-medium text-ink-900">{REVIEWS_EMPTY_TITLE}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{REVIEWS_EMPTY_BODY}</p>
        </div>
      ) : (
        <div>
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={review.author} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{review.author}</p>
                    <p className="text-xs text-ink-400">{formatDateUz(review.date)}</p>
                  </div>
                  {/* Value only, no stars-per-unit claim beyond the number. */}
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-900"
                    aria-label={`Baho: ${review.rating}/5`}
                  >
                    <Star
                      className="size-4 fill-rating text-rating stroke-0"
                      aria-hidden="true"
                    />
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-base text-ink-700">{review.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">{aggregateLabel}</p>
            <ButtonLink href="/courses" variant="ghost" size="sm">
              Boshqa kurslarni ko‘rish
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The signed-in student's own place in this section.
 *
 * Four honest outcomes, and a fifth for everybody else:
 *   eligible + no review → the form;
 *   pending              → "tekshirilmoqda", with edit/withdraw still available;
 *   published            → their review as visitors see it, plus edit/withdraw;
 *   rejected/withdrawn   → a neutral status and the reason, plus resubmission;
 *   not eligible         → an explanation. NEVER a disabled form: a control that
 *                          looks fillable but cannot submit teaches the visitor
 *                          that the product is broken rather than that they are
 *                          not a participant.
 */
function StudentReviewPanel({
  course,
  eligibility,
  own,
  canSubmit,
}: {
  course: Course;
  eligibility: ReviewEligibility;
  own: OwnReviewView | null;
  canSubmit: boolean;
}) {
  if (!eligibility.eligible) {
    const note =
      eligibility.reason === "anonymous"
        ? REVIEW_ANONYMOUS_NOTE
        : eligibility.reason === "not_started"
          ? REVIEW_NOT_STARTED_NOTE
          : REVIEW_NOT_ENROLLED_NOTE;

    return (
      <div className="rounded-xl border border-line bg-surface-muted px-5 py-4">
        <p className="text-sm font-medium text-ink-900">Fikr qoldirish</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{note}</p>
        {eligibility.reason === "anonymous" ? (
          <p className="mt-2">
            <ButtonLink
              href={`/login?next=/courses/${course.slug}`}
              variant="outline"
              size="sm"
            >
              Tizimga kirish
            </ButtonLink>
          </p>
        ) : null}
      </div>
    );
  }

  if (canSubmit || own === null) {
    return (
      <ReviewForm
        courseSlug={course.slug}
        courseId={course.id}
        enrollments={eligibility.enrollments.map((enrollment) => ({
          id: enrollment.id,
          groupTitle: enrollment.groupTitle,
        }))}
        existing={null}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {own.status === "pending" ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">{REVIEW_PENDING_LABEL}. </span>
          {REVIEW_PENDING_NOTE}
        </p>
      ) : null}

      {own.status === "rejected" ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">{REVIEW_REJECTED_LABEL}.</span>{" "}
          {REVIEW_REJECTED_NOTE}
          {own.moderationReason ? (
            <>
              {" "}
              <span className="text-ink-900">Sabab:</span> {own.moderationReason}
            </>
          ) : null}
        </p>
      ) : null}

      {own.status === "withdrawn" ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          Fikringiz qaytarib olindi va reytingda hisoblanmaydi. Xohlasangiz qayta
          yuborishingiz mumkin.
        </p>
      ) : null}

      <p className="text-sm text-ink-500">
        Holat: {REVIEW_STATUS_LABEL[own.status]} · {REVIEW_ELIGIBILITY_LABEL}
      </p>

      <ReviewForm
        courseSlug={course.slug}
        courseId={course.id}
        enrollments={eligibility.enrollments.map((enrollment) => ({
          id: enrollment.id,
          groupTitle: enrollment.groupTitle,
        }))}
        existing={{
          id: own.id,
          rating: own.rating,
          body: own.body,
          status: own.status,
        }}
      />
    </div>
  );
}
