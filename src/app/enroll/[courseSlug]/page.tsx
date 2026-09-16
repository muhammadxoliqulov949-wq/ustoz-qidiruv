import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories } from "@/data/categories";
import { courseFormatLabels } from "@/data/courses";
import type { Course, Teacher } from "@/data/models";
import { formatPrice } from "@/lib/format";
import { formatDateUz } from "@/components/course-detail/date";
import type { EnrollCourseLite } from "@/lib/enroll";
import { EnrollFlow } from "@/components/enroll/enroll-flow";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicCourseBySlug, getPublicTeacherById } from "@/server/public-repo";

/* -------------------------------------------------------------------------- */
/* /enroll/[courseSlug]?group=<id> — the enrollment flow host.                  */
/*                                                                              */
/* Course, groups and live seats come from the same request-time public         */
/* marketplace projection as /courses/[slug]. getPublicCourseBySlug() selects   */
/* only published rows, so an unknown, draft or otherwise unpublished slug      */
/* resolves to the same 404 here as it does on the course detail route.         */
/*                                                                              */
/* The raw ?group= value is handed to the flow UNFILTERED because                */
/* lib/enroll.resolveEnrollGroup applies the same pure rules server and client  */
/* — there is exactly one interpretation of "selected group" everywhere.       */
/*                                                                              */
/* The SESSION is resolved here, on the server. A signed-in student gets a real  */
/* transactional enrollment write; everyone else keeps the honest local-only    */
/* result. The visitor never tells us who they are.                              */
/* -------------------------------------------------------------------------- */

// This route reads live marketplace inventory and must never query during build.
export const dynamic = "force-dynamic";

const categoryById = new Map(categories.map((category) => [category.id, category]));

/** Serialize the runtime marketplace projection consumed by the client flow. */
function toLite(course: Course, teacher: Teacher | null): EnrollCourseLite {
  return {
    slug: course.slug,
    title: course.title,
    image: course.image,
    category: categoryById.get(course.categoryId)?.name ?? null,
    // The course projection is DB truth when the teacher's public profile is
    // unavailable; the full public profile supplies the link when it is public.
    teacherName: teacher?.name ?? course.teacher.name,
    teacherSlug: teacher?.slug ?? null,
    teacherVerified: teacher?.verified ?? course.teacher.verified,
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
  const course = await getPublicCourseBySlug(courseSlug);
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
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();

  const [teacher, user] = await Promise.all([
    getPublicTeacherById(course.teacher.id),
    getCurrentUser(),
  ]);
  const lite = toLite(course, teacher);
  const rawGroup = typeof query.group === "string" ? query.group : null;

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
