"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { AuthNotice } from "./auth-notice";
import { resendVerificationAction } from "@/server/actions/auth";
import { validateEmailField } from "@/lib/email";

export function ResendVerificationForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmailField(email);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      try {
        const result = await resendVerificationAction(formData);
        if (result.ok) {
          setNotice(result.message ?? "Tasdiqlash xati yuborildi.");
        } else {
          setError(result.message);
        }
      } catch {
        setError("Ulanishda xatolik yuz berdi. Qayta urinib ko‘ring.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        type="email"
        label="Email manzilingiz"
        placeholder="nomingiz@misol.uz"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        error={error ?? undefined}
        required
      />

      <Button type="submit" variant="outline" loading={isPending} fullWidth>
        {isPending ? "Yuborilmoqda…" : "Tasdiqlash xatini qayta yuborish"}
      </Button>

      {notice ? (
        <AuthNotice title="Xat yuborildi">
          <p>{notice}</p>
        </AuthNotice>
      ) : null}
    </form>
  );
}
