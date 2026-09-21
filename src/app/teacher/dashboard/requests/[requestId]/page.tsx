import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { RequestDecisionForm } from "@/components/teacher-dashboard/request-decision-form";
import { OpenConversationButton } from "@/components/messaging/open-conversation-button";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherRequestDetail } from "@/server/enrollment-service";
import {
  ENROLLMENT_STATUS_LABEL,
  enrollmentStatusTone,
  isFinalStatus,
} from "@/lib/enrollment-status";
import { courseFormatLabels } from "@/data/courses";
import { cn, focusRing } from "@/lib/utils";

export const metadata: Metadata = { title: "So‘rov tafsiloti" };

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard/requests/[requestId] — Phase 13.                         */
/*                                                                              */
/* A ROUTE rather than a modal, deliberately: it is refreshable, deep-linkable, */
/* works with browser history, and authorization happens on the server BEFORE   */
/* anything renders.                                                            */
/*                                                                              */
/* Ownership is part of the SQL predicate in getTeacherRequestDetail, so a      */
/* request belonging to another teacher is indistinguishable from one that does */
/* not exist — both 404, and the id reveals nothing.                            */
/*                                                                              */
/* PRIVACY: the student's phone number is never selected by the query and never */
/* rendered here. Contact exchange is not part of the approved workflow.        */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const user = await requireRolePage("teacher", `/teacher/dashboard/requests/${requestId}`);
  const request = await getTeacherRequestDetail(requestId, user.id);
  if (!request) notFound();

  const availability = request.availability;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/teacher/dashboard/requests"
          className={cn(
            "inline-flex items-center gap-1 text-sm text-ink-500",
            "transition-colors duration-fast hover:text-ink-900",
            focusRing,
          )}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          So‘rovlarga qaytish
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          {request.studentName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={enrollmentStatusTone(request.status)}>
            {ENROLLMENT_STATUS_LABEL[request.status]}
          </Badge>
          <span className="text-sm text-ink-500">
            Yuborilgan: {formatDate(request.createdAt)}
          </span>
          {/*
            Phase 16 entry point. The payload carries the ENROLLMENT id, never a
            student id, and the conversation is created only for an accepted
            place. A cancelled request shows nothing here: its thread is history.
          */}
          {request.status === "accepted" ? (
            <OpenConversationButton enrollmentRequestId={request.id} label="O‘quvchiga yozish" />
          ) : null}
        </div>
      </header>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Yozilish tafsilotlari</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-500">Kurs</dt>
            <dd className="mt-0.5 font-medium text-ink-900">
              <Link
                href={`/courses/${request.courseSlug}`}
                className={cn("underline-offset-2 hover:underline", focusRing)}
              >
                {request.courseTitle}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Guruh</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{request.groupTitle}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Format</dt>
            <dd className="mt-0.5 font-medium text-ink-900">
              {courseFormatLabels[request.groupFormat ?? request.courseFormat]}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Jadval</dt>
            <dd className="mt-0.5 font-medium text-ink-900">
              {request.groupDays.join(", ")} · {request.groupStartTime}
              {request.groupEndTime ? `–${request.groupEndTime}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Boshlanish sanasi</dt>
            <dd className="mt-0.5 font-medium text-ink-900">{request.groupStartDate}</dd>
          </div>
          {request.groupLocation ? (
            <div>
              <dt className="text-sm text-ink-500">Manzil</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{request.groupLocation}</dd>
            </div>
          ) : null}
        </dl>

        {request.note ? (
          <div className="mt-5">
            <h3 className="text-sm text-ink-500">O‘quvchi izohi</h3>
            {/* Rendered as text by React — stored markup is inert. */}
            <p className="mt-1 text-base text-ink-700">“{request.note}”</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Guruh bandligi</h2>
        {availability ? (
          <p className="mt-2 text-base text-ink-700">
            Sig‘im {availability.capacity} · qabul qilinganlar {availability.accepted} ·{" "}
            <strong className="text-ink-900">
              {availability.available} ta bo‘sh joy
            </strong>
          </p>
        ) : null}
        <p className="mt-1 text-sm text-ink-500">
          Bo‘sh joylar faqat qabul qilingan so‘rovlar asosida hisoblanadi —
          ko‘rib chiqilmagan so‘rovlar joyni band qilmaydi.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Qaror</h2>
        {isFinalStatus(request.status) ? (
          <div className="mt-2">
            <p className="text-base text-ink-700">
              Bu so‘rov bo‘yicha qaror qabul qilingan:{" "}
              <strong className="text-ink-900">
                {ENROLLMENT_STATUS_LABEL[request.status]}
              </strong>
              .
            </p>
            {request.decisionReason ? (
              <p className="mt-1 text-base text-ink-700">
                Sabab: {request.decisionReason}
              </p>
            ) : null}
            {request.status === "accepted" ? (
              <p className="mt-1 text-sm text-ink-500">
                O‘quvchi guruhga kiritildi. Pullik kursda to‘lovni o‘quvchi amalga oshiradi.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3">
            <RequestDecisionForm requestId={request.id} allowReason />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-ink-900">Holat tarixi</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {request.history.map((event) => (
            <li key={event.id} className="text-sm text-ink-700">
              <span className="text-ink-500">{formatDate(event.createdAt)}</span>{" "}
              {event.fromStatus
                ? `${ENROLLMENT_STATUS_LABEL[event.fromStatus]} → ${ENROLLMENT_STATUS_LABEL[event.toStatus]}`
                : ENROLLMENT_STATUS_LABEL[event.toStatus]}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
