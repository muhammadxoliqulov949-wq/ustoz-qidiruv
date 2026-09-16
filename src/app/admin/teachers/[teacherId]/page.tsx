import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import {
  AdminField,
  AdminPanel,
  CourseStateBadge,
  RequestStateBadge,
  VerificationBadge,
  formatAdminDateTime,
  isoDate,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { VerificationDecisionForm } from "@/components/admin/verification-decision-form";
import { getTeacherReviewDetail } from "@/server/verification-service";
import { createVerificationDocumentReadUrl } from "@/server/file-service";
import {
  MEDIA_VIEW_URL_NOTE,
  VERIFICATION_DOCUMENT_TYPE_LABEL,
  formatBytes,
} from "@/lib/media";
import { countTeacherCoursesByState } from "@/server/admin-service";
import {
  DOCUMENT_REVIEW_NOTICE,
  VERIFICATION_MEANS_NOTE,
  VERIFICATION_STATE_NOTE,
} from "@/lib/teacher-verification";

/* -------------------------------------------------------------------------- */
/* /admin/teachers/[teacherId] — one applicant, decided here (Phase 15).       */
/*                                                                              */
/* PRIVACY: this page shows marketplace/moderation data only — name, city,      */
/* languages, experience, bio, approach, specialization and the teacher's own    */
/* courses. It never loads the applicant's phone number, password hash, session  */
/* rows or enrollments, and `getTeacherReviewDetail` does not select them.       */
/*                                                                              */
/* An unknown or non-teacher id is `notFound()` — the id is never echoed back   */
/* into the page, so probing ids cannot confirm whether an account exists.       */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Ustoz arizasi",
  robots: { index: false, follow: false },
};

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  /*
   * DEFENCE IN DEPTH (Phase 18). The layout renders the refusal screen for a
   * non-admin session, but this page must never PRODUCE data for one: Next
   * serialises page segments for the client router, and a signed evidence URL
   * or a document name must not reach a browser that is not an admin's.
   */
  const admin = await requireAdminPage("/admin/teachers");
  if (!admin) return null;

  const { teacherId } = await params;
  const detail = await getTeacherReviewDetail(teacherId);
  if (!detail) notFound();

  const courses = await countTeacherCoursesByState(detail.teacherUserId);
  const pending = detail.pending;
  /*
   * The row the decision controls act on: the live application, or the most
   * recent one so its outcome can still be reported. `pending` is what tells the
   * form whether the action is still open — never the other way round.
   */
  const targetRequest = detail.pending ?? detail.history[0] ?? null;

  /*
   * PHASE 18 — SECURE EVIDENCE ACCESS.
   *
   * A signed URL is minted HERE, per render, for the ADMIN viewer only, and it
   * expires in ten minutes. Nothing is stored: the page (and any screenshot or
   * browser history) never contains a durable address for a private document,
   * and a student or another teacher has no code path that can mint one.
   *
   * The list itself is bounded: evidence sets are small (≤4 documents per
   * application), and only the most recent applications can have any.
   */
  const documentLinks = new Map<string, string>();
  for (const request of detail.history.slice(0, 5)) {
    for (const document of detail.documentsByRequest.get(request.id) ?? []) {
      if (documentLinks.size >= 20) break;
      const signed = await createVerificationDocumentReadUrl({
        assetId: document.id,
        viewerUserId: admin.id,
        viewerIsAdmin: true,
      });
      if (signed.ok) documentLinks.set(document.id, signed.data.url);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="Yo‘nalish" className="text-sm text-ink-500">
          <Link href="/admin/teachers" className="text-accent-700 underline underline-offset-2">
            Ustozlar
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{detail.name}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          {detail.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge state={detail.verification} size="md" />
          <ButtonLink href={`/teachers/${detail.slug}`} variant="outline" size="sm">
            Ommaviy profilni ochish
          </ButtonLink>
        </div>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          {VERIFICATION_STATE_NOTE[detail.verification]}
        </p>
      </div>

      {/* ------------------------------- decision ------------------------------ */}
      <AdminPanel
        title={pending ? "Joriy ariza" : "Qaror kutayotgan ariza yo‘q"}
        description={
          pending
            ? `${formatAdminDateTime(pending.submittedAt)} da yuborilgan.`
            : "Bu ustoz hozir qaror kutmayapti. Oxirgi ariza natijasi quyida ko‘rinadi."
        }
      >
        {/*
          * Rendered for the LATEST application whether it is live or already
          * decided, so the component (and its live region) stays mounted across
          * the post-decision refresh instead of being swapped for another
          * element. `pending` decides whether the controls are usable, and the
          * service refuses a decided request anyway.
          */}
        {targetRequest ? (
          <VerificationDecisionForm
            requestId={targetRequest.id}
            teacherUserId={detail.teacherUserId}
            teacherName={detail.name}
            pending={targetRequest.status === "pending"}
          />
        ) : (
          <EmptyState title="Ariza kutilmoqda" as="h3">
            Ustoz o‘z profilini tasdiqlash uchun ariza yuborganida bu bo‘limda
            qaror tugmalari paydo bo‘ladi.
          </EmptyState>
        )}
        <p className="border-t border-line pt-3 text-sm leading-relaxed text-ink-500">
          {VERIFICATION_MEANS_NOTE} {DOCUMENT_REVIEW_NOTICE}
        </p>
      </AdminPanel>

      {/* ------------------------------- evidence ------------------------------ */}
      <AdminPanel
        title="Tasdiqlash hujjatlari"
        description={
          (detail.documentsByRequest.get(targetRequest?.id ?? "") ?? []).length > 0
            ? "Hujjatlar ariza yuborilganda muzlatilgan — keyin o‘zgartirib bo‘lmaydi."
            : "Bu arizada hujjat yo‘q."
        }
      >
        {targetRequest ? (
          (detail.documentsByRequest.get(targetRequest.id) ?? []).length > 0 ? (
            <ul className="flex flex-col gap-3">
              {(detail.documentsByRequest.get(targetRequest.id) ?? []).map((document) => {
                const url = documentLinks.get(document.id) ?? null;
                return (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-muted px-3 py-2"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {VERIFICATION_DOCUMENT_TYPE_LABEL[document.documentType]}
                    </span>
                    <span className="min-w-0 flex-1 break-all text-sm text-ink-700">
                      {document.originalFileName}
                    </span>
                    <span className="text-xs text-ink-500">
                      {formatBytes(document.byteSize)} ·{" "}
                      {formatAdminDateTime(document.createdAt)}
                    </span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent-700 underline underline-offset-2"
                      >
                        Ko‘rish
                      </a>
                    ) : (
                      <span className="text-sm text-ink-400">Havola yaratilmadi</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">
              Ustoz bu arizada hujjat yuklamagan (Phase 15 arizasi).
            </p>
          )
        ) : (
          <p className="text-sm text-ink-500">Hujjatlar ariza bilan birga keladi.</p>
        )}
        <p className="border-t border-line pt-3 text-xs text-ink-500">{MEDIA_VIEW_URL_NOTE}</p>
      </AdminPanel>

      {/* ----------------------- earlier applications -------------------------- */}
      {detail.history.length > 1 ? (
        <AdminPanel
          title="Oldingi arizalar hujjatlari"
          description="Har bir ariza o‘z hujjatlari bilan saqlanadi — tarix o‘zgarmaydi."
        >
          <ul className="flex flex-col gap-4">
            {detail.history
              .filter((request) => request.id !== targetRequest?.id)
              .slice(0, 4)
              .map((request) => {
                const documents = detail.documentsByRequest.get(request.id) ?? [];
                return (
                  <li key={request.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <RequestStateBadge state={request.status} />
                      <span className="text-sm text-ink-500">
                        {formatAdminDateTime(request.submittedAt)}
                      </span>
                    </div>
                    {documents.length === 0 ? (
                      <p className="text-sm text-ink-500">Hujjat yuklanmagan.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {documents.map((document) => {
                          const url = documentLinks.get(document.id) ?? null;
                          return (
                            <li key={document.id} className="flex flex-wrap items-center gap-2">
                              <span className="text-sm text-ink-700">
                                {VERIFICATION_DOCUMENT_TYPE_LABEL[document.documentType]} ·{" "}
                                <span className="break-all">{document.originalFileName}</span>
                              </span>
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-accent-700 underline underline-offset-2"
                                >
                                  Ko‘rish
                                </a>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ul>
        </AdminPanel>
      ) : null}

      {/* -------------------------------- profile ------------------------------ */}
      <AdminPanel title="Profil ma’lumotlari">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminField label="Mutaxassislik">{detail.specialization ?? "—"}</AdminField>
          <AdminField label="Shahar">{detail.city ?? "—"}</AdminField>
          <AdminField label="Tuman">{detail.district ?? "—"}</AdminField>
          <AdminField label="Tajriba">
            {detail.experienceYears === null ? "—" : `${detail.experienceYears} yil`}
          </AdminField>
          <AdminField label="Tillar">
            {detail.languages.length === 0 ? "—" : detail.languages.join(", ")}
          </AdminField>
          <AdminField label="Ommaviy profili">
            {detail.isPublic ? "Ommaviy" : "Yashirin"}
          </AdminField>
        </dl>
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div>
            <h3 className="text-sm text-ink-500">O‘zi haqida</h3>
            <p className="mt-1 max-w-prose text-base leading-relaxed text-ink-900">
              {detail.bio ?? "—"}
            </p>
          </div>
          <div>
            <h3 className="text-sm text-ink-500">Dars usuli</h3>
            <p className="mt-1 max-w-prose text-base leading-relaxed text-ink-900">
              {detail.approach ?? "—"}
            </p>
          </div>
        </div>
      </AdminPanel>

      {/* -------------------------------- courses ------------------------------ */}
      <AdminPanel
        title="Kurslari"
        description={
          courses.published > 0
            ? "E’lon qilingan kurslar ommaviy katalogda ko‘rinadi."
            : "Bu ustozning e’lon qilingan kursi yo‘q."
        }
      >
        {detail.courses.length === 0 ? (
          <EmptyState title="Kurs yo‘q" as="h3">
            Ustoz hali kurs yaratmagan.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {detail.courses.map((course) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium text-ink-900">{course.title}</span>
                <span className="flex items-center gap-3">
                  <CourseStateBadge state={course.status as "draft" | "ready" | "published"} />
                  <ButtonLink href={`/admin/courses/${course.id}`} variant="outline" size="sm">
                    Ko‘rish
                  </ButtonLink>
                </span>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4">
          <AdminField label="Qoralama">{courses.draft}</AdminField>
          <AdminField label="Navbatda">{courses.ready}</AdminField>
          <AdminField label="E’lon qilingan">{courses.published}</AdminField>
        </dl>
      </AdminPanel>

      {/* -------------------------------- history ------------------------------ */}
      <AdminPanel
        title="Arizalar tarixi"
        description="Har bir ariza va uning natijasi. Qarorlar o‘chirilmaydi."
      >
        {detail.history.length === 0 ? (
          <EmptyState title="Tarix bo‘sh" as="h3">
            Bu ustoz hali tasdiqlash uchun ariza yubormagan.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {detail.history.map((request) => (
              <li key={request.id} className="rounded-lg border border-line bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <RequestStateBadge state={request.status} />
                  <span className="text-sm text-ink-500">
                    Yuborilgan:{" "}
                    <time dateTime={isoDate(request.submittedAt)}>
                      {formatAdminDateTime(request.submittedAt)}
                    </time>
                  </span>
                  {request.reviewedAt ? (
                    <span className="text-sm text-ink-500">
                      Qaror:{" "}
                      <time dateTime={isoDate(request.reviewedAt)}>
                        {formatAdminDateTime(request.reviewedAt)}
                      </time>
                    </span>
                  ) : null}
                </div>
                {request.feedback ? (
                  <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-900">
                    <span className="text-sm text-ink-500">Qaytarish sababi: </span>
                    {request.feedback}
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
