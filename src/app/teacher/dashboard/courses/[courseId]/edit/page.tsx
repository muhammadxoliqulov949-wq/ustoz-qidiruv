import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courseAuthoringOptions } from "@/data/course-authoring";
import { teacherWorkspaceOptions } from "@/data/teacher-dashboard";
import { CourseEditor } from "@/components/teacher-dashboard/course-editor";
import { isLocalDraftId } from "@/lib/course-draft";

export const metadata: Metadata = { title: "Kurs qoralamasi" };

/* /teacher/dashboard/courses/[courseId]/edit
 *
 * `courseId` is a LOCAL prototype draft id (`cd-…`) — never a canonical course
 * id and never a public slug, so this route can never be mistaken for editing a
 * marketplace listing. A structurally impossible id 404s on the server; a
 * well-formed id that does not belong to the current workspace fails honestly
 * inside the editor (it cannot be distinguished from "does not exist" — that is
 * exactly the isolation we want). */
export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  if (!isLocalDraftId(courseId)) notFound();

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
