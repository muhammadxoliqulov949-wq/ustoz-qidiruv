"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { requestRefundAction } from "@/server/actions/refunds";
import {
  REFUND_REASON_MAX_LENGTH,
  REFUND_REASON_MIN_LENGTH,
  REFUND_REQUEST_ACK,
  REFUND_REQUEST_CTA,
  REFUND_REQUEST_NOTICE,
} from "@/lib/refund";

/* -------------------------------------------------------------------------- */
/* Refund request control — Phase 17. A deliberately small client island.      */
/*                                                                             */
/* WHAT IT SENDS: which enrollment, and why. Nothing else. There is no amount, */
/* no payment id and no status in the payload — the server derives the amount  */
/* from the payment's immutable snapshot and the student from the session      */
/* cookie, and the action's `.strict()` schema REJECTS any of those fields      */
/* rather than ignoring them.                                                  */
/*                                                                             */
/* WHAT IT PROMISES: nothing. The notice says an administrator will review the  */
/* request and that money is only returned once the PROVIDER confirms it. The   */
/* button is not "get my money back" — it is "ask".                            */
/*                                                                             */
/* A11Y: a real labelled textarea (not a placeholder), a character counter, a   */
/* live region that announces the result, and the confirmation kept on screen   */
/* after the form collapses rather than vanishing with the element.             */
/* -------------------------------------------------------------------------- */

export function RefundRequestForm({
  enrollmentRequestId,
  amountLabel,
}: {
  enrollmentRequestId: string;
  /** Pre-formatted server-side, e.g. "150 000 so'm". Display only. */
  amountLabel: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const noticeId = useId();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REFUND_REASON_MIN_LENGTH;
  const canSubmit = trimmed.length >= REFUND_REASON_MIN_LENGTH && !pending;

  function submit() {
    setError(null);
    setDone(null);
    const form = new FormData();
    form.set("enrollmentRequestId", enrollmentRequestId);
    form.set("reason", trimmed);
    startTransition(async () => {
      const result = await requestRefundAction(form);
      if (result.ok) {
        setDone(REFUND_REQUEST_ACK);
        setOpen(false);
        setReason("");
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-1.5">
        <p role="status" aria-live="polite" className="text-sm font-medium text-emerald-800">
          {done}
        </p>
        <p className="text-sm text-ink-500">{REFUND_REQUEST_NOTICE}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={reasonId} className="text-sm font-medium text-ink-900">
            Pulni qaytarish sababi
          </label>
          <textarea
            id={reasonId}
            name="reason"
            rows={3}
            value={reason}
            maxLength={REFUND_REASON_MAX_LENGTH}
            aria-describedby={noticeId}
            aria-invalid={tooShort || Boolean(error)}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus-visible:border-accent-500"
            placeholder="Masalan: guruh jadvali menga mos kelmadi."
          />
          <p className="text-xs text-ink-400">
            {trimmed.length}/{REFUND_REASON_MAX_LENGTH} belgi
            {tooShort ? ` — kamida ${REFUND_REASON_MIN_LENGTH} belgi kerak` : ""}
          </p>
          <p id={noticeId} className="text-sm text-ink-500">
            {REFUND_REQUEST_NOTICE} Summa: {amountLabel}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
              <RotateCcw aria-hidden="true" className="me-1 size-4" />
              {pending ? "Yuborilmoqda…" : "So‘rovni yuborish"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <RotateCcw aria-hidden="true" className="me-1 size-4" />
            {REFUND_REQUEST_CTA}
          </Button>
          <p className="text-sm text-ink-500">{REFUND_REQUEST_NOTICE}</p>
        </div>
      )}

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">So‘rov yuborilmoqda…</span> : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}
