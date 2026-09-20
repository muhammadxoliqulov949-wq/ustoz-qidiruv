import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { AdminField, AdminPanel, formatAdminDateTime } from "@/components/admin/admin-ui";
import { RefundDecisionForm } from "@/components/admin/refund-decision-form";
import { getRefundForAdmin } from "@/server/refund-service";
import {
  REFUND_PROVIDER_BOUNDARY_NOTE,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_NOTE,
  refundStatusTone,
} from "@/lib/refund";
import { formatTiyin } from "@/lib/money";

/* -------------------------------------------------------------------------- */
/* /admin/refunds/[refundId] — one refund, everything needed to decide.         */
/*                                                                              */
/* A missing or unknown id is a plain 404 through the admin not-found boundary,  */
/* so an id cannot be probed for existence. There is no ownership predicate      */
/* here because an administrator is authorized to see any refund — that is what  */
/* the role is for — and the projection still carries no credential, no card data */
/* and no raw provider payload.                                                  */
/*                                                                              */
/* THE PROVIDER SECTION IS THE POINT OF THIS PAGE. It shows the Payme            */
/* transaction state in WORDS (1 = created, 2 = performed, -1 = cancelled,       */
/* -2 = cancelled after perform) so the operator can see that the money really    */
/* arrived before they return it — and knows that only a -2 callback will mark    */
/* the refund completed.                                                         */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Qaytarish so‘rovi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Payme's protocol states, spelled out for the operator. */
const PROVIDER_STATE_LABEL: Record<number, string> = {
  1: "1 — yaratilgan, hali tasdiqlanmagan",
  2: "2 — muvaffaqiyatli yakunlangan (pul olingan)",
  [-1]: "-1 — yakunlanmasdan bekor qilingan (pul olinmagan)",
  [-2]: "-2 — yakunlangandan keyin bekor qilingan (pul qaytarilgan)",
};

/** Payme's documented cancellation reason codes — official semantics only. */
const REASON_LABEL: Record<number, string> = {
  1: "Qabul qiluvchi topilmadi yoki faol emas",
  2: "Debet operatsiyasida xatolik",
  3: "Tranzaksiyani bajarishda xatolik",
  4: "Tranzaksiya vaqt tugashi bilan bekor qilindi",
  5: "Pul qaytarildi",
  10: "Noma’lum xatolik",
};

/**
 * Provider timestamps are unix milliseconds in Payme's own units, so they are
 * converted ONCE, on the server, into the same fixed-timezone format the rest of
 * the admin area uses. `0` means "this never happened" in the protocol, so it is
 * rendered as a dash rather than as 1 January 1970.
 */
function formatProviderTime(value: bigint | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return formatAdminDateTime(new Date(ms));
}

const EVENT_LABEL: Record<string, string> = {
  requested: "So‘rov yuborildi",
  approved: "Administrator tasdiqladi",
  rejected: "Administrator rad etdi",
  provider_refund_completed: "Provayder qaytarishni tasdiqladi",
  provider_refund_failed: "Provayder natijasi: bajarilmadi",
  provider_reversal_recorded: "Provayder tashabbusi bilan qaytarish qayd etildi",
};

