import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatCount } from "@/lib/format";
import { REVIEWS_AGGREGATE_NOTE } from "@/lib/reviews";
import type { PublicTeacherReviewView } from "@/server/review-service";
import { formatDateUz } from "@/components/course-detail/date";

/* -------------------------------------------------------------------------- */
/* Teacher reviews block — Phase 19, PostgreSQL-backed.                        */
/*                                                                              */
/* This used to filter the SAME compiled-in fixture list the course pages read.    */
/* It now receives published review rows read from `course_reviews`, joined to the */
/* teacher's own published courses by `courses.teacher_user_id` — so a review can  */
/* only appear here if it was written about a course this teacher actually owns    */
/* and that course is still public.                                              */
/*                                                                              */
/* THE COUNT IS THE SAME COUNT. `teacher.reviews` is                             */
/* `teacher_profiles.reviews_count`, a cached aggregate over exactly these rows    */
/* (computed as one flat mean, NOT an average of per-course averages, so a course  */
/* with one review cannot outweigh a course with fifty). When it is zero the       */
/* empty state says so instead of implying a hidden set.                         */
/*                                                                              */
/* Entries are the safe projection: rating, text, date, the shared author label    */
/* and the course it belongs to. No student identity leaves the query.             */
/* -------------------------------------------------------------------------- */

export function TeacherReviews({
  reviews,
  totalReviews,
}: {
  reviews: PublicTeacherReviewView[];
  /** `teacher_profiles.reviews_count` — the aggregate these rows produce. */
  totalReviews: number;
}) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
        <p className="text-base font-medium text-ink-900">
          Bu ustoz kurslari bo‘yicha hali yozma fikr yo‘q
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
          Fikrlarni faqat tasdiqlangan qatnashuvchilar yozadi va ular
          administrator tekshiruvidan so‘ng e’lon qilinadi.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
            <div className="flex items-center gap-3">
              <Avatar name={review.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{review.author}</p>
                <p className="text-xs text-ink-500">
                  <Link
                    href={`/courses/${review.courseSlug}`}
                    className="text-ink-500 underline-offset-4 transition-colors duration-fast hover:text-accent-700 hover:underline"
                  >
                    {review.courseTitle}
                  </Link>{" "}
                  · {formatDateUz(review.date)}
                </p>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-900"
                aria-label={`Baho: ${review.rating}/5`}
              >
                <Star className="size-4 fill-rating text-rating stroke-0" aria-hidden="true" />
                {review.rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-3 text-base text-ink-700">{review.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-500">
        {totalReviews > reviews.length
          ? `Bu ko‘rsatilgan — ustoz kurslari bo‘yicha ${formatCount(totalReviews)} ta e’lon qilingan fikrning bir qismi.`
          : REVIEWS_AGGREGATE_NOTE}
      </p>
    </div>
  );
}
