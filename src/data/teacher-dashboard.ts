import { categories } from "./categories";
import {
  cityLabel,
  courseFormatLabels,
  courseLevelLabels,
  courses,
} from "./courses";
import { teacherRows } from "./teacher-rows";
import { formatDateUz } from "@/components/course-detail/date";
import { formatPrice } from "@/lib/format";
import type {
  TeacherCourseLite,
  TeacherDirectory,
  TeacherWorkspaceLite,
} from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* Teacher dashboard projection — DERIVED, never a second dataset.             */
/* Built once at module scope from the canonical teacherRows (themselves        */
/* computed from teachers.ts + courses.ts) and the course catalog, then handed   */
/* to the teacher-dashboard client islands as plain JSON. Ownership comes from   */
/* the canonical course.teacher.id relationship — there is no hand-maintained    */
/* teacher→course mapping anywhere in this phase.                               */
/* -------------------------------------------------------------------------- */

const categoryById = new Map(categories.map((category) => [category.id, category]));

function toCourseLite(courseId: string): TeacherCourseLite | null {
  const course = courses.find((entry) => entry.id === courseId);
  if (!course) return null;
  const unit = course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta";
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    image: course.image,
    category: categoryById.get(course.categoryId)?.name ?? null,
    format: course.format,
    formatLabel: courseFormatLabels[course.format],
    location: course.format === "online" ? null : course.location,
    levelLabel: courseLevelLabels[course.level],
    priceSummary:
      course.priceUzs === 0 ? "Bepul" : `${formatPrice(course.priceUzs)} / ${unit}`,
    priceUzs: course.priceUzs,
    rating: course.rating,
    reviews: course.reviews,
    students: course.students,
    publishedAt: course.publishedAt,
    publishedAtLabel: formatDateUz(course.publishedAt),
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
    // Authoring snapshot (Phase 10). Derived here, never stored anywhere.
    authoringSeed: {
      title: course.title,
      categoryId: course.categoryId,
      level: course.level,
      summary: course.detail.summary,
      teachingLanguages: course.detail.teachingLanguages,
      format: course.format,
      city: course.city,
      location: course.location ?? "",
      priceUzs: course.priceUzs,
      groups: course.detail.groups.map((group) => ({
        title: group.title,
        days: group.days,
        startTime: group.startTime,
        capacity: group.capacity,
        startDate: group.startDate,
      })),
      syllabus: course.detail.syllabus.map((module) => ({
        title: module.title,
        description: module.description,
        lessons: module.lessons,
      })),
      longDescription: course.detail.longDescription,
      audience: course.detail.audience,
      learningOutcomes: course.detail.learningOutcomes,
    },
  };
}

const workspaces: TeacherWorkspaceLite[] = teacherRows.map((row) => {
  const { teacher } = row;
  return {
    id: teacher.id,
    slug: teacher.slug,
    name: teacher.name,
    photo: teacher.photo,
    verified: teacher.verified,
    specialization: teacher.specialization,
    bio: teacher.bio,
    approach: teacher.detail.approach,
    rating: teacher.rating,
    reviews: teacher.reviews,
    students: teacher.students,
    experienceYears: teacher.experienceYears,
    languages: teacher.languages,
    cities: row.cities,
    cityLabels: row.cities.map((city) => cityLabel(city)),
    formatLabels: row.formats.map((format) => courseFormatLabels[format]),
    categoryNames: row.categoryNames.filter((name) => name !== ""),
    courses: row.courseIds
      .map(toCourseLite)
      .filter((course): course is TeacherCourseLite => course !== null),
  };
});

/** The full serializable projection (ids + display strings only). */
export const teacherDirectory: TeacherDirectory = { workspaces };

/**
 * Compact option list for the workspace picker — the picker must not receive
 * the whole directory just to render a <select>.
 */
export const teacherWorkspaceOptions: {
  id: string;
  name: string;
  specialization: string;
  photo: string | null;
  courseCount: number;
}[] = workspaces.map((workspace) => ({
  id: workspace.id,
  name: workspace.name,
  specialization: workspace.specialization,
  photo: workspace.photo,
  courseCount: workspace.courses.length,
}));
