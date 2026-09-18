import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/server/auth/guards";
import { getSupportTicketForAdmin } from "@/server/support-service";
import { SupportStatusForm } from "@/components/admin/support-status-form";
import { AdminField, AdminPanel, formatAdminDateTime } from "@/components/admin/admin-ui";
import { Badge, ButtonLink } from "@/components/ui";
import { SUPPORT_STATUS_TONE } from "@/lib/support";

export const metadata: Metadata = { title: "Murojaat", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSupportDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const admin = await requireAdminPage("/admin/support");
  if (!admin) return null;
  const { ticketId } = await params;
  const ticket = await getSupportTicketForAdmin(ticketId);
  if (!ticket) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div><ButtonLink href="/admin/support" variant="ghost" size="sm">← Yordam navbatiga qaytish</ButtonLink></div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">Murojaat</h1><p className="mt-1 font-mono text-xs text-ink-500">{ticket.id}</p></div>
        <Badge variant={SUPPORT_STATUS_TONE[ticket.status]}>{ticket.statusLabel}</Badge>
      </header>
      <AdminPanel title="Murojaat mazmuni" description="Parol va maxfiy to‘lov ma’lumotlari bu sahifada ko‘rsatilmaydi va so‘ralmaydi.">
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4"><AdminField label="Mavzu">{ticket.categoryLabel}</AdminField><AdminField label="Yuborilgan"><time dateTime={ticket.createdAt.toISOString()}>{formatAdminDateTime(ticket.createdAt)}</time></AdminField><AdminField label="Yangilangan"><time dateTime={ticket.updatedAt.toISOString()}>{formatAdminDateTime(ticket.updatedAt)}</time></AdminField><AdminField label="Bog‘liq yozuv">{ticket.relatedEntityId ? `${ticket.relatedEntityType} · ${ticket.relatedEntityId}` : "—"}</AdminField></dl>
          <div className="rounded-lg border border-line bg-surface-muted p-4"><p className="whitespace-pre-wrap text-base leading-relaxed text-ink-900">{ticket.message}</p></div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3"><AdminField label="Murojaatchi">{ticket.reporterName ?? "Foydalanuvchi ko‘rsatilmagan"}</AdminField><AdminField label="Hisob turi">{ticket.reporterRole ?? "—"}</AdminField><AdminField label="Biriktirilgan operator">{ticket.assignedAdminUserId ?? "—"}</AdminField></dl>
          {ticket.status === "closed" ? (
            <p className="text-sm text-ink-500">Yopilgan murojaat qayta ochilmaydi. Muammo davom etsa, foydalanuvchi yangi murojaat yuborishi mumkin.</p>
          ) : (
            <SupportStatusForm ticketId={ticket.id} status={ticket.status} />
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
