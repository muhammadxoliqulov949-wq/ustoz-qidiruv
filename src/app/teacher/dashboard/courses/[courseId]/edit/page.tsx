import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courseAuthoringOptions } from "@/data/course-authoring";
import { teacherWorkspaceOptions } from "@/data/teacher-dashboard";
import { CourseEditor } from "@/components/teacher-dashboard/course-editor";
import { DbCourseEditor } from "@/components/teacher-dashboard/db-course-editor";
import { isLocalDraftId } from "@/lib/course-draft";
import { categories } from "@/data/categories";
import { onboardingCities } from "@/lib/onboarding";
import { requireRolePage } from "@/server/auth/guards";
import { getOwnedCourseDetail } from "@/server/repo";

export const metadata: Metadata = { title: "Kurs qoralamasi" };

export const dynamic = "force-dynamic";

/* /teacher/dashboard/courses/[courseId]/edit
 *
 * `courseId` is a LOCAL prototype draft id (`cd-…`) — never a canonical course
 * id and never a public slug, so this route can never be mistaken for editing a
 * marketplace listing. A structurally impossible id 404s on the server; a
 * well-formed id that does not belong to the current workspace fails honestly
 * inside the editor (it cannot be distinguished from "does not exist" — that is
 * exactly the isolation we want).
 *
 * PHASE 12: a `crs-…` id is a SERVER course owned by the signed-in teacher and
 * is edited through server actions. Ownership is re-checked in SQL by
 * getOwnedCourseDetail, so another teacher's id is indistinguishable from a
 * nonexistent one — both 404. The legacy local (`cd-…`) editor is kept so
 * Phase 10 drafts remain reachable and nothing the teacher typed is lost. */
export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  if (!isLocalDraftId(courseId)) {
    const user = await requireRolePage(
      "teacher",
      `/teacher/dashboard/courses/${courseId}/edit`,
    );
    const detail = await getOwnedCourseDetail(courseId, user.id);
    if (!detail) notFound();

    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
            {detail.course.title}
          </h1>
          <p className="max-w-prose text-base text-ink-500">
            O‘zgarishlar hisobingizga bog‘langan holda serverda saqlanadi.
          </p>
        </header>
        <DbCourseEditor
          course={{
            id: detail.course.id,
            slug: detail.course.slug,
            status: detail.course.status,
            title: detail.course.title,
            categoryId: detail.course.categoryId,
            level: detail.course.level,
            format: detail.course.format,
            city: detail.course.city,
            location: detail.course.location,
            priceUzs: detail.course.priceUzs,
            summary: detail.course.summary,
            longDescription: detail.course.longDescription ?? "",
          }}
          groups={detail.groups.map((group) => ({
            id: group.id,
            title: group.title,
            days: group.days,
            startTime: group.startTime,
            endTime: group.endTime,
            startDate: group.startDate,
            capacity: group.capacity,
          }))}
          modules={detail.modules.map((item) => ({
            id: item.id,
            position: item.position,
            title: item.title,
            description: item.description ?? "",
            lessons: item.lessons,
          }))}
          categories={categories.map(({ id, name }) => ({ id, name }))}
          cities={[...onboardingCities]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Kurs qoralamasi
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Mahalliy prototip ma’lumoti. O‘zgarishlar shu brauzerda avtomatik
          saqlanadi; katalogdagi kurslarga ta’sir qilmaydi.
        </p>
      </header>
      <CourseEditor
        draftId={courseId}
        options={courseAuthoringOptions}
        teachers={teacherWorkspaceOptions.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
