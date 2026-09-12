import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/ui";
import type { TeacherRequestView } from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* TeacherRequestCard — the teacher-side read of the ONE Phase 7 local draft.   */
/* Honest by construction: the status wording is limited to "Tugallanmagan      */
/* qoralama" / "So'rov tayyor", always paired with the "mahalliy prototip       */
/* ma'lumoti / backend ulanmagan" reason. There is intentionally NO approve,    */
/* reject, confirm-payment or message control — not even disabled ones — since  */
/* none of those operations exist anywhere in the product.                       */
/* Server component: pure projection.                                            */
/* -------------------------------------------------------------------------- */

export function TeacherRequestCard({ request }: { request: TeacherRequestView }) {
  const rows: { label: string; value: string }[] = [
    ...(request.groupTitle ? [{ label: "Guruh", value: request.groupTitle }] : []),
    ...(request.scheduleLabel
      ? [{ label: "Kunlar va vaqt", value: request.scheduleLabel }]
      : []),
    ...(request.formatLabel ? [{ label: "Format", value: request.formatLabel }] : []),
    ...(request.whereLabel ? [{ label: "Manzil", value: request.whereLabel }] : []),
    ...(request.startDateLabel
      ? [{ label: "Boshlanish", value: request.startDateLabel }]
      : []),
    ...(request.seatsLabel ? [{ label: "Joylar", value: request.seatsLabel }] : []),
    { label: "Narx", value: request.priceSummary },
    ...(request.studentName ? [{ label: "O‘quvchi", value: request.studentName }] : []),
    ...(request.studentPhone ? [{ label: "Telefon", value: request.studentPhone }] : []),
    ...(request.note ? [{ label: "Izoh", value: request.note }] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-semibold text-balance text-ink-900">
            <Link href={request.courseHref} className="underline-offset-2 hover:underline">
              {request.courseTitle}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-500">{request.statusNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={request.status === "prepared" ? "accent" : "warning"} size="md">
            {request.statusLabel}
          </Badge>
          <Badge variant="neutral" size="md">
            Mahalliy prototip ma’lumoti
          </Badge>
        </div>
      </div>

      {request.groupTitle === null ? (
        <p className="text-base text-ink-700">
          O‘quvchi hali guruh tanlamagan — quyida faqat mavjud ma’lumot ko‘rsatilgan.
        </p>
      ) : null}

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd className="text-base text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <ButtonLink href={request.courseHref} variant="outline" size="sm">
          Kurs sahifasi
        </ButtonLink>
      </div>
    </Card>
  );
}
