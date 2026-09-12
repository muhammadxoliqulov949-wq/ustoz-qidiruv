import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories } from "@/data/categories";
import { courseFormatLabels, courses } from "@/data/courses";
import type { Course } from "@/data/models";
import { teacherById } from "@/data/teachers";
import { formatPrice } from "@/lib/format";
import { formatDateUz } from "@/components/course-detail/date";
import type { EnrollCourseLite } from "@/lib/enroll";
import { EnrollFlow } from "@/components/enroll/enroll-flow";
import { getCurrentUser } from "@/server/auth/session";

/* -------------------------------------------------------------------------- */
/* /enroll/[courseSlug]?group=<id> — the enrollment flow host (Phase 7).         */
/* Server-resolved: unknown course slugs 404 (same registry rule as the detail   */
/* pages); the raw ?group= value is handed to the flow UNFILTERED because        */
/* lib/enroll.resolveEnrollGroup applies the same pure rules server and client — */
/* there is exactly one interpretation of "selected group" everywhere.           */
/* Phase 11: the SESSION is resolved here, on the server. A signed-in student   */
/* gets a real transactional enrollment write; everyone else keeps the honest   */
/* local-only prototype result. The visitor never tells us who they are.        */
/* -------------------------------------------------------------------------- */

const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
const categoryById = new Map(categories.map((category) => [category.id, category]));

/** Serialize the catalog slice this flow consumes — labels computed once. */
function toLite(course: Course): EnrollCourseLite {
  const teacher = teacherById.get(course.teacher.id);
  return {
    slug: course.slug,
    title: course.title,
    image: course.image,
    category: categoryById.get(course.categoryId)?.name ?? null,
    teacherName: course.teacher.name,
    teacherSlug: teacher?.slug ?? null,
    teacherVerified: teacher?.verified ?? false,
    priceUzs: course.priceUzs,
    priceSummary:
      course.priceUzs === 0
        ? "Bepul"
        : `${formatPrice(course.priceUzs)} / ${
            course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta"
          }`,
    priceUnitLabel: course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta",
    groups: course.detail.groups.map((group) => ({
      id: group.id,
      title: group.title,
      days: group.days,
      startTime: group.startTime,
      format: group.format,
      formatLabel: courseFormatLabels[group.format],
      location: group.location,
      capacity: group.capacity,
      seatsRemaining: group.seatsRemaining,
      startDate: group.startDate,
      startDateLabel: formatDateUz(group.startDate),
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = courseBySlug.get(courseSlug);
  return {
    // Transactional flow — indexable? No: keep search out of it, like auth.
    title: course ? `Yozilish — ${course.title}` : "Yozilish",
    robots: { index: false, follow: true },
  };
}

export default async function EnrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseSlug } = await params;
  const query = await searchParams;
  const course = courseBySlug.get(courseSlug);
  if (!course) notFound();

  const lite = toLite(course);
  const rawGroup = typeof query.group === "string" ? query.group : null;
  // Identity strictly from the session cookie — never from the form or URL.
  const user = await getCurrentUser();

  return (
    <div className="site-container py-10 sm:py-14 lg:py-16">
      <div className="mx-auto w-full max-w-[58rem]">
        <EnrollFlow
          course={lite}
          courseId={course.id}
          canSubmitToServer={user?.role === "student"}
          requestedGroupId={rawGroup}
        />
      </div>
    </div>
  );
}
