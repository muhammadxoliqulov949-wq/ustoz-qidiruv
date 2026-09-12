"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notification";

/* -------------------------------------------------------------------------- */
/* Mark-as-read controls — Phase 13.                                           */
/*                                                                              */
/* Small client islands around a server action. The notification id travels to  */
/* the server, but it does NOT authorize anything: the update matches on        */
/* (id AND session user id), so submitting somebody else's id changes nothing.  */
/*                                                                              */
/* Both actions are idempotent, so a double click is harmless.                  */
/* -------------------------------------------------------------------------- */

export function MarkOneReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        const form = new FormData();
        form.set("notificationId", notificationId);
        startTransition(async () => {
          await markNotificationReadAction(form);
          router.refresh();
        });
      }}
    >
      O‘qilgan deb belgilash
    </Button>
  );
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => {
          startTransition(async () => {
            await markAllNotificationsReadAction();
            setDone(true);
            router.refresh();
          });
        }}
      >
        Hammasini o‘qilgan deb belgilash
      </Button>
      <span role="status" aria-live="polite" className="text-sm text-ink-500">
        {pending ? "Saqlanmoqda…" : done ? "Belgilandi." : ""}
      </span>
    </div>
  );
}
