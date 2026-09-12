"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  acceptEnrollmentAction,
  rejectEnrollmentAction,
} from "@/server/actions/enrollment-decision";

/* -------------------------------------------------------------------------- */
/* Accept / reject controls — Phase 13.                                        */
/*                                                                              */
/* Rendered ONLY for requests the transition contract says are still decidable  */
/* (the parent checks `isFinalStatus`). The server re-checks the same contract, */
/* so a stale page that still shows the buttons cannot replay a decision — it   */
/* gets a typed `invalid_transition` error instead.                             */
/*                                                                              */
/* The result is announced in a `role="status"` region and focus is not stolen, */
/* so a keyboard or screen-reader user is told what happened without losing     */
/* their place.                                                                 */
/* -------------------------------------------------------------------------- */

export function RequestDecisionForm({
  requestId,
  allowReason = false,
}: {
  requestId: string;
  /** Show the optional rejection-reason field (detail view only). */
  allowReason?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function run(action: (form: FormData) => Promise<{ ok: boolean; message?: string }>) {
    return () => {
      setError(null);
      const form = new FormData();
      form.set("requestId", requestId);
      if (allowReason && reason.trim() !== "") form.set("reason", reason.trim());
      startTransition(async () => {
        const result = await action(form);
        if (result.ok) {
          router.refresh();
          return;
        }
        setError(result.message ?? "Amal bajarilmadi.");
      });
    };
  }

  return (
    <div className="flex flex-col gap-2">
      {allowReason ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">
            Rad etish sababi (ixtiyoriy, 300 belgigacha)
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            rows={2}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={run(acceptEnrollmentAction)} disabled={pending}>
          <Check aria-hidden="true" className="me-1 size-4" />
          Qabul qilish
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={run(rejectEnrollmentAction)}
          disabled={pending}
        >
          <X aria-hidden="true" className="me-1 size-4" />
          Rad etish
        </Button>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Saqlanmoqda…</span> : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}
