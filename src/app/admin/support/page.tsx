import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { Badge, ButtonLink } from "@/components/ui";
import { AdminFilterLink, AdminPanel, formatAdminDateTime } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { countSupportTickets, getSupportQueueCounts, listSupportTickets } from "@/server/support-service";
import { SUPPORT_STATUS_LABEL, SUPPORT_STATUS_TONE, SUPPORT_STATUSES, type SupportStatus } from "@/lib/support";

export const metadata: Metadata = {
  title: "Yordam navbati",
  description: "Ichki yordam va nomaqbul kontent murojaatlari.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
type Filter = "live" | SupportStatus | "all";
const FILTERS: readonly Filter[] = ["live", ...SUPPORT_STATUSES, "all"];

function parseFilter(value: string | string[] | undefined): Filter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (FILTERS as readonly string[]).includes(raw) ? raw as Filter : "live";
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage("/admin/support");
  if (!admin) return null;
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 50;
  const [counts, total] = await Promise.all([
    getSupportQueueCounts(),
    countSupportTickets({ status: filter }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pageCount);
  const rows = await listSupportTickets({ status: filter, limit, offset: (page - 1) * limit });
  const countFor = (value: Filter) => value === "live" ? counts.live : value === "all" ? counts.all : counts[value];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">Yordam va reportlar</h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">Foydalanuvchilarning hisob, kurs, to‘lov, nomaqbul kontent va texnik murojaatlari. Xabar matni ichki operatorlar uchun ko‘rsatiladi.</p>
      </header>
      <nav aria-label="Murojaat holati bo‘yicha filtr">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <AdminFilterLink key={value} href={value === "live" ? "/admin/support" : `/admin/support?status=${value}`} label={value === "live" ? "Navbatda" : value === "all" ? "Barchasi" : SUPPORT_STATUS_LABEL[value]} count={countFor(value)} active={filter === value} />
          ))}
        </ul>
      </nav>
      <AdminPanel title={filter === "live" ? "Ochiq ish" : "Murojaatlar"} description={filter === "live" ? `${counts.open} ta ochiq, ${counts.in_progress} ta ishlanmoqda.` : `${total} ta yozuv · sahifa ${page}.`}>
        {rows.length === 0 ? (
          <EmptyState title="Bu navbat bo‘sh" as="h3">Tanlangan holatda murojaat yo‘q. Yangi murojaat yuborilganda faol operatorlarga ilova ichidagi bildirishnoma keladi.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/support/${ticket.id}`} className="font-medium text-accent-700 underline underline-offset-2">{ticket.categoryLabel}</Link>
                    <p className="text-sm text-ink-500">{ticket.reporterName ?? "Foydalanuvchi ko‘rsatilmagan"}{ticket.reporterRole ? ` · ${ticket.reporterRole}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1"><Badge variant={SUPPORT_STATUS_TONE[ticket.status]}>{ticket.statusLabel}</Badge><time dateTime={ticket.createdAt.toISOString()} className="text-xs text-ink-500">{formatAdminDateTime(ticket.createdAt)}</time></div>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{ticket.message}</p>
                {ticket.relatedEntityId ? <p className="text-xs text-ink-500">Bog‘liq: {ticket.relatedEntityType} · {ticket.relatedEntityId}</p> : null}
                <ButtonLink href={`/admin/support/${ticket.id}`} variant="outline" size="sm" className="self-start">Ko‘rib chiqish</ButtonLink>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-ink-500">{rows.length ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}` : "0 / 0"}</span>
          <div className="flex gap-2">
            {page > 1 ? <ButtonLink href={`/admin/support?status=${filter}&page=${page - 1}`} variant="outline" size="sm">Oldingi</ButtonLink> : null}
            {page * limit < total ? <ButtonLink href={`/admin/support?status=${filter}&page=${page + 1}`} variant="outline" size="sm">Keyingi</ButtonLink> : null}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
