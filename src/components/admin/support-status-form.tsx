"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, SelectField } from "@/components/ui";
import { transitionSupportTicketAction } from "@/server/actions/support";
import {
  canTransitionSupportTicket,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/lib/support";

export function SupportStatusForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: SupportStatus;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<SupportStatus>(status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextStatus === status) return;
    if (nextStatus === "closed" && !window.confirm("Bu murojaat yopiladi va qayta ochilmaydi. Davom etilsinmi?")) return;
    setMessage(null);
    setError(null);
    const form = new FormData();
    form.set("ticketId", ticketId);
    form.set("status", nextStatus);
    startTransition(async () => {
      const result = await transitionSupportTicketAction(form);
      if (result.ok) {
        setMessage("Holat saqlandi.");
        router.refresh();
        return;
      }
      setError(result.message ?? "Holat saqlanmadi.");
    });
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <SelectField label="Holat" name="status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as SupportStatus)}>
        {SUPPORT_STATUSES.filter((value) => value === status || canTransitionSupportTicket(status, value)).map((value) => <option key={value} value={value}>{SUPPORT_STATUS_LABEL[value]}</option>)}
      </SelectField>
      <Button type="submit" size="sm" variant="outline" disabled={pending || nextStatus === status}>
        {pending ? "Saqlanmoqda…" : "Holatni saqlash"}
      </Button>
      <span role="status" aria-live="polite" className="text-sm text-ink-500">{message ?? error ?? ""}</span>
    </form>
  );
}
