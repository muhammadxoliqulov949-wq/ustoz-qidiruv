"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatDateUz } from "@/components/course-detail/date";
import {
  COURSE_DRAFT_STATUS_LABELS,
  COURSE_DRAFT_STATUS_NOTES,
  courseDraftIssues,
  draftsForTeacher,
  draftFromSeed,
  type CourseAuthoringSeed,
} from "@/lib/course-draft";
import { useTeacherWorkspace } from "./workspace-store";
import { useCourseDraftStore } from "./course-draft-store";

/* -------------------------------------------------------------------------- */
/* Local course drafts — Phase 10, rendered under the canonical course list on  */
/* /teacher/dashboard/courses.                                                  */
/*                                                                              */
/* It is deliberately a SEPARATE section from "Kurslarim": canonical catalog     */
/* courses and local prototype drafts are different things and the UI never      */
/* blurs them. Ownership comes from draftsForTeacher(), so another workspace's   */
/* drafts are not merely hidden — they are never read into this view.            */
/* -------------------------------------------------------------------------- */

export function CourseDraftsPanel() {
  const workspace = useTeacherWorkspace();
  const drafts = useCourseDraftStore();

  if (!workspace.ready || !drafts.ready) {
    // Reserved height matches the resolved section (CLS lesson from Phase 8).
    return (
      <section aria-labelledby="tw-drafts" className="min-h-[16rem]">
        <h2 id="tw-drafts" className="text-xl font-semibold text-ink-900">
          Mahalliy kurs qoralamalari
        </h2>
        <p className="mt-2 text-base text-ink-500" role="status">
          Brauzer holati o‘qilmoqda…
        </p>
      </section>
    );
  }

  const mine = draftsForTeacher(drafts.store, workspace.teacherId);

  return (
    <section aria-labelledby="tw-drafts" className="flex min-h-[16rem] flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="tw-drafts" className="text-xl font-semibold text-ink-900">
          Mahalliy kurs qoralamalari{" "}
          <span className="text-base font-normal text-ink-500">({mine.length})</span>
        </h2>
        <ButtonLink
          href="/teacher/dashboard/courses/new"
          size="sm"
          leadingIcon={<FilePlus2 aria-hidden="true" />}
        >
          Yangi kurs yaratish
        </ButtonLink>
      </div>

      {mine.length === 0 ? (
        <EmptyState title="Qoralama yo‘q">
          Hali kurs qoralamasi yaratmagansiz. Qoralama faqat shu brauzerda
          saqlanadi, katalogda chiqmaydi va hech qayerga yuborilmaydi.
          <p className="mt-3">
            <Link
              href="/teacher/dashboard/courses/new"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Birinchi qoralamani boshlash
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {mine.map((draft) => {
            const issues = Object.keys(courseDraftIssues(draft)).length;
            return (
              <li key={draft.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 text-base leading-snug font-semibold text-ink-900">
                      {draft.title.trim() === "" ? "Nomsiz qoralama" : draft.title.trim()}
                    </h3>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge variant={draft.status === "ready" ? "success" : "neutral"}>
                        {COURSE_DRAFT_STATUS_LABELS[draft.status]}
                      </Badge>
                      <Badge variant="neutral">Katalogda chiqmagan</Badge>
                    </div>
                  </div>

                  <p className="text-sm text-ink-500">
                    {COURSE_DRAFT_STATUS_NOTES[draft.status]}{" "}
                    {issues > 0
                      ? `To‘ldirilishi kerak bo‘lgan maydonlar: ${issues} ta.`
                      : "Barcha majburiy maydonlar to‘ldirilgan."}
                  </p>

                  <p className="text-sm text-ink-500">
                    Oxirgi o‘zgarish: {formatDateUz(draft.updatedAt.slice(0, 10))}
                    {draft.copiedFromCourseId !== null
                      ? " · katalogdagi kursdan nusxa"
                      : null}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <ButtonLink
                      href={`/teacher/dashboard/courses/${draft.id}/edit`}
                      variant="outline"
                      size="sm"
                    >
                      Tahrirlash
                    </ButtonLink>
                    <ButtonLink
                      href={`/teacher/dashboard/courses/${draft.id}/edit?step=review`}
                      variant="ghost"
                      size="sm"
                    >
                      Ko‘rish
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** “Copy into a NEW local draft” — the only way a canonical course becomes
 *  editable. It never mutates the seed record; it creates a separate draft
 *  that is clearly marked as a copy. */
export function CopyCourseToDraftButton({
  courseId,
  seed,
}: {
  courseId: string;
  /** Authoring-shaped snapshot of the canonical course, built server-side. */
  seed: CourseAuthoringSeed;
}) {
  const workspace = useTeacherWorkspace();
  const { ready, create } = useCourseDraftStore();
  const router = useRouter();

  if (!ready || workspace.teacherId === null) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const draft = draftFromSeed(
          seed,
          workspace.teacherId as string,
          courseId,
          new Date().toISOString(),
        );
        create(draft);
        router.push(`/teacher/dashboard/courses/${draft.id}/edit`);
      }}
    >
      Nusxadan qoralama yaratish
    </Button>
  );
}
