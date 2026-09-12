import { categories } from "./categories";
import { courseFormatLabels, courses } from "./courses";
import { teachers } from "./teachers";
import { formatPrice } from "@/lib/format";
import { formatDateUz } from "@/components/course-detail/date";
import type { DashCatalog, DashCourseLite, DashTeacherLite } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* Dashboard catalog projection — DERIVED, never a second dataset.             */
/* Built once at module scope from the canonical courses/teachers/categories    */
/* arrays and handed to the dashboard client islands as plain JSON. Course and  */
/* teacher facts (titles, prices, groups, seats) therefore have exactly one      */
/* source; a change in courses.ts flows through here with no edit.              */
/* -------------------------------------------------------------------------- */

const categoryById = new Map(categories.map((category) => [category.id, category]));
const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

const dashCourses: DashCourseLite[] = courses.map((course) => {
  const teacher = teacherById.get(course.teacher.id);
  const unit = course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta";
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    image: course.image,
    category: categoryById.get(course.categoryId)?.name ?? null,
    formatLabel: courseFormatLabels[course.format],
    location: course.format === "online" ? null : course.location,
    teacherName: course.teacher.name,
    teacherSlug: teacher?.slug ?? null,
    priceSummary:
      course.priceUzs === 0
        ? "Bepul"
        : `${formatPrice(course.priceUzs)} / ${unit}`,
    priceUzs: course.priceUzs,
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
});

const dashTeachers: DashTeacherLite[] = teachers.map((teacher) => ({
  id: teacher.id,
  slug: teacher.slug,
  name: teacher.name,
  photo: teacher.photo,
  verified: teacher.verified,
  specialization: teacher.specialization,
  activeCourses: teacher.activeCourses,
}));

/** The full serializable projection (small: ids + display strings only). */
export const dashboardCatalog: DashCatalog = {
  courses: dashCourses,
  teachers: dashTeachers,
};
