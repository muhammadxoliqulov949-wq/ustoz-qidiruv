"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";
import { submitTeacherVerificationAction } from "@/server/actions/teacher-verification";
import { VERIFICATION_SUBMIT_NOTE } from "@/lib/teacher-verification";

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
}: {
  eligible: boolean;
  missingCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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

      {!eligible ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Hozir yuborib bo‘lmaydi. </span>
          Profilda {missingCount} ta majburiy maydon to‘ldirilmagan. Quyidagi
          ro‘yxatni to‘ldirib, arizani yuboring.
        </p>
      ) : null}

      <div>
        <Button type="button" onClick={submit} disabled={pending || !eligible}>
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
