"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { changePasswordAction, deactivateAccountAction } from "@/server/actions/account";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await changePasswordAction(form);
      if (result.ok) {
        setMessage("Parol yangilandi. Boshqa qurilmalardagi sessiyalar tugatildi.");
        formElement.reset();
        router.refresh();
      } else {
        setError(result.message ?? "Parol o‘zgartirilmadi.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs">
      <div><h2 className="text-xl font-semibold text-ink-900">Parolni o‘zgartirish</h2><p className="mt-1 text-sm text-ink-500">Joriy parol tekshiriladi; muvaffaqiyatli o‘zgartirish barcha boshqa sessiyalarni tugatadi.</p></div>
      <Input label="Joriy parol" name="currentPassword" type="password" autoComplete="current-password" required />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Yangi parol" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /><Input label="Yangi parolni takrorlang" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></div>
      {error ? <p role="alert" className="text-sm font-medium text-danger-ink">{error}</p> : null}
      {message ? <p role="status" className="text-sm font-medium text-success-ink">{message}</p> : null}
      <div><Button type="submit" disabled={pending}>{pending ? "Saqlanmoqda…" : "Parolni yangilash"}</Button></div>
    </form>
  );
}

export function DeactivateAccountForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Hisobni deaktivasiyalashni tasdiqlaysizmi? Biznes ma’lumotlari saqlanadi, lekin kirish to‘xtatiladi.")) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await deactivateAccountAction(form);
      if (!result.ok) setError(result.message ?? "Hisob deaktivasiyalanmadi.");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-danger/25 bg-danger-soft/60 p-5">
      <div><h2 className="text-xl font-semibold text-danger-ink">Hisobni deaktivasiyalash</h2><p className="mt-1 text-sm leading-relaxed text-danger-ink">Bu amal kirishni to‘xtatadi va ommaviy ustoz profilini yashiradi. Yozilish, to‘lov va audit yozuvlari o‘chirilmaydi. Bu amalni ilova ichida qaytarib bo‘lmaydi.</p></div>
      <Input label="Joriy parol" name="password" type="password" autoComplete="current-password" required />
      <Input label="Tasdiqlash uchun DEACTIVATE yozing" name="confirmation" autoComplete="off" required maxLength={10} />
      {error ? <p role="alert" className="text-sm font-medium text-danger-ink">{error}</p> : null}
      <div><Button type="submit" variant="danger" disabled={pending}>{pending ? "Bajarilmoqda…" : "Hisobni deaktivasiyalash"}</Button></div>
    </form>
  );
}
