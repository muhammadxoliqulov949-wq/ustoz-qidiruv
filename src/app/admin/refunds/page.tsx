import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { AdminFilterLink, AdminPanel, formatAdminDate } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getRefundQueueCounts, listAdminRefunds } from "@/server/refund-service";
import {
  REFUND_PROVIDER_BOUNDARY_NOTE,
  REFUND_STATUS_LABEL,
  REFUND_STATUSES,
  refundStatusTone,
  type RefundStatus,
} from "@/lib/refund";
import { formatTiyin } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* /admin/refunds — the refund queue (Phase 17).                               */
/*                                                                              */
/* THE DEFAULT VIEW IS THE WORK, NOT THE HISTORY: live statuses first, oldest    */
/* request first inside `requested`, because that is the row somebody has been   */
/* waiting on the longest. The filter is a real link (`?status=`) parsed against */
/* a whitelist; an unknown value falls back to the default and nothing from the  */
/* URL is echoed back into the page.                                            */
/*                                                                              */
/* WHAT THIS SCREEN CANNOT DO: move money. The provider performs the refund in   */
/* the Payme merchant cabinet. The queue exists so a human decides WHO gets one  */
/* and so the provider's confirmation has somewhere to land.                     */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Qaytarishlar",
  description: "O‘quvchilarning pulni qaytarish so‘rovlari navbati.",
  robots: { index: false, follow: false },
};

type Filter = "live" | RefundStatus | "all";

const FILTERS: readonly Filter[] = ["live", ...REFUND_STATUSES, "all"];

function parseStatus(value: string | string[] | undefined): Filter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (FILTERS as readonly string[]).includes(raw)) return raw as Filter;
  return "live";
}

const FILTER_LABEL: Record<Filter, string> = {
  live: "Navbatda",
  requested: REFUND_STATUS_LABEL.requested,
  awaiting_provider: REFUND_STATUS_LABEL.awaiting_provider,
  completed: REFUND_STATUS_LABEL.completed,
  rejected: REFUND_STATUS_LABEL.rejected,
  failed: REFUND_STATUS_LABEL.failed,
  all: "Barchasi",
};

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /*
   * DEFENCE IN DEPTH (Phase 18). The admin layout renders the refusal
   * screen for a non-admin session, but a page must never PRODUCE data for
   * one: Next serialises page segments for the client router, so "the
   * layout did not render me" is not a guarantee. Returning null here
   * means a non-admin gets the refusal screen and an empty payload.
   */
  const admin = await requireAdminPage("/admin/refunds");
  if (!admin) return null;

  const params = await searchParams;
  const filter = parseStatus(params.status);

  const [counts, rows] = await Promise.all([
    getRefundQueueCounts(),
    listAdminRefunds(
      filter === "all"
        ? {}
        : filter === "live"
          ? { statuses: ["requested", "awaiting_provider"] }
          : { status: filter },
    ),
  ]);

  const filterCount = (value: Filter): number => {
    if (value === "all") return counts.all;
    if (value === "live") return counts.live;
    return counts[value];
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Pulni qaytarish so‘rovlari
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          O‘quvchi so‘rovni yuboradi, administrator ko‘rib chiqadi va qaror
          qiladi. Pulni qaytarishni provayder bajaradi, shuning uchun yakuniy
          holat faqat Payme’ning tasdiqlangan chaqiruvidan keyin qayd etiladi.
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-ink-500">
          {REFUND_PROVIDER_BOUNDARY_NOTE}
        </p>
      </header>

      <ul className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <AdminFilterLink
            key={value}
            href={value === "live" ? "/admin/refunds" : `/admin/refunds?status=${value}`}
            label={FILTER_LABEL[value]}
            active={filter === value}
            count={filterCount(value)}
          />
        ))}
      </ul>

      <AdminPanel
        title="Navbat"
        description={
          filter === "live"
            ? `${counts.requested} ta qaror kutmoqda, ${counts.awaiting_provider} ta provayderda.`
            : `${rows.length} ta yozuv.`
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Bu bo‘limda so‘rov yo‘q" as="h3">
            {filter === "live"
              ? "Hozir ko‘rib chiqilishi yoki provayderdan tasdiq kutayotgan so‘rov yo‘q."
              : "Bu holatda hech qanday so‘rov topilmadi."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/refunds/${row.id}`}
                      className="font-medium text-accent-700 underline underline-offset-2"
                    >
                      {row.studentName}
                    </Link>
                    <p className="text-sm text-ink-500">
                      {row.courseTitle} · {row.groupTitle}
                    </p>
                    <p className="text-sm text-ink-500">
                      So‘ralgan: {formatAdminDate(row.requestedAt)} · Summa:{" "}
                      {formatTiyin(row.amountTiyin)}
                      {row.systemInitiated ? " · provayder tashabbusi" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={refundStatusTone(row.status)}>
                      {REFUND_STATUS_LABEL[row.status]}
                    </Badge>
                    <ButtonLink href={`/admin/refunds/${row.id}`} variant="outline" size="sm">
                      Ko‘rib chiqish
                    </ButtonLink>
                  </div>
                </div>
                <p className="text-sm text-ink-700 line-clamp-2">Sabab: {row.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}