export default async function AdminRefundDetailPage({
  params,
}: {
  params: Promise<{ refundId: string }>;
}) {
  /*
   * DEFENCE IN DEPTH (Phase 18). The layout renders the refusal screen for a
   * non-admin session, but this page must never PRODUCE data for one: Next
   * serialises page segments for the client router, and a signed evidence URL
   * or a document name must not reach a browser that is not an admin's.
   */
  const admin = await requireAdminPage("/admin/refunds");
  if (!admin) return null;

  const { refundId } = await params;
  const detail = await getRefundForAdmin(refundId);
  if (!detail) notFound();

  const { refund, events, providerTransaction, payment } = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/refunds"
          className="inline-flex items-center gap-1 text-sm text-ink-500 underline-offset-2 hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Navbatga qaytish
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          {refund.studentName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={refundStatusTone(refund.status)}>
            {REFUND_STATUS_LABEL[refund.status]}
          </Badge>
          <span className="text-sm text-ink-500">
            {refund.courseTitle} · {refund.groupTitle}
          </span>
          {refund.systemInitiated ? (
            <Badge variant="neutral">Provayder tashabbusi</Badge>
          ) : null}
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-ink-700">
          {REFUND_STATUS_NOTE[refund.status]}
        </p>
      </header>

      <AdminPanel title="Qaror" description="Qaror qaytarib olinmaydi va jurnalga yoziladi.">
        <RefundDecisionForm
          refundRequestId={refund.id}
          status={refund.status}
          studentName={refund.studentName}
        />
        <p className="mt-3 text-sm leading-relaxed text-ink-500">{REFUND_PROVIDER_BOUNDARY_NOTE}</p>
      </AdminPanel>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">So‘rov</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <AdminField label="Summa (to‘liq qaytarish)">{formatTiyin(refund.amountTiyin)}</AdminField>
          <AdminField label="Holat">{REFUND_STATUS_LABEL[refund.status]}</AdminField>
          <AdminField label="So‘ralgan vaqt">{formatAdminDateTime(refund.requestedAt)}</AdminField>
          <AdminField label="Ko‘rib chiqilgan vaqt">
            {formatAdminDateTime(refund.reviewedAt)}
          </AdminField>
          <AdminField label="Yakunlangan vaqt">{formatAdminDateTime(refund.completedAt)}</AdminField>
          <AdminField label="O‘quvchi">{refund.studentName}</AdminField>
          <AdminField label="Kurs">{refund.courseTitle}</AdminField>
          <AdminField label="Guruh">{refund.groupTitle}</AdminField>
        </dl>
        <p className="mt-4 text-sm text-ink-700">Sabab: {refund.reason}</p>
        {refund.adminFeedback ? (
          <p className="mt-2 text-sm text-ink-700">
            Administrator izohi: {refund.adminFeedback}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">To‘lov va provayder</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <AdminField label="To‘lov holati">{payment.status}</AdminField>
          <AdminField label="To‘lov summasi">{formatTiyin(payment.amountTiyin)}</AdminField>
          <AdminField label="Valyuta">{payment.currency}</AdminField>
          <AdminField label="Provayder">{payment.provider}</AdminField>
          <AdminField label="To‘lov yaratilgan">{formatAdminDateTime(payment.createdAt)}</AdminField>
          <AdminField label="To‘langan vaqt">{formatAdminDateTime(payment.paidAt)}</AdminField>
          <AdminField label="Provayder tranzaksiyasi">
            {providerTransaction ? providerTransaction.id : "—"}
          </AdminField>
          <AdminField label="Provayder holati">
            {providerTransaction
              ? (PROVIDER_STATE_LABEL[providerTransaction.state] ?? String(providerTransaction.state))
              : "—"}
          </AdminField>
          <AdminField label="Provayderda bajarilgan">
            {formatProviderTime(providerTransaction?.performedAt)}
          </AdminField>
          <AdminField label="Provayderda bekor qilingan">
            {formatProviderTime(providerTransaction?.cancelledAt)}
          </AdminField>
          <AdminField label="Bekor qilish sababi (kod)">
            {providerTransaction?.reasonCode === null ||
            providerTransaction?.reasonCode === undefined
              ? "—"
              : `${providerTransaction.reasonCode} — ${
                  REASON_LABEL[providerTransaction.reasonCode] ?? "boshqa"
                }`}
          </AdminField>
        </dl>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">So‘rov tarixi</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="text-sm text-ink-700">
              <span className="text-ink-500">{formatAdminDateTime(event.createdAt)}</span>{" "}
              {EVENT_LABEL[event.type] ?? event.type}
              {" · "}
              <span className="text-ink-500">
                {event.actorIsProvider
                  ? "provayder"
                  : event.actorUserId
                    ? "administrator"
                    : "tizim"}
                {event.fromStatus ? ` · ${event.fromStatus} → ${event.toStatus}` : ""}
                {event.reasonCode === null ? "" : ` · sabab kodi: ${event.reasonCode}`}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-500">
          Tarix o‘zgartirilmaydi: hech bir yozuv tahrirlanmaydi yoki o‘chirilmaydi.
        </p>
      </Card>
    </div>
  );
}
