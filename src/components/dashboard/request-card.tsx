import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/ui";
import type { DashRequest } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* RequestCard — the BROWSER-LOCAL enrollment draft rendered honestly.          */
/* Status wording comes from lib/dashboard (“So‘rov tayyor” / “Tugallanmagan    */
/* qoralama”) and is always paired with the reason line, which points at the    */
/* account section for server-side requests. There is no accepted / confirmed / */
/* paid / teacher-approved state to render here — those facts live in the       */
/* account requests above, rendered from real rows.                             */
/* Server component: pure projection, no interactivity of its own.              */
/* -------------------------------------------------------------------------- */

export function RequestCard({ request }: { request: DashRequest }) {
  const rows: { label: string; value: string }[] = [
    { label: "Ustoz", value: request.teacherName },
    ...(request.group
      ? [
          { label: "Guruh", value: request.group.title },
          { label: "Kunlar va vaqt", value: request.group.scheduleLabel },
          { label: "Format", value: request.group.formatLabel },
          { label: "Manzil", value: request.group.whereLabel },
          { label: "Boshlanish", value: request.group.startDateLabel },
          { label: "Joylar", value: request.group.seatsLabel },
        ]
      : [{ label: "Guruh", value: "Tanlanmagan" }]),
    { label: "Narx", value: request.priceSummary },
    ...(request.studentName ? [{ label: "Ism", value: request.studentName }] : []),
    ...(request.studentPhone
      ? [{ label: "Telefon", value: request.studentPhone }]
      : []),
    ...(request.note ? [{ label: "Izoh", value: request.note }] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-semibold text-balance text-ink-900">
            <Link
              href={request.courseHref}
              className="underline-offset-2 hover:underline"
            >
              {request.courseTitle}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-500">{request.statusNote}</p>
        </div>
        <Badge
          variant={request.status === "prepared" ? "accent" : "warning"}
          size="md"
        >
          {request.statusLabel}
        </Badge>
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd className="text-base text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <ButtonLink href={request.enrollHref} variant="outline" size="sm">
          {request.status === "prepared"
            ? "So‘rovni tahrirlash"
            : "Qoralamani davom ettirish"}
        </ButtonLink>
        <ButtonLink href={request.courseHref} variant="ghost" size="sm">
          Kurs sahifasi
        </ButtonLink>
      </div>
    </Card>
  );
}
