"use client";

import { useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui";
import { openConversationAction } from "@/server/actions/messaging";

/* -------------------------------------------------------------------------- */
/* "Write to the teacher / student" — Phase 16.                                 */
/*                                                                              */
/* The ONLY entry point into messaging. It posts an ENROLLMENT id — never a      */
/* user id — and the server derives both participants from that enrollment. So   */
/* there is no "message this person" endpoint to abuse, and no conversation can  */
/* be created outside an accepted place.                                         */
/*                                                                              */
/* The action redirects to the thread on success; the error path is announced    */
/* in a live region rather than thrown away.                                     */
/* -------------------------------------------------------------------------- */

export function OpenConversationButton({
  enrollmentRequestId,
  label,
}: {
  enrollmentRequestId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    const form = new FormData();
    form.set("enrollmentRequestId", enrollmentRequestId);
    startTransition(async () => {
      // On success this action redirects, so nothing after it runs.
      const result = await openConversationAction(form);
      if (!result.ok) setError(result.message ?? "Suhbatni ochib bo‘lmadi.");
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={open} disabled={pending}>
        <MessageSquare aria-hidden="true" className="size-4" />
        {pending ? "Ochilmoqda…" : label}
      </Button>
      <span role="status" aria-live="polite" className="text-sm">
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </span>
    </span>
  );
}
