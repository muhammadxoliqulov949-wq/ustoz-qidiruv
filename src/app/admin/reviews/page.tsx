import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { Badge, ButtonLink } from "@/components/ui";
import {
  AdminField,
  AdminFilterLink,
  AdminPanel,
  formatAdminDate,
  formatAdminDateTime,
  isoDate,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ReviewDecisionForm } from "@/components/admin/review-decision-form";
import { getReviewQueueCounts, listAdminReviewQueue } from "@/server/review-service";
import { REVIEW_MODERATION_PRIVACY_NOTE, REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/reviews";

/* -------------------------------------------------------------------------- */
/* /admin/reviews — the review moderation queue (Phase 19).                    */
/*                                                                              */
/* WHY THIS SCREEN EXISTS. Publishing a review is the ONLY thing that makes a       */
/* student's words public and the only thing that moves a course's and a teacher's */
/* rating, so it is a decision a human makes here — not a button on the teacher's  */
/* own dashboard. A teacher cannot approve, hide or delete reviews of their own    */
/* course: no teacher surface imports these actions, and `requireAdmin` plus the    */
/* in-transaction role check in review-service close the door from the server side. */
/*                                                                              */
/* WHAT IS SHOWN, AND WHAT IS NOT. Each row carries the course, the student's NAME, */
/* the rating, the full text and the submission date — everything needed to judge  */
/* the sentence. It does NOT carry the student's phone number or email: those live  */
/* on `users` and the query never selects them, so this screen cannot leak what it  */
/* did not read.                                                                  */
/*                                                                              */
/* The buttons follow the SAME transition table the service consults               */
/* (`canTransitionReview("admin", …)`), so the queue can never promise a decision   */
/* the server would refuse.                                                      */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Fikrlar",
  description: "O‘quvchi fikrlari moderatsiyasi navbati.",
  robots: { index: false, follow: false },
};

type StatusParam = ReviewStatus | "all";

const FILTERS: { value: StatusParam; label: string }[] = [
  { value: "pending", label: "Tekshiruvda" },
  { value: "published", label: "E’lon qilingan" },
  { value: "rejected", label: "E’lon qilinmagan" },
  { value: "withdrawn", label: "Qaytarib olingan" },
  { value: "all", label: "Barchasi" },
];

function parseStatus(value: string | string[] | undefined): StatusParam {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "published" || raw === "rejected" || raw === "withdrawn" || raw === "all") return raw;
  return "pending";
}

const STATUS_BADGE: Record<ReviewStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  pending: "accent",
  published: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /*
   * DEFENCE IN DEPTH (Phase 18 rule). The layout renders the refusal screen for a
   * non-admin session, but a page must never PRODUCE data for one: Next serialises
   * page segments for the client router. Returning null means a non-admin gets the
   * refusal screen and an empty payload.
   */
  const admin = await requireAdminPage("/admin/reviews");
  if (!admin) return null;

  const params = await searchParams;
  const status = parseStatus(params.status);
  const counts = await getReviewQueueCounts();
  const total = counts[status];
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 50;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pageCount);
  const rows = await listAdminReviewQueue({ status, limit, offset: (page - 1) * limit });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Fikrlar moderatsiyasi
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Fikrni faqat tasdiqlangan qatnashuvchilar yozadi. E’lon qilish uni
          ommaviy sahifaga chiqaradi va kurs hamda ustoz reytingini darhol
          o‘zgartiradi; e’lon qilmaslik uni sahifadan va reytingdan oladi.
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-ink-500">
          {REVIEW_MODERATION_PRIVACY_NOTE}
        </p>
      </header>

      <nav aria-label="Fikr holati bo‘yicha filtr">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <AdminFilterLink
              key={filter.value}
              href={filter.value === "pending" ? "/admin/reviews" : `/admin/reviews?status=${filter.value}`}
              label={filter.label}
              active={status === filter.value}
              count={counts[filter.value]}
            />
          ))}
        </ul>
      </nav>

      <AdminPanel
        title={status === "pending" ? "Tekshiruv navbati" : REVIEW_STATUS_LABEL[status === "all" ? "pending" : status]}
        description={
          status === "pending"
            ? "Eng uzoq kutgan fikr birinchi. Har bir qaror jurnalga yoziladi va o‘quvchiga bildirishnoma yuboriladi."
            : "Qabul qilingan qarorlar. Fikrni qayta e’lon qilish yoki uni sahifadan olish mumkin."
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title={status === "pending" ? "Navbatda fikr yo‘q" : "Bu holatda fikr yo‘q"}
            as="h3"
          >
            {status === "pending"
              ? "Hozircha tekshirish kerak bo‘lgan fikr yo‘q. O‘quvchi fikr yozganda u shu yerda paydo bo‘ladi."
              : "Tanlangan holatda yozuv topilmadi."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE[row.status]}>{REVIEW_STATUS_LABEL[row.status]}</Badge>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-900">
                    <Star aria-hidden="true" className="size-4 fill-rating text-rating stroke-0" />
                    {row.rating.toFixed(1)}
                    <span className="sr-only">/5</span>
                  </span>
                  <Link
                    href={`/courses/${row.courseSlug}`}
                    className="text-sm font-medium text-accent-700 underline underline-offset-2"
                  >
                    {row.courseTitle}
                  </Link>
                </div>

                <p className="max-w-prose text-base leading-relaxed text-ink-900">{row.body}</p>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                  <AdminField label="O‘quvchi">{row.studentName}</AdminField>
                  <AdminField label="Kurs identifikatori">
                    <span className="font-mono text-xs">{row.courseId}</span>
                  </AdminField>
                  <AdminField label="Yuborilgan">
                    <time dateTime={isoDate(row.createdAt)}>{formatAdminDate(row.createdAt)}</time>
                  </AdminField>
                  <AdminField label="Qaror">
                    {row.moderatedAt ? (
                      <time dateTime={isoDate(row.moderatedAt)}>
                        {formatAdminDateTime(row.moderatedAt)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </AdminField>
                </dl>

                {row.moderationReason ? (
                  <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm leading-relaxed text-ink-700">
                    <span className="font-medium text-ink-900">Sabab: </span>
                    {row.moderationReason}
                  </p>
                ) : null}

                <ReviewDecisionForm
                  reviewId={row.id}
                  courseSlug={row.courseSlug}
                  status={row.status}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            Tekshiruvda: {counts.pending} · E’lon qilingan: {counts.published} · Jami:{" "}
            {counts.all}
          </p>
          <ButtonLink href="/admin/activity" variant="ghost" size="sm">
            Qarorlar jurnali
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-ink-500">
            {rows.length ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}` : "0 / 0"}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <ButtonLink href={`/admin/reviews?status=${status}&page=${page - 1}`} variant="outline" size="sm">
                Oldingi
              </ButtonLink>
            ) : null}
            {page < pageCount ? (
              <ButtonLink href={`/admin/reviews?status=${status}&page=${page + 1}`} variant="outline" size="sm">
                Keyingi
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
