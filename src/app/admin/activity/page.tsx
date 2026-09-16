import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/guards";
import Link from "next/link";
import { AdminPanel, formatAdminDateTime, isoDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { countAuditEvents, listAuditEvents } from "@/server/audit-service";
import type { AdminAuditAction } from "@/server/audit-service";

/* -------------------------------------------------------------------------- */
/* /admin/activity — the immutable admin decision log (Phase 15).              */
/*                                                                              */
/* READ-ONLY BY CONSTRUCTION. There is no server action that writes here other   */
/* than the decision services (inside their own transaction), and no UPDATE or   */
/* DELETE statement anywhere targets this table — a decision cannot be edited or */
/* removed from the product, only superseded by a later decision.                */
/*                                                                              */
/* The log records WHO (admin user id), WHAT, WHICH record and WHEN. It does not */
/* record payment data, phone numbers, hashes or free-form payloads: `metadata`  */
/* is a short machine-readable summary (see audit-service.recordAdminEvent).      */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Jurnal",
  description: "Administrator qarorlarining o‘zgarmas tarixi.",
  robots: { index: false, follow: false },
};

const ACTION_LABEL: Record<AdminAuditAction, string> = {
  teacher_verified: "Ustoz tasdiqlandi",
  teacher_verification_rejected: "Ustoz arizasi qaytarildi",
  course_published: "Kurs e’lon qilindi",
  course_changes_requested: "Kursga o‘zgartirish so‘raldi",
  // Phase 17. Note what is recorded: the DECISION. Completion is a provider
  // fact and lives in the refund's own event history, not here.
  refund_approved: "Pulni qaytarish so‘rovi tasdiqlandi",
  refund_rejected: "Pulni qaytarish so‘rovi rad etildi",
  refund_failed: "Pulni qaytarish natijasi: bajarilmadi",
  /*
   * Phase 19. Again the DECISION is what is recorded — and this one changes a
   * public number, which is exactly why it belongs in an append-only log.
   */
  review_published: "O‘quvchi fikri e’lon qilindi",
  review_rejected: "O‘quvchi fikri e’lon qilinmadi",
};

const ACTION_TONE: Record<AdminAuditAction, "success" | "warning"> = {
  teacher_verified: "success",
  course_published: "success",
  refund_approved: "success",
  teacher_verification_rejected: "warning",
  course_changes_requested: "warning",
  refund_rejected: "warning",
  refund_failed: "warning",
  review_published: "success",
  review_rejected: "warning",
};

/**
 * Deep link per entity kind.
 *
 * A review has no detail route of its own — the moderation queue is the screen
 * where it is read and decided — so the link goes there, and the course the review
 * belongs to is carried in the row's own `metadata` (`course=<slug>`).
 */
function entityHref(
  entityType: "teacher" | "course" | "refund" | "review",
  entityId: string,
): string {
  if (entityType === "refund") return `/admin/refunds/${entityId}`;
  if (entityType === "review") return "/admin/reviews";
  return entityType === "teacher"
    ? `/admin/teachers/${entityId}`
    : `/admin/courses/${entityId}`;
}

const ENTITY_LABEL: Record<"teacher" | "course" | "refund" | "review", string> = {
  teacher: "Ustoz",
  course: "Kurs",
  refund: "Qaytarish",
  review: "Fikr",
};

export default async function AdminActivityPage() {
  /*
   * DEFENCE IN DEPTH (Phase 18). The admin layout renders the refusal
   * screen for a non-admin session, but a page must never PRODUCE data for
   * one: Next serialises page segments for the client router, so "the
   * layout did not render me" is not a guarantee. Returning null here
   * means a non-admin gets the refusal screen and an empty payload.
   */
  const admin = await requireAdminPage("/admin/activity");
  if (!admin) return null;

  const [events, total] = await Promise.all([listAuditEvents({ limit: 200 }), countAuditEvents()]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900 md:text-4xl">
          Qarorlar jurnali
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Faqat administrator qarorlari yoziladi: tasdiqlash, qaytarish, e’lon
          qilish. Yozuvlar o‘zgartirilmaydi va o‘chirilmaydi — xato bo‘lsa, ustiga
          yangi qaror yoziladi.
        </p>
      </header>

      <AdminPanel
        title="Yozuvlar"
        description={`Jami ${total} ta qaror. Eng yangisi birinchi.`}
      >
        {events.length === 0 ? (
          <EmptyState title="Jurnal bo‘sh" as="h3">
            Hali birorta qaror qabul qilinmagan. Birinchi tasdiqlash yoki
            moderatsiya qaroridan keyin yozuv shu yerda paydo bo‘ladi.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION_TONE[event.action]}>{ACTION_LABEL[event.action]}</Badge>
                  <Link
                    href={entityHref(event.entityType, event.entityId)}
                    className="text-sm font-medium text-accent-700 underline underline-offset-2"
                  >
                    {ENTITY_LABEL[event.entityType]}: {event.entityId}
                  </Link>
                  <time
                    dateTime={isoDate(event.createdAt)}
                    className="text-sm text-ink-500"
                  >
                    {formatAdminDateTime(event.createdAt)}
                  </time>
                </div>
                {event.metadata ? (
                  <p className="text-sm text-ink-500">{event.metadata}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {events.length < total ? (
          <p className="text-sm text-ink-500">
            Oxirgi {events.length} ta yozuv ko‘rsatilgan. Jami {total} ta.
          </p>
        ) : null}
      </AdminPanel>
    </div>
  );
}
