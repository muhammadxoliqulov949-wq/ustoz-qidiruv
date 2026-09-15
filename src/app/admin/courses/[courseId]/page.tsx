import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import {
  AdminField,
  AdminPanel,
  CourseStateBadge,
  ReviewStateBadge,
  VerificationBadge,
  formatAdminDate,
  formatAdminDateTime,
  isoDate,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ModerationDecisionForm } from "@/components/admin/moderation-decision-form";
import { getCourseReviewDetail } from "@/server/moderation-service";
import { COURSE_PUBLISHED_EDIT_LOCKED_NOTE } from "@/lib/course-moderation";
import { formatPrice } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* /admin/courses/[courseId] — one submission, decided here (Phase 15).        */
/*                                                                              */
/* The reviewer sees the WHOLE course as a student would: summary, description,  */
/* audience, outcomes, schedule and syllabus. That is the point — a publish      */
/* decision made without seeing the listing would be a rubber stamp.             */
/*                                                                              */
/* The page renders the decision form ONLY when the service says a live review   */
/* exists, and the service re-validates that when the form is submitted.         */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Kurs arizasi",
  robots: { index: false, follow: false },
};

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  /*
   * DEFENCE IN DEPTH (Phase 18). The layout renders the refusal screen for a
   * non-admin session, but this page must never PRODUCE data for one: Next
   * serialises page segments for the client router, and a signed evidence URL
   * or a document name must not reach a browser that is not an admin's.
   */
  const admin = await requireAdminPage("/admin/courses");
  if (!admin) return null;

  const { courseId } = await params;
  const detail = await getCourseReviewDetail(courseId);
  if (!detail) notFound();

  const { course, teacher, review } = detail;
  const liveReview = review && review.status === "pending" ? review : null;
  /*
   * The review the controls act on: the live one, or the most recent decided one
   * so its outcome is still reported after the refresh. `pending` gates the
   * buttons; the service independently refuses a decided review.
   */
  const targetReview = review ?? detail.history[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Yo‘nalish" className="text-sm text-ink-500">
          <Link href="/admin/courses" className="text-accent-700 underline underline-offset-2">
            Kurslar
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{course.title}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          {course.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <CourseStateBadge state={course.status} />
          {review ? <ReviewStateBadge state={review.status} /> : null}
          <VerificationBadge state={teacher.verification} />
        </div>
        <p className="text-base text-ink-700">
          Ustoz:{" "}
          <Link
            href={`/admin/teachers/${teacher.userId}`}
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            {teacher.name}
          </Link>{" "}
          · {formatAdminDate(course.createdAt)} da yaratilgan
          {course.publishedAt ? ` · ${course.publishedAt} dan beri e’lon qilingan` : ""}
        </p>
      </div>

      {/*
        PHASE 18: the moderator sees the SAME cover the marketplace will serve.
        No storage key, no bucket URL and no permanent private address is shown —
        only the resolved public image (or the honest "no cover" state).
      */}
      <AdminPanel
        title="Muqova"
        description={
          course.coverUrl
            ? "Kurs kartochkasida shu rasm ko‘rinadi."
            : "Bu kursda muqova rasmi yo‘q — kartochkada joy egallovchi fon ko‘rinadi."
        }
      >
        {course.coverUrl ? (
          <div className="relative h-40 w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface-muted">
            <Image
              src={course.coverUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
          </div>
        ) : (
          <p className="text-sm text-ink-500">Muqova yuklanmagan.</p>
        )}
      </AdminPanel>

      {/* ------------------------------- decision ------------------------------ */}
      <AdminPanel
        title={liveReview ? "Moderatsiya qarori" : "Qaror kutayotgan ariza yo‘q"}
        description={
          liveReview
            ? `${formatAdminDateTime(liveReview.submittedAt)} da yuborilgan.`
            : "Bu kursda qaror kutilayotgan ariza yo‘q."
        }
      >
        {targetReview ? (
          <ModerationDecisionForm
            reviewId={targetReview.id}
            courseId={course.id}
            courseTitle={course.title}
            publishable={detail.publishable}
            blockedReason={detail.publishBlockedReason}
            pending={targetReview.status === "pending"}
          />
        ) : (
          <EmptyState title="Ariza yo‘q" as="h3">
            {course.status === "published"
              ? COURSE_PUBLISHED_EDIT_LOCKED_NOTE
              : "Ustoz kursni ko‘rib chiqishga yuborsa, shu yerda qaror tugmalari paydo bo‘ladi."}
          </EmptyState>
        )}
      </AdminPanel>

      {/* -------------------------------- listing ------------------------------ */}
      <AdminPanel
        title="E’lon matni"
        description="Ommaviy sahifada ko‘rinadigan ma’lumotlar."
        action={
          course.status === "published" ? (
            <ButtonLink href={`/courses/${course.slug}`} variant="outline" size="sm">
              Ommaviy sahifani ochish
            </ButtonLink>
          ) : (
            <span className="text-sm text-ink-500">Ommaviy sahifa hali yo‘q</span>
          )
        }
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminField label="Kategoriya">{course.categoryId}</AdminField>
          <AdminField label="Daraja">{course.level}</AdminField>
          <AdminField label="Format">{course.format}</AdminField>
          <AdminField label="Narx — oyiga">{formatPrice(course.priceUzs)}</AdminField>
          <AdminField label="Shahar">{course.city ?? "—"}</AdminField>
          <AdminField label="Manzil">{course.location ?? "—"}</AdminField>
          <AdminField label="Dars jadvali">{course.schedule}</AdminField>
          <AdminField label="O‘qitish tillari">
            {course.teachingLanguages.length === 0
              ? "—"
              : course.teachingLanguages.join(", ")}
          </AdminField>
        </dl>

        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <div>
            <h3 className="text-sm text-ink-500">Qisqa tavsif</h3>
            <p className="mt-1 max-w-prose text-base leading-relaxed text-ink-900">
              {course.summary}
            </p>
          </div>
          <div>
            <h3 className="text-sm text-ink-500">Batafsil tavsif</h3>
            <p className="mt-1 max-w-prose text-base leading-relaxed whitespace-pre-line text-ink-900">
              {course.longDescription}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm text-ink-500">Kim uchun</h3>
              {course.audience.length === 0 ? (
                <p className="mt-1 text-base text-ink-900">—</p>
              ) : (
                <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-base text-ink-900">
                  {course.audience.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm text-ink-500">Natijalar</h3>
              {course.learningOutcomes.length === 0 ? (
                <p className="mt-1 text-base text-ink-900">—</p>
              ) : (
                <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-base text-ink-900">
                  {course.learningOutcomes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </AdminPanel>

      {/* -------------------------------- groups ------------------------------- */}
      <AdminPanel
        title="Guruhlar"
        description="Guruhsiz kurs e’lon qilinmaydi: o‘quvchi yoziladigan jadval bo‘lishi kerak."
      >
        {detail.groups.length === 0 ? (
          <EmptyState title="Guruh yo‘q" as="h3">
            Bu kursda hali guruh qo‘shilmagan, shuning uchun e’lon qilib
            bo‘lmaydi. Ustoz guruh qo‘shishi kerak.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {detail.groups.map((group) => (
              <li key={group.id} className="flex flex-col gap-1 py-3">
                <p className="font-medium text-ink-900">{group.title}</p>
                <p className="text-sm text-ink-500">
                  {group.days.join(", ")} · {group.startTime}
                  {group.endTime ? `–${group.endTime}` : ""} · {group.startDate} dan ·{" "}
                  {group.capacity} o‘rin · {group.format}
                  {group.location ? ` · ${group.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      {/* ------------------------------- syllabus ------------------------------ */}
      <AdminPanel title="O‘quv dasturi">
        {detail.syllabus.length === 0 ? (
          <EmptyState title="Dastur bo‘sh" as="h3">
            Bu kursda o‘quv dasturi modullari yo‘q, shuning uchun e’lon qilib
            bo‘lmaydi.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {detail.syllabus.map((module) => (
              <li key={module.id} className="rounded-lg border border-line p-4">
                <p className="font-medium text-ink-900">
                  <span className="text-ink-500">{module.position}. </span>
                  {module.title}
                </p>
                <p className="mt-1 max-w-prose text-base leading-relaxed text-ink-700">
                  {module.description}
                </p>
                <p className="mt-1 text-sm text-ink-500">{module.lessons} dars</p>
              </li>
            ))}
          </ol>
        )}
      </AdminPanel>

      {/* ------------------------------- history ------------------------------- */}
      <AdminPanel
        title="Moderatsiya tarixi"
        description="Bu kurs bo‘yicha barcha qarorlar. Qarorlar o‘chirilmaydi."
      >
        {detail.history.length === 0 ? (
          <EmptyState title="Tarix bo‘sh" as="h3">
            Bu kurs hali moderatsiyadan o‘tmagan.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {detail.history.map((item) => (
              <li key={item.id} className="rounded-lg border border-line bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewStateBadge state={item.status} />
                  <span className="text-sm text-ink-500">
                    Yuborilgan:{" "}
                    <time dateTime={isoDate(item.submittedAt)}>
                      {formatAdminDateTime(item.submittedAt)}
                    </time>
                  </span>
                  {item.reviewedAt ? (
                    <span className="text-sm text-ink-500">
                      Qaror:{" "}
                      <time dateTime={isoDate(item.reviewedAt)}>
                        {formatAdminDateTime(item.reviewedAt)}
                      </time>
                    </span>
                  ) : null}
                </div>
                {item.feedback ? (
                  <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-900">
                    <span className="text-sm text-ink-500">Izoh: </span>
                    {item.feedback}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </AdminPanel>
    </div>
  );
}
