"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, SelectField, TextareaField } from "@/components/ui";
import { createSupportTicketAction } from "@/server/actions/support";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_RELATED_TYPES,
  SUPPORT_SUBMISSION_NOTE,
} from "@/lib/support";

export function SupportTicketForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await createSupportTicketAction(form);
      if (result.ok) {
        setDone("Murojaat navbatga qo‘shildi. Holatini shu sahifada kuzatishingiz mumkin.");
        formElement.reset();
        router.refresh();
        return;
      }
      setError(result.message ?? "Murojaat yuborilmadi.");
    });
  }

  return (
    <form className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs" onSubmit={submit}>
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Yangi murojaat</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{SUPPORT_SUBMISSION_NOTE}</p>
      </div>
      <SelectField label="Mavzu" name="category" defaultValue="technical" required>
        {SUPPORT_CATEGORIES.map((category) => (
          <option key={category} value={category}>{SUPPORT_CATEGORY_LABEL[category]}</option>
        ))}
      </SelectField>
      <TextareaField
        label="Muammo tafsiloti"
        name="message"
        rows={6}
        minLength={10}
        maxLength={4000}
        required
        hint="Shaxsiy parol, karta ma’lumoti yoki boshqa maxfiy ma’lumotni yozmang."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Bog‘liq yozuv turi (ixtiyoriy)" name="relatedEntityType" defaultValue="">
          <option value="">Bog‘lanmagan</option>
          {SUPPORT_RELATED_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </SelectField>
        <Input
          label="Bog‘liq yozuv IDsi (ixtiyoriy)"
          name="relatedEntityId"
          maxLength={64}
          hint="Masalan, kurs yoki to‘lov identifikatori."
        />
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger-ink">{error}</p> : null}
      {done ? <p role="status" className="text-sm font-medium text-success-ink">{done}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Yuborilmoqda…" : "Murojaat yuborish"}</Button>
      </div>
    </form>
  );
}
