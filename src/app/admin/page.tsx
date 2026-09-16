import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { AdminField, AdminPanel } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getAdminOverview } from "@/server/admin-service";
import { listVerificationQueue } from "@/server/verification-service";
import { listModerationQueue } from "@/server/moderation-service";
import { listAdminRefunds } from "@/server/refund-service";
import { REFUND_STATUS_LABEL, refundStatusTone } from "@/lib/refund";
import { formatTiyin } from "@/lib/money";
import { ADMIN_AREA_TITLE } from "@/lib/admin-workspace";
import { formatAdminDate } from "@/components/admin/admin-ui";

/* -------------------------------------------------------------------------- */
/* /admin — the control-plane overview (Phase 15).                             */
/*                                                                              */
/* WHAT THIS PAGE IS: the two work queues, in the order they must be worked      */
/* (oldest first), plus the factual totals. That is the whole dashboard.         */
/*                                                                              */
/* WHAT IT IS NOT: no charts, no trend arrows, no analytics. Every number below   */
/* is the length of a real query result, and each section links to the screen     */
/* where the work actually happens.                                              */
/*                                                                              */
/* PHASE 17 adds ONE queue: refund requests. It belongs here because it is work   */
/* a human must do — a `requested` row waits for a decision, and an              */
/* `awaiting_provider` row waits for the merchant operator to return the money in */
/* the Payme cabinet. The queue deliberately shows the provider dependency       */
/* instead of a "refund" button that nothing behind it could honour.             */
/*                                                                              */
/* Server-rendered with no client JS at all, so it cannot drift out of date     */
/* between polls and there is no loading flash.                                 */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: ADMIN_AREA_TITLE,
  description: "Ustoz tasdiqlash va kurs moderatsiyasi navbatlari.",
  robots: { index: false, follow: false },
};

/** A queue preview is a summary, not a workspace: the full list is one click away. */
const PREVIEW_LIMIT = 5;

