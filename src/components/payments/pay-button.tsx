"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui";
import { startPaymentAction } from "@/server/actions/payment";

/* -------------------------------------------------------------------------- */
/* Pay button — Phase 14. A deliberately small client island.                  */
/*                                                                              */
/* It sends ONE value: which enrollment to pay for. No amount, no price, no    */
/* currency, no return URL — the server derives all of those, so tampering     */
/* with anything in the browser cannot change what is charged.                  */
/*                                                                              */
/* On success the server hands back a provider URL and we navigate to it. The  */
/* user is told plainly that they are leaving for Payme, rather than being     */
/* dropped onto a third-party page with no warning. There is no fake progress  */
/* animation: the only states shown are real ones.                              */
/* -------------------------------------------------------------------------- */

export function PayButton({
  enrollmentRequestId,
  amountLabel,
}: {
  enrollmentRequestId: string;
  /** Pre-formatted on the server, e.g. "150 000 so'm". Display only. */
  amountLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          const form = new FormData();
          form.set("enrollmentRequestId", enrollmentRequestId);
          startTransition(async () => {
            const result = await startPaymentAction(form);
            if (result.ok && result.data) {
              // Full navigation: we are handing the user to the provider.
              window.location.assign(result.data.checkoutUrl);
              return;
            }
            setError(
              result.ok ? "To‘lovni boshlab bo‘lmadi." : result.message,
            );
          });
        }}
      >
        <CreditCard aria-hidden="true" className="me-1 size-4" />
        {pending ? "Yo‘naltirilmoqda…" : `To‘lov qilish — ${amountLabel}`}
      </Button>

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? (
          <span className="text-ink-500">Payme sahifasiga o‘tkazilmoqda…</span>
        ) : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}
