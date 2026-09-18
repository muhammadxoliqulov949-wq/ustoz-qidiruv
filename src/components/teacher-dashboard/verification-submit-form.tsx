"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";
import { submitTeacherVerificationAction } from "@/server/actions/teacher-verification";
import {
  verificationSubmitEnabled,
  VERIFICATION_SUBMIT_NOTE,
} from "@/lib/teacher-verification";
import { MEDIA_DOCUMENTS_REQUIRED_NOTE } from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* "Send for verification" — Phase 15.                                         */
/*                                                                              */
/* The action takes NO parameters and its schema is an empty `.strict()` object, */
/* so this island cannot name a subject, a role or a status: the applicant is    */
/* always the signed-in account, and the only outcome is a PENDING application.  */
/* Nothing here can verify anybody — that word exists only in the admin path.    */
/* -------------------------------------------------------------------------- */

export function VerificationSubmitForm({
  eligible,
  missingCount,
  documentsReady,
}: {
  eligible: boolean;
  missingCount: number;
  /**
   * PHASE 18. The server is the authority for this too: the action refuses a
   * submission without the required evidence, and this flag only makes the
   * refusal visible BEFORE the click instead of after it.
   */
  documentsReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /*
   * One expression, exported from lib/teacher-verification so the regression
   * suite evaluates the same rule the button does: a complete profile AND the
   * required evidence AND nothing already in flight. It is a preview of the
   * server's answer — the submission action re-checks all three inside its
   * transaction — so this can only ever hide a refusal, never grant one.
   */
  const enabled = verificationSubmitEnabled({ eligible, documentsReady, pending });

  function submit() {
    setError(null);
    setDone(null);
    // Empty on purpose: any field posted would be an over-post, and the schema
    // refuses the whole request because of it.
    const form = new FormData();
    startTransition(async () => {
      const result = await submitTeacherVerificationAction(form);
      if (result.ok) {
        setDone("Ariza yuborildi. Administrator ko‘rib chiqadi.");
        router.refresh();
        return;
      }
      setError(result.message ?? "Ariza yuborilmadi.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-base leading-relaxed text-ink-700">{VERIFICATION_SUBMIT_NOTE}</p>

      {eligible && !documentsReady ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Hozir yuborib bo‘lmaydi. </span>
          {MEDIA_DOCUMENTS_REQUIRED_NOTE}
        </p>
      ) : null}

      {!eligible ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Hozir yuborib bo‘lmaydi. </span>
          Profilda {missingCount} ta majburiy maydon to‘ldirilmagan. Quyidagi
          ro‘yxatni to‘ldirib, arizani yuboring.
        </p>
      ) : null}

      <div>
        <Button type="button" onClick={submit} disabled={!enabled}>
          <Send aria-hidden="true" className="size-4" />
          Tasdiqlash uchun yuborish
        </Button>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {pending ? <span className="text-ink-500">Yuborilmoqda…</span> : null}
        {done ? <span className="font-medium text-ink-900">{done}</span> : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}