export default async function AdminOverviewPage() {
  /*
   * DEFENCE IN DEPTH (Phase 18). The admin layout renders the refusal
   * screen for a non-admin session, but a page must never PRODUCE data for
   * one: Next serialises page segments for the client router, so "the
   * layout did not render me" is not a guarantee. Returning null here
   * means a non-admin gets the refusal screen and an empty payload.
   */
  const admin = await requireAdminPage("/admin");
  if (!admin) return null;

  const [overview, verificationQueue, moderationQueue, refundQueue] = await Promise.all([
    getAdminOverview(),
    listVerificationQueue({ status: "pending" }),
    listModerationQueue({ status: "pending" }),
    listAdminRefunds({ statuses: ["requested", "awaiting_provider"] }),
  ]);

  const oldestWaiting = verificationQueue[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Umumiy holat
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Navbatdagi ishlar va hisobdagi raqamlar. Qarorlar bekor qilinmaydi,
          shuning uchun har bir amal jurnalga yoziladi.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">Tasdiqlash kutilmoqda</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.pendingVerifications}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">Moderatsiya kutilmoqda</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.pendingModeration}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">Tasdiqlangan ustozlar</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.verifiedTeachers}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">E’lon qilingan kurslar</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.publishedCourses}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">Fikrlar tekshiruvda</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.pendingReviews}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <dt className="text-sm text-ink-500">Qaytarish so‘rovlari navbatda</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {overview.pendingRefunds}
          </dd>
        </div>
      </dl>

      <AdminPanel
        title="Tasdiqlash navbati"
        description="Eng uzoq kutgan ariza birinchi. Tasdiqlangan ustoz kursini e’lon qilish huquqini oladi."
        action={
          <ButtonLink href="/admin/teachers" variant="outline" size="sm">
            Butun navbat
          </ButtonLink>
        }
      >
        {verificationQueue.length === 0 ? (
          <EmptyState title="Kutilayotgan ariza yo‘q" as="h3">
            Hozir tasdiqlash kutilayotgan ariza yo‘q. Ustoz ariza yuborsa, u shu
            yerda paydo bo‘ladi.
          </EmptyState>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line">
              {verificationQueue.slice(0, PREVIEW_LIMIT).map((row) => (
                <li key={row.requestId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/teachers/${row.teacherUserId}`}
                      className="font-medium text-accent-700 underline underline-offset-2"
                    >
                      {row.teacherName}
                    </Link>
                    <p className="text-sm text-ink-500">
                      {row.specialization ?? "Mutaxassislik ko‘rsatilmagan"} ·{" "}
                      {formatAdminDate(row.submittedAt)}
                    </p>
                  </div>
                  <ButtonLink
                    href={`/admin/teachers/${row.teacherUserId}`}
                    variant="outline"
                    size="sm"
                  >
                    Ko‘rib chiqish
                  </ButtonLink>
                </li>
              ))}
            </ul>
            {verificationQueue.length > PREVIEW_LIMIT ? (
              <p className="text-sm text-ink-500">
                Yana {verificationQueue.length - PREVIEW_LIMIT} ta ariza navbatda.
              </p>
            ) : null}
            {oldestWaiting ? (
              <p className="text-sm text-ink-500">
                Navbatning eng eskisi {formatAdminDate(oldestWaiting.submittedAt)} da
                yuborilgan.
              </p>
            ) : null}
          </>
        )}
      </AdminPanel>

      <AdminPanel
        title="Moderatsiya navbati"
        description="Ustoz “ko‘rib chiqish uchun yuborilgan” deb belgilagan kurslar. E’lon qilish yoki sabab bilan qaytarish mumkin."
        action={
          <ButtonLink href="/admin/courses" variant="outline" size="sm">
            Butun navbat
          </ButtonLink>
        }
      >
        {moderationQueue.length === 0 ? (
          <EmptyState title="Moderatsiya kutilayotgan kurs yo‘q" as="h3">
            Hozir ko‘rib chiqilishi kutilayotgan kurs yo‘q. Ustoz kursni
            ko‘rib chiqishga yuborsa, u shu yerda paydo bo‘ladi.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {moderationQueue.slice(0, PREVIEW_LIMIT).map((row) => (
              <li key={row.reviewId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/courses/${row.courseId}`}
                    className="font-medium text-accent-700 underline underline-offset-2"
                  >
                    {row.title}
                  </Link>
                  <p className="text-sm text-ink-500">
                    {row.teacherName} · {formatAdminDate(row.submittedAt)}
                    {row.teacherVerification !== "verified"
                      ? " · ustoz tasdiqlanmagan"
                      : ""}
                  </p>
                </div>
                <ButtonLink
                  href={`/admin/courses/${row.courseId}`}
                  variant="outline"
                  size="sm"
                >
                  Ko‘rib chiqish
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      <AdminPanel
        title="Pulni qaytarish navbati"
        description="So‘rovni administrator tasdiqlaydi, pulni esa Payme’ning merchant kabinetida operator qaytaradi. Yakuniy holat provayder tasdiqlagandan keyin qayd etiladi."
        action={
          <ButtonLink href="/admin/refunds" variant="outline" size="sm">
            Butun navbat
          </ButtonLink>
        }
      >
        {refundQueue.length === 0 ? (
          <EmptyState title="Qaytarish so‘rovi yo‘q" as="h3">
            Hozir na qaror, na provayder tasdiqini kutayotgan so‘rov bor.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {refundQueue.slice(0, PREVIEW_LIMIT).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/refunds/${row.id}`}
                    className="font-medium text-accent-700 underline underline-offset-2"
                  >
                    {row.studentName}
                  </Link>
                  <p className="text-sm text-ink-500">
                    {row.courseTitle} · {row.groupTitle} · {formatTiyin(row.amountTiyin)} ·{" "}
                    {formatAdminDate(row.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={refundStatusTone(row.status)}>
                    {REFUND_STATUS_LABEL[row.status]}
                  </Badge>
                  <ButtonLink href={`/admin/refunds/${row.id}`} variant="outline" size="sm">
                    Ko‘rib chiqish
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      <AdminPanel title="Katalog holati" description="Ommaviy katalogdagi real sonlar.">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <AdminField label="Qoralamalar">{overview.draftCourses}</AdminField>
          <AdminField label="Jurnaldagi qarorlar">{overview.auditEvents}</AdminField>
          <AdminField label="Tasdiqlangan ustozlar">{overview.verifiedTeachers}</AdminField>
        </dl>
        <p className="text-sm leading-relaxed text-ink-500">
          Qoralama va “ko‘rib chiqish uchun yuborilgan” kurslar ommaviy saytda
          ko‘rinmaydi. E’lon qilingan kurs darhol ommaviy sahifalarda paydo
          bo‘ladi — qayta joylashtirish (deploy) kerak emas.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Pulni qaytarish tugallangach o‘quvchining yozilishi bekor qilinadi va
          guruhdagi joy bo‘shatiladi. Bu avtomatik hisoblanadi: joy soni
          “qabul qilingan” yozuvlar sonidan olinadi, shuning uchun alohida
          tuzatish talab qilinmaydi.
        </p>
      </AdminPanel>
    </div>
  );
}
