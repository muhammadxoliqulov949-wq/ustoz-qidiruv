import { Star } from "lucide-react";
import type { Course } from "@/data/models";
import { reviewsForCourse } from "@/data/reviews";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { formatDateUz } from "./date";

/**
 * Written testimonials — only the small fictional sample that exists in
 * the review store is shown; the count line always defers to the listing
 * aggregate so the section can never inflate numbers. When a course has
 * no written reviews yet, an honest empty state replaces the list.
 */
export function CourseReviews({ course }: { course: Course }) {
  const reviews = reviewsForCourse(course.id);
  const aggregateLabel =
    course.reviews > 0
      ? `Bu ko‘rsatilgan — ${formatCount(course.reviews)} ta fikrning bir qismi.`
      : null;

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-surface-muted px-5 py-8 text-center">
        <p className="text-base font-medium text-ink-900">
          Bu kurs bo‘yicha hali yozma fikr yo‘q
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
          {course.reviews > 0
            ? "O‘rtacha reyting va fikrlar soni kurs kartochkasidagi ko‘rsatkichlar bo‘yicha hisoblanadi — sahifada faqat tasdiqlangan yozma fikrlar chiqadi."
            : "Darsdan so‘ng birinchi fikrni siz qoldirishingiz mumkin bo‘ladi — fikr qoldirish imkoniyati shaxsiy kabinet bilan birga ishga tushadi."}
        </p>
      </div>
    );
  }

  return (
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
                <p className="truncate text-sm font-semibold text-ink-900">
                  {review.author}
                </p>
                <p className="text-xs text-ink-400">{formatDateUz(review.date)}</p>
              </div>
              {/* Value only, no stars-per-unit claim beyond the number. */}
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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {aggregateLabel ?? "Fikrlar soni — kurs kartochkasidagi ko‘rsatkich."}
        </p>
        <ButtonLink href="/courses" variant="ghost" size="sm">
          Boshqa kurslarni ko‘rish
        </ButtonLink>
      </div>
    </div>
  );
}
