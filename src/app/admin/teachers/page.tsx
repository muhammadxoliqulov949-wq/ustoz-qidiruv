import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import {
  AdminFilterLink,
  AdminPanel,
  RequestStateBadge,
  VerificationBadge,
  formatAdminDate,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  getVerificationQueueCounts,
  listVerificationQueue,
} from "@/server/verification-service";
import {
  VERIFICATION_REQUEST_STATE_LABEL,
  VERIFICATION_REQUEST_STATES,
} from "@/lib/teacher-verification";

/* -------------------------------------------------------------------------- */
/* /admin/teachers — the verification queue (Phase 15).                        */
/*                                                                              */
/* ORDER: pending FIRST and oldest-first inside it, because the only work here   */
/* is deciding the applications that are actually waiting. Decided rows are      */
/* history and sort by most recent decision. The ordering is applied in SQL      */
/* (verification-service), not by sorting a rendered array.                      */
/*                                                                              */
/* The filter is a real link (`?status=`), parsed against a whitelist. An        */
/* unknown value falls back to the default instead of being echoed back into     */
/* the page — nothing from the URL is rendered.                                  */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Ustozlar",
  description: "Ustoz tasdiqlash arizalari navbati.",
  robots: { index: false, follow: false },
};

type StatusParam = "pending" | "approved" | "rejected" | "all";

function parseStatus(value: string | string[] | undefined): StatusParam {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "approved" || raw === "rejected" || raw === "all") return raw;
  return "pending";
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const [rows, counts] = await Promise.all([
    listVerificationQueue({ status }),
    getVerificationQueueCounts(),
  ]);

  const filters: { value: StatusParam; label: string; count: number }[] = [
    { value: "pending", label: VERIFICATION_REQUEST_STATE_LABEL.pending, count: counts.pending },
    ...VERIFICATION_REQUEST_STATES.filter((state) => state !== "pending").map((state) => ({
      value: state as StatusParam,
      label: VERIFICATION_REQUEST_STATE_LABEL[state],
      count: state === "approved" ? counts.approved : counts.rejected,
    })),
    {
      value: "all",
      label: "Barchasi",
      count: counts.pending + counts.approved + counts.rejected,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Ustozlar tasdig‘i
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Ariza yuborgan ustozlar ro‘yxati. Har bir ariza bo‘yicha bitta qaror
          qabul qilinadi: tasdiqlash yoki sabab bilan qaytarish.
        </p>
      </header>

      <nav aria-label="Ariza holati bo‘yicha filtr">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <AdminFilterLink
              key={filter.value}
              href={filter.value === "pending" ? "/admin/teachers" : `/admin/teachers?status=${filter.value}`}
              label={filter.label}
              count={filter.count}
              active={status === filter.value}
            />
          ))}
        </ul>
      </nav>

      <AdminPanel
        title={
          status === "pending"
            ? "Tasdiqlash kutilayotgan arizalar"
            : "Arizalar tarixi"
        }
        description={
          status === "pending"
            ? "Eng uzoq kutgan ariza birinchi bo‘lib ko‘rsatiladi."
            : "Qaror qabul qilingan arizalar, eng yangisi birinchi."
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Bu holatda ariza yo‘q" as="h3">
            {status === "pending"
              ? "Hozir tasdiqlash kutilayotgan ariza yo‘q."
              : "Bu holatda yozuv topilmadi. Boshqa filtrni tanlab ko‘ring."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">
                Ustoz tasdiqlash arizalari: ism, mutaxassislik, yuborilgan sana,
                profil holati va ariza holati.
              </caption>
              <thead>
                <tr className="border-b border-line text-sm text-ink-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Ustoz</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Mutaxassislik</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Yuborilgan</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Profil holati</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Ariza</th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Amal</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.requestId} className="border-b border-line align-top">
                    <th scope="row" className="py-3 pr-3 text-left font-medium text-ink-900">
                      {row.teacherName}
                      {row.city ? (
                        <span className="block text-sm font-normal text-ink-500">{row.city}</span>
                      ) : null}
                    </th>
                    <td className="py-3 pr-3 text-base text-ink-700">
                      {row.specialization ?? "—"}
                    </td>
                    <td className="py-3 pr-3 text-base text-ink-700 whitespace-nowrap">
                      <time dateTime={row.submittedAt.toISOString()}>
                        {formatAdminDate(row.submittedAt)}
                      </time>
                    </td>
                    <td className="py-3 pr-3">
                      <VerificationBadge state={row.verification} />
                      {row.experienceYears !== null ? (
                        <span className="mt-1 block text-sm text-ink-500">
                          {row.experienceYears} yil tajriba
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <RequestStateBadge state={row.requestStatus} />
                      {row.feedback ? (
                        <span className="mt-1 block max-w-[18rem] text-sm text-ink-500">
                          {row.feedback}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <ButtonLink
                        href={`/admin/teachers/${row.teacherUserId}`}
                        variant="outline"
                        size="sm"
                      >
                        {row.requestStatus === "pending" ? "Ko‘rib chiqish" : "Batafsil"}
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <p className="text-sm leading-relaxed text-ink-500">
        Tasdiqlangan ustozlar soni: <strong className="font-semibold text-ink-700">{counts.verifiedTeachers}</strong>.
        Tasdiqlash ustozning kursini avtomatik e’lon qilmaydi — kurs alohida{" "}
        <Link href="/admin/courses" className="text-accent-700 underline underline-offset-2">
          moderatsiya navbatidan
        </Link>{" "}
        o‘tadi.
      </p>
    </div>
  );
}
