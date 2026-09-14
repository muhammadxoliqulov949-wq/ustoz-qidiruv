import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import {
  AdminField,
  AdminFilterLink,
  AdminPanel,
  CourseStateBadge,
  ReviewStateBadge,
  VerificationBadge,
  formatAdminDate,
  isoDate,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getModerationCounts, listModerationQueue } from "@/server/moderation-service";
import { getCourseStateCounts } from "@/server/admin-service";
import { canTransitionCourse } from "@/lib/course-moderation";
import { COURSE_STATE_LABEL } from "@/lib/course-moderation";

/* -------------------------------------------------------------------------- */
/* /admin/courses — the moderation queue (Phase 15).                           */
/*                                                                              */
/* The action hint on each row comes from the SAME transition table the services */
/* enforce (`canTransitionCourse("admin", …)`), so the queue cannot promise an   */
/* action the server would refuse, and the server does not depend on the hint.   */
/*                                                                              */
/* A row whose owner is not verified shows the verification badge right next to   */
/* the course: the operator can see immediately WHY publishing is blocked.        */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Kurslar",
  description: "Kurs moderatsiyasi navbati.",
  robots: { index: false, follow: false },
};

type StatusParam = "pending" | "approved" | "changes_requested" | "all";

function parseStatus(value: string | string[] | undefined): StatusParam {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "approved" || raw === "changes_requested" || raw === "all") return raw;
  return "pending";
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const [rows, counts, stateCounts] = await Promise.all([
    listModerationQueue({ status }),
    getModerationCounts(),
    getCourseStateCounts(),
  ]);

  const filters: { value: StatusParam; label: string; count: number | undefined }[] = [
    { value: "pending", label: "Kutilmoqda", count: counts.pendingReviews },
    { value: "approved", label: "E’lon qilingan", count: stateCounts.published },
    { value: "changes_requested", label: "Qaytarilgan", count: undefined },
    { value: "all", label: "Barchasi", count: undefined },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Kurslar moderatsiyasi
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Ustoz kursini “ko‘rib chiqish uchun yuborilgan” deb belgilaganda ariza
          shu yerda paydo bo‘ladi. E’lon qilish yoki sabab bilan qaytarish mumkin.
        </p>
      </header>

      <nav aria-label="Moderatsiya holati bo‘yicha filtr">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <AdminFilterLink
              key={filter.value}
              href={filter.value === "pending" ? "/admin/courses" : `/admin/courses?status=${filter.value}`}
              label={filter.label}
              count={filter.count}
              active={status === filter.value}
            />
          ))}
        </ul>
      </nav>

      <AdminPanel
        title={status === "pending" ? "Ko‘rib chiqish kutilmoqda" : "Moderatsiya tarixi"}
        description={
          status === "pending"
            ? "Eng uzoq kutgan kurs birinchi. E’lon qilishdan oldin ustoz tasdiqlangan bo‘lishi shart."
            : "Qaror qabul qilingan yozuvlar, eng yangisi birinchi."
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Bu holatda kurs yo‘q" as="h3">
            {status === "pending"
              ? "Hozir moderatsiya kutilayotgan kurs yo‘q."
              : "Bu holatda yozuv topilmadi. Boshqa filtrni tanlab ko‘ring."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => {
              const canPublish =
                canTransitionCourse("admin", row.status, "published") &&
                row.teacherVerification === "verified";
              return (
                <li key={row.reviewId} className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{row.title}</p>
                      <p className="text-sm text-ink-500">
                        {row.teacherName} ·{" "}
                        <time dateTime={isoDate(row.submittedAt)}>
                          {formatAdminDate(row.submittedAt)}
                        </time>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CourseStateBadge state={row.status} />
                      <ReviewStateBadge state={row.reviewStatus} />
                      <VerificationBadge state={row.teacherVerification} />
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <AdminField label="Kategoriya">{row.categoryId}</AdminField>
                    <AdminField label="Daraja">{row.level}</AdminField>
                    <AdminField label="Format">{row.format}</AdminField>
                    <AdminField label="Narx — oyiga">{row.priceUzs.toLocaleString("uz-UZ")} so‘m</AdminField>
                  </dl>

                  {row.feedback ? (
                    <p className="max-w-prose text-sm leading-relaxed text-ink-700">
                      <span className="text-ink-500">Oxirgi izoh: </span>
                      {row.feedback}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <ButtonLink
                      href={`/admin/courses/${row.courseId}`}
                      variant={row.reviewStatus === "pending" ? "primary" : "outline"}
                      size="sm"
                    >
                      {row.reviewStatus === "pending" ? "Ko‘rib chiqish" : "Batafsil"}
                    </ButtonLink>
                    <p className="text-sm text-ink-500">
                      {row.status === "published"
                        ? "E’lon qilingan — ommaviy katalogda."
                        : canPublish
                          ? "E’lon qilish mumkin."
                          : row.teacherVerification !== "verified"
                            ? "Ustoz tasdiqlanmagan — e’lon qilib bo‘lmaydi."
                            : `Holat: ${COURSE_STATE_LABEL[row.status]}.`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AdminPanel>

      <p className="text-sm leading-relaxed text-ink-500">
        Katalogda jami {stateCounts.published ?? 0} e’lon qilingan kurs,{" "}
        {stateCounts.draft ?? 0} qoralama va {stateCounts.ready ?? 0} ta
        “ko‘rib chiqish uchun yuborilgan” kurs bor. Qoralama va yuborilgan
        kurslar ommaviy saytda ko‘rinmaydi.
      </p>
    </div>
  );
}
