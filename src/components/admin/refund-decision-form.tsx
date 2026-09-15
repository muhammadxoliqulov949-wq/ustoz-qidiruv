"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  approveRefundAction,
  recordRefundFailureAction,
  rejectRefundAction,
} from "@/server/actions/admin-refunds";
import {
  REFUND_FEEDBACK_MAX_LENGTH,
  REFUND_FEEDBACK_MIN_LENGTH,
  REFUND_PROVIDER_BOUNDARY_NOTE,
  REFUND_PROVIDER_PENDING_NOTE,
  type RefundStatus,
} from "@/lib/refund";

/* -------------------------------------------------------------------------- */
/* Refund decision controls — Phase 17.                                        */
/*                                                                             */
/* WHAT IS NOT HERE, ON PURPOSE: a "mark as refunded" button. Completion is a   */
/* PROVIDER fact. An administrator who returns the money does it in the Payme   */
/* merchant cabinet, and the authenticated `CancelTransaction` callback records  */
/* it here. Offering a button that wrote `completed` would let the product claim */
/* a refund that never happened.                                               */
/*                                                                             */
/* Decisions are confirmed before they are sent (they are not undoable), the    */
/* reviewer is never a form field — the server reads the session — and the       */
/* result is announced in a live region that stays on screen.                   */
/* -------------------------------------------------------------------------- */

type Action = "approve" | "reject" | "fail";

export function RefundDecisionForm({
  refundRequestId,
  status,
  studentName,
}: {
  refundRequestId: string;
  status: RefundStatus;
  studentName: string;
}) {
  const router = useRouter();
  const feedbackId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<Action | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const trimmed = feedback.trim();
  const feedbackTooShort = trimmed.length > 0 && trimmed.length < REFUND_FEEDBACK_MIN_LENGTH;
  const feedbackRequired = action === "reject" || action === "fail";
  const canSubmit =
    !pending && (!feedbackRequired || trimmed.length >= REFUND_FEEDBACK_MIN_LENGTH);

  function open(next: Action) {
    setAction(next);
    setError(null);
    setDone(null);
    // Focus the confirmation panel so a keyboard/screen-reader user is taken to
    // the decision they just opened, not left at the button they pressed.
    requestAnimationFrame(() => panelRef.current?.focus());
  }

  function submit() {
    if (!action) return;
    setError(null);
    const form = new FormData();
    form.set("refundRequestId", refundRequestId);
    if (feedbackRequired) form.set("feedback", trimmed);

    startTransition(async () => {
      const result =
        action === "approve"
          ? await approveRefundAction(form)
          : action === "reject"
            ? await rejectRefundAction(form)
            : await recordRefundFailureAction(form);
      if (result.ok) {
        setDone(
          action === "approve"
            ? `${studentName}: so‘rov tasdiqlandi. ${REFUND_PROVIDER_PENDING_NOTE}`
            : action === "reject"
              ? `${studentName}: so‘rov rad etildi va o‘quvchi izohni ko‘radi.`
              : `${studentName}: provayder natijasi qayd etildi.`,
        );
        setAction(null);
        setFeedback("");
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  const labels: Record<Action, { title: string; body: string; confirm: string }> = {
    approve: {
      title: "So‘rovni tasdiqlash",
      body: `Tasdiqlash pulni qaytarmaydi: ${REFUND_PROVIDER_PENDING_NOTE} ${REFUND_PROVIDER_BOUNDARY_NOTE}`,
      confirm: "Tasdiqlayman",
    },
    reject: {
      title: "So‘rovni rad etish",
      body: "Rad etilsa yozilish qabul qilingan holatda qoladi, joy band bo‘lib turadi va o‘quvchi pulni olmaydi. Izoh o‘quvchiga ko‘rsatiladi.",
      confirm: "Rad etaman",
    },
    fail: {
      title: "Provayder natijasini qayd etish: bajarilmadi",
      body: "Provayder qaytarishni bajara olmagan bo‘lsa, buni shu yerda qayd eting. Yozilish va joy o‘zgarmaydi, o‘quvchi keyin yangi so‘rov yuborishi mumkin.",
      confirm: "Qayd etaman",
    },
  };

  if (status === "completed" || status === "rejected" || status === "failed") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-700">
          {status === "completed"
            ? "Yakunlangan: qaytarishni provayder tasdiqlagan, qo‘shimcha qaror talab qilinmaydi."
            : status === "rejected"
              ? "Rad etilgan: yozilish qabul qilingan holatda qoldi."
              : "Bajarilmadi: provayder operatsiyasi natijasi qayd etilgan."}
        </p>
        <p className="text-sm text-ink-500">{REFUND_PROVIDER_BOUNDARY_NOTE}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "requested" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => open("approve")}>
            <Check aria-hidden="true" className="me-1 size-4" />
            Tasdiqlash
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => open("reject")}
          >
            <X aria-hidden="true" className="me-1 size-4" />
            Rad etish
          </Button>
        </div>
      ) : null}

      {status === "awaiting_provider" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-700">{REFUND_PROVIDER_PENDING_NOTE}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => open("fail")}
            >
              <RotateCcw aria-hidden="true" className="me-1 size-4" />
              Bajarilmadi deb qayd etish
            </Button>
          </div>
        </div>
      ) : null}

      {action ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="group"
          aria-label={labels[action].title}
          className="flex flex-col gap-2 rounded-lg border border-line bg-ink-900/[0.02] p-3"
        >
          <p className="text-sm font-semibold text-ink-900">{labels[action].title}</p>
          <p className="text-sm text-ink-700">{labels[action].body}</p>

          {feedbackRequired ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={feedbackId} className="text-sm font-medium text-ink-900">
                Izoh (o‘quvchi ko‘radi)
              </label>
              <textarea
                id={feedbackId}
                rows={3}
                value={feedback}
                maxLength={REFUND_FEEDBACK_MAX_LENGTH}
                aria-invalid={feedbackTooShort}
                onChange={(event) => setFeedback(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus-visible:border-accent-500"
              />
              <p className="text-xs text-ink-400">
                {trimmed.length}/{REFUND_FEEDBACK_MAX_LENGTH}
                {feedbackTooShort ? ` — kamida ${REFUND_FEEDBACK_MIN_LENGTH} belgi` : ""}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
              {pending ? "Yuborilmoqda…" : labels[action].confirm}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setAction(null);
                setError(null);
              }}
            >
              Yopish
            </Button>
          </div>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Qaror saqlanmoqda…</span> : null}
        {done ? <span className="font-medium text-emerald-800">{done}</span> : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}
