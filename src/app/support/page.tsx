import type { Metadata } from "next";
import { requireUserPage } from "@/server/auth/guards";
import { countOwnSupportTickets, listOwnSupportTickets } from "@/server/support-service";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge, ButtonLink } from "@/components/ui";
import { SUPPORT_STATUS_TONE } from "@/lib/support";
import { formatAdminDateTime } from "@/components/admin/admin-ui";

export const metadata: Metadata = {
  title: "Yordam va murojaatlar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUserPage("/support");
  const total = await countOwnSupportTickets(user.id);
  const params = await searchParams;
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 50;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pageCount);
  const tickets = await listOwnSupportTickets(user.id, {
    limit,
    offset: (page - 1) * limit,
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">Yordam va murojaatlar</h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-500">
          Hisob, ustoz yoki kurs, to‘lov, nomaqbul kontent va texnik muammolar haqida xabar bering. Har bir murojaat operator navbatida saqlanadi.
        </p>
      </header>
      <SupportTicketForm />
      <section className="flex flex-col gap-3" aria-labelledby="my-tickets">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="my-tickets" className="text-xl font-semibold text-ink-900">Murojaatlarim</h2>
          <span className="text-sm text-ink-500">Jami: {total}</span>
        </div>
        {tickets.length === 0 ? (
          <EmptyState title="Hali murojaat yo‘q" as="h3">
            Muammo yuzaga kelsa, yuqoridagi shakl orqali murojaat yuboring. Yuborilgach operator holatini shu yerda ko‘rasiz.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SUPPORT_STATUS_TONE[ticket.status]}>{ticket.statusLabel}</Badge>
                    <span className="text-sm font-medium text-ink-900">{ticket.categoryLabel}</span>
                  </div>
                  <time dateTime={ticket.createdAt.toISOString()} className="text-sm text-ink-500">{formatAdminDateTime(ticket.createdAt)}</time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{ticket.message}</p>
                {ticket.relatedEntityId ? <p className="text-xs text-ink-500">Bog‘liq yozuv: {ticket.relatedEntityType} · {ticket.relatedEntityId}</p> : null}
                <p className="text-xs text-ink-400">Yangilangan: {formatAdminDateTime(ticket.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-ink-500">
            {tickets.length ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}` : "0 / 0"}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <ButtonLink href={`/support?page=${page - 1}`} variant="outline" size="sm">
                Oldingi
              </ButtonLink>
            ) : null}
            {page < pageCount ? (
              <ButtonLink href={`/support?page=${page + 1}`} variant="outline" size="sm">
                Keyingi
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
