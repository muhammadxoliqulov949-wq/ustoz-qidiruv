import type { Course } from "@/data/models";

/**
 * Syllabus — a reusable flat numbered list (every module stays visible,
 * printable, and works at 390px with zero JS; an accordion would hide the
 * structure the evaluation step depends on). Content comes entirely from
 * `course.detail.syllabus`; lesson counts are informational only — this is
 * not an LMS.
 */
export function CourseSyllabus({ course }: { course: Course }) {
  const totalLessons = course.detail.syllabus.reduce((sum, module) => sum + module.lessons, 0);

  return (
    <div>
      <p className="text-sm text-ink-500">
        {course.detail.syllabus.length} modul · {totalLessons} dars
      </p>
      <ol className="mt-4 space-y-3">
        {course.detail.syllabus.map((module, index) => (
          <li
            key={module.title}
            className="flex gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 sm:px-5"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 w-7 shrink-0 text-base font-semibold tabular-nums text-accent-600"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink-900">
                {module.title}
                <span className="ml-2 text-sm font-normal text-ink-400">
                  {module.lessons} dars
                </span>
              </h3>
              <p className="mt-1 text-sm text-ink-700">{module.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
