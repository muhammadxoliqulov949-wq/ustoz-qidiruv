import { ChevronDown } from "lucide-react";
import type { Course } from "@/data/models";
import { buildCourseFaq } from "@/data/course-faq";

/**
 * FAQ — native <details>/<summary>: correct disclosure semantics with
 * zero JavaScript. Answers are generated from the same typed fields the
 * UI shows (see data/course-faq.ts), so payment honesty and venue text
 * can never drift from the listing.
 */
export function CourseFaq({ course }: { course: Course }) {
  const items = buildCourseFaq(course);
  return (
    <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((item) => (
        <details key={item.q} className="group/faq px-4 sm:px-5">
          <summary
            className={
              "flex cursor-pointer list-none items-center justify-between gap-4 py-4 " +
              "text-base font-medium text-ink-900 [&::-webkit-details-marker]:hidden"
            }
          >
            {item.q}
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-400 transition-transform duration-fast group-open/faq:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="-mt-1 pb-4 pe-8 text-sm text-ink-700">{item.a}</p>
        </details>
      ))}
    </dl>
  );
}
