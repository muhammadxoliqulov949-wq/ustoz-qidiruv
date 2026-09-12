import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatCount } from "@/lib/format";
import { courseReviews } from "@/data/reviews";
import type { Course, CourseReview } from "@/data/models";
import { formatDateUz } from "@/components/course-detail/date";

/* -------------------------------------------------------------------------- */
/* Teacher reviews block (Phase 5) — composed from the SAME review store the       */
/* course pages use, filtered to this teacher's courses. No teacher-level           */
/* review data exists, so none is shown; the listing aggregates stay the source      */
/* for counts, and an honest empty state replaces the list when nothing has been     */
/* written.                                                                        */
/* -------------------------------------------------------------------------- */

export function TeacherReviews({ courses }: { courses: Course[] }) {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const entries: { review: CourseReview; course: Course }[] = courseReviews
    .flatMap((review) => {
      const course = courseById.get(review.courseId);
      return course ? [{ review, course }] : [];
    })
    .sort((a, b) => b.review.date.localeCompare(a.review.date));

  const totalAggregate = courses.reduce((sum, course) => sum + course.reviews, 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
        <p className="text-base font-medium text-ink-900">
          Bu ustoz kurslari bo‘yicha hali yozma fikr yo‘q
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
          {totalAggregate > 0
            ? "O‘rtacha reyting kurs kartochkalaridagi jamoan ko‘rsatkichlar asosida hisoblanadi — sahifada faqat tasdiqlangan yozma fikrlar chiqadi."
            : "Fikr qoldirish imkoniyati shaxsiy kabinet bilan birga ishga tushadi."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {entries.map(({ review, course }) => (
          <li
            key={review.id}
            className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
          >
            <div className="flex items-center gap-3">
              <Avatar name={review.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {review.author}
                </p>
                <p className="text-xs text-ink-400">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="text-ink-500 underline-offset-4 transition-colors duration-fast hover:text-accent-700 hover:underline"
                  >
                    {course.title}
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
            <p className="mt-3 text-base text-ink-700">{review.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-500">
        Bu ko‘rsatilgan — ustoz kurslari bo‘yicha {formatCount(totalAggregate)} ta
        fikrning bir qismi.
      </p>
    </div>
  );
}
