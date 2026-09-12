"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { cancelEnrollmentRequestAction } from "@/server/actions/enrollment";

/* Cancel is the ONLY status change a student may make. The server re-checks
 * ownership, so passing another student's id here changes nothing. */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const payload = new FormData();
            payload.set("requestId", requestId);
            const result = await cancelEnrollmentRequestAction(payload);
            if (result.ok) router.refresh();
            else setError(result.message);
          });
        }}
      >
        Bekor qilish
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
