"use client";

import { Badge, Button, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  COURSE_DRAFT_STATUS_LABELS,
  COURSE_DRAFT_STATUS_NOTES,
  type CourseDraftReview,
  type CourseStepId,
} from "@/lib/course-draft";

/* -------------------------------------------------------------------------- */
/* Review / preview — Phase 10.                                                 */
/*                                                                              */
/* This is the ONLY preview surface: an in-dashboard, read-only rendering of    */
/* the complete review projection (lib/course-draft.ts). Draft data is never    */
/* written into /courses/[slug] and never enters the canonical catalog — the    */
/* public marketplace stays canonical-only in this phase, so nothing here can   */
/* masquerade as a published listing. Every section links back to the step      */
/* that owns it, so fixing something is one click and no data is lost.          */
/* -------------------------------------------------------------------------- */

export function CourseReviewView({
  review,
  onEditStep,
  startDateLabel,
}: {
  review: CourseDraftReview;
  onEditStep: (step: CourseStepId) => void;
  /** Server-independent ISO → Uzbek label (passed in; no Intl in the island). */
  startDateLabel: (iso: string) => string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AuthNotice
        variant={review.complete ? "info" : "warning"}
        title={
          review.complete
            ? "Ko‘rinish tayyor — lekin bu ommaviy e’lon emas"
            : "Ba’zi maydonlar to‘ldirilmagan"
        }
      >
        {review.complete
          ? "Quyidagi ko‘rinish kurs qanday tuzilganini to‘liq ko‘rsatadi. Ma’lumot faqat shu brauzerda saqlanadi: katalogda chiqmaydi, o‘quvchilar ko‘rmaydi, moderatsiya va e’lon qilish ulanmagan."
          : "Quyida to‘ldirilmagan joylar “To‘ldirilmagan” deb ko‘rsatilgan. Qoralamani shundayligicha saqlash mumkin, ammo “Ko‘rib chiqishga tayyor” holatiga o‘tkazish uchun hammasi to‘ldirilishi kerak."}
      </AuthNotice>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={review.status === "ready" ? "success" : "neutral"}>
          {COURSE_DRAFT_STATUS_LABELS[review.status]}
        </Badge>
        <Badge variant="neutral">Mahalliy prototip ma’lumoti</Badge>
        <span className="text-sm text-ink-500">
          {COURSE_DRAFT_STATUS_NOTES[review.status]}
        </span>
      </div>

      {/* ------------------------------ summary ------------------------------ */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">Umumiy ma’lumot</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep("basics")}>
            Asosiy ma’lumotlarni tahrirlash
          </Button>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {review.sections.map((section) => (
            <div key={section.label} className="flex min-w-0 flex-col">
              <dt className="text-sm text-ink-500">{section.label}</dt>
              <dd
                className={
                  section.value === null
                    ? "text-base text-ink-400"
                    : "text-base break-words text-ink-900"
                }
              >
                {section.value ?? "To‘ldirilmagan"}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ------------------------------- groups ------------------------------ */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">
            Guruhlar{" "}
            <span className="text-base font-normal text-ink-500">
              ({review.groups.length})
            </span>
          </h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep("groups")}>
            Guruhlarni tahrirlash
          </Button>
        </div>
        {review.groups.length === 0 ? (
          <p className="text-base text-ink-400">Guruh qo‘shilmagan.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {review.groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-surface-muted px-3 py-2"
              >
                <span className="text-sm font-medium text-ink-900">
                  {group.title}
                  <span className="ms-2 font-normal text-ink-700">
                    {group.scheduleLabel}
                  </span>
                </span>
                <span className="text-sm text-ink-500">
                  {group.startDate === ""
                    ? "Sana kiritilmagan"
                    : startDateLabel(group.startDate)}{" "}
                  ·{" "}
                  {group.capacity > 0
                    ? `${group.capacity} ta joy (reja)`
                    : "Sig‘im kiritilmagan"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-ink-500">
          Band qilingan joylar ko‘rsatilmaydi — prototipda haqiqiy yozilish
          hisobi yo‘q.
        </p>
      </Card>

      {/* ------------------------------ syllabus ----------------------------- */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">Dastur</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep("syllabus")}>
            Dasturni tahrirlash
          </Button>
        </div>
        {review.syllabus.length === 0 ? (
          <p className="text-base text-ink-400">Modul qo‘shilmagan.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {review.syllabus.map((module, index) => (
              <li key={module.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <p className="text-base font-medium text-ink-900">
                  {index + 1}.{" "}
                  {module.title === "" ? (
                    <span className="text-ink-400">Nomsiz modul</span>
                  ) : (
                    module.title
                  )}
                  {module.lessons !== null ? (
                    <span className="ms-2 text-sm font-normal text-ink-500">
                      {module.lessons} dars
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-ink-700">
                  {module.description === "" ? (
                    <span className="text-ink-400">Tavsif yo‘q</span>
                  ) : (
                    module.description
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ------------------------------- detail ------------------------------ */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink-900">Kurs tafsilotlari</h3>
          <Button variant="ghost" size="sm" onClick={() => onEditStep("detail")}>
            Tafsilotlarni tahrirlash
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink-900">Kurs haqida</h4>
          <p className="mt-1 text-base leading-relaxed text-pretty text-ink-700">
            {review.longDescription ?? (
              <span className="text-ink-400">To‘ldirilmagan</span>
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-ink-900">Kim uchun</h4>
            {review.audience.length === 0 ? (
              <p className="mt-1 text-base text-ink-400">To‘ldirilmagan</p>
            ) : (
              <ul className="mt-1 list-disc ps-5 text-base text-ink-700">
                {review.audience.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-900">Nimalarni o‘rganadi</h4>
            {review.learningOutcomes.length === 0 ? (
              <p className="mt-1 text-base text-ink-400">To‘ldirilmagan</p>
            ) : (
              <ul className="mt-1 list-disc ps-5 text-base text-ink-700">
                {review.learningOutcomes.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
