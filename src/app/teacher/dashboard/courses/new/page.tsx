import type { Metadata } from "next";
import { courseAuthoringOptions } from "@/data/course-authoring";
import { teacherWorkspaceOptions } from "@/data/teacher-dashboard";
import { CourseEditor } from "@/components/teacher-dashboard/course-editor";

export const metadata: Metadata = { title: "Yangi kurs" };

/* /teacher/dashboard/courses/new — creates ONE local prototype draft for the
 * current workspace and immediately replaces the URL with the draft's stable
 * edit route, so a refresh resumes instead of creating another draft.
 * Course management deliberately lives inside the teacher dashboard; no public
 * dynamic route is added, so /courses/[slug] stays canonical-only. */
export default function NewCoursePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Yangi kurs qoralamasi
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Ma’lumotlar bosqichma-bosqich to‘ldiriladi va faqat shu brauzerda
          saqlanadi — katalogda chiqmaydi.
        </p>
      </header>
      <CourseEditor
        draftId={null}
        options={courseAuthoringOptions}
        teachers={teacherWorkspaceOptions.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
