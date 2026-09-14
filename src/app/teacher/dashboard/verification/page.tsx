import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { VerificationSubmitForm } from "@/components/teacher-dashboard/verification-submit-form";
import { requireRolePage } from "@/server/auth/guards";
import { getTeacherVerificationState } from "@/server/verification-service";
import {
  DOCUMENT_REVIEW_NOTICE,
  VERIFICATION_ALREADY_PENDING_NOTE,
  VERIFICATION_INELIGIBLE_NOTE,
  VERIFICATION_MEANS_NOTE,
  VERIFICATION_REQUEST_STATE_LABEL,
  VERIFICATION_REQUEST_STATE_TONE,
  VERIFICATION_RESUBMIT_NOTE,
  VERIFICATION_STATE_LABEL,
  VERIFICATION_STATE_NOTE,
  VERIFICATION_STATE_TONE,
} from "@/lib/teacher-verification";

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard/verification — the teacher's own trust state (Phase 15). */
/*                                                                              */
/* WHAT THIS SCREEN CAN DO: show the state the DATABASE holds, list the missing  */
/* profile fields, submit ONE application, show the reviewer's feedback, and let */
/* the teacher re-apply after a rejection. Nothing here can set `verified` — the */
/* action can only insert a PENDING request, and the word "verified" is written  */
/* exclusively by the admin decision path.                                       */
/*                                                                              */
/* WHAT IT DOES NOT DO: no document upload and no promise of one. The notice     */
/* says plainly that document review is a later stage, so the screen never       */
/* implies evidence was inspected.                                              */
/*                                                                              */
/* Identity is the session (`requireRolePage`) — there is no teacher id in the   */
/* URL or in any payload on this route.                                          */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Profil tasdig‘i",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});

export const dynamic = "force-dynamic";

export default async function TeacherVerificationPage() {
  const user = await requireRolePage("teacher", "/teacher/dashboard/verification");
  const state = await getTeacherVerificationState(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Profil tasdig‘i
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Tasdiqlangan ustoz ishonch belgisi bilan ko‘rinadi va kursini e’lon
          qilish uchun moderatsiyaga yuborish huquqini oladi.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={VERIFICATION_STATE_TONE[state.state]} size="md">
            {VERIFICATION_STATE_LABEL[state.state]}
          </Badge>
          {state.pending ? (
            <span className="text-sm text-ink-500">
              Ariza yuborilgan:{" "}
              <time dateTime={state.pending.submittedAt.toISOString()}>
                {dateFormatter.format(state.pending.submittedAt)}
              </time>
            </span>
          ) : null}
        </div>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          {VERIFICATION_STATE_NOTE[state.state]}
        </p>
        <p className="text-sm leading-relaxed text-ink-500">
          {VERIFICATION_MEANS_NOTE} {DOCUMENT_REVIEW_NOTICE}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
        <h2 className="text-xl font-semibold text-ink-900">Ariza</h2>
        {state.state === "pending" ? (
          <EmptyState title="Ariza ko‘rib chiqilmoqda" as="h3">
            {VERIFICATION_ALREADY_PENDING_NOTE} Tasdiqlangach yoki qaytarilgach
            natija{" "}
            <Link
              href="/notifications"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              bildirishnomalar
            </Link>{" "}
            bo‘limida ham ko‘rinadi.
          </EmptyState>
        ) : state.state === "verified" ? (
          <p className="max-w-prose text-base leading-relaxed text-ink-700">
            Profilingiz tasdiqlangan — qayta ariza yuborish shart emas.
          </p>
        ) : (
          <VerificationSubmitForm eligible={state.eligible} missingCount={state.missing.length} />
        )}

        {!state.eligible && state.state !== "verified" && state.state !== "pending" ? (
          <div>
            <h3 className="text-sm font-medium text-ink-700">{VERIFICATION_INELIGIBLE_NOTE}</h3>
            <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-base text-ink-900">
              {state.missing.map((requirement) => (
                <li key={requirement.key}>{requirement.label}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              <Link
                href="/teacher/dashboard/profile"
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                Profilni to‘ldirish
              </Link>
            </p>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
        <h2 className="text-xl font-semibold text-ink-900">Arizalar tarixi</h2>
        {state.history.length === 0 ? (
          <EmptyState title="Ariza yuborilmagan" as="h3">
            Siz hali tasdiqlash uchun ariza yubormagan.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {state.history.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-1 rounded-lg border border-line bg-surface-muted p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={VERIFICATION_REQUEST_STATE_TONE[request.status]}>
                    {VERIFICATION_REQUEST_STATE_LABEL[request.status]}
                  </Badge>
                  <time
                    dateTime={request.submittedAt.toISOString()}
                    className="text-sm text-ink-500"
                  >
                    {dateFormatter.format(request.submittedAt)}
                  </time>
                </div>
                {request.feedback ? (
                  <p className="max-w-prose text-base leading-relaxed text-ink-900">
                    <span className="text-sm text-ink-500">Administrator izohi: </span>
                    {request.feedback}
                  </p>
                ) : null}
                {request.status === "rejected" ? (
                  <p className="text-sm leading-relaxed text-ink-500">
                    {VERIFICATION_RESUBMIT_NOTE}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
