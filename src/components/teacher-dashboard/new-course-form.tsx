"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { createCourseDraftAction } from "@/server/actions/course";

/* -------------------------------------------------------------------------- */
/* New SERVER course draft — Phase 12.                                         */
/*                                                                              */
/* The draft is created by a server action under the SIGNED-IN teacher; the     */
/* form posts no teacher id and no status. On success we navigate to the        */
/* draft's stable edit route, so a refresh resumes the same row instead of      */
/* creating another one.                                                        */
/* -------------------------------------------------------------------------- */

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink-900 outline-none focus:border-accent-600";

export function NewCourseForm({
  categories,
  cities,
}: {
  categories: { id: string; name: string }[];
  cities: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createCourseDraftAction(form);
      if (result.ok) {
        if (result.data) {
          router.push(`/teacher/dashboard/courses/${result.data.courseId}/edit`);
        }
        return;
      }
      setError(result.message ?? "Saqlanmadi.");
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {error ? (
          <p role="alert" className="text-base font-medium text-danger-ink">
            {error}
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">Kurs nomi</span>
          <input name="title" className={field} required minLength={8} />
          {fieldErrors.title ? (
            <span className="text-sm text-danger-ink">{fieldErrors.title}</span>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Yo‘nalish</span>
            <select name="categoryId" className={field}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Daraja</span>
            <select name="level" className={field} defaultValue="orta">
              <option value="boshlangich">Boshlang‘ich</option>
              <option value="orta">O‘rta</option>
              <option value="yuqori">Yuqori</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Format</span>
            <select name="format" className={field} defaultValue="online">
              <option value="online">Onlayn</option>
              <option value="offline">Oflayn</option>
              <option value="hybrid">Aralash</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Shahar</span>
            <select name="city" className={field} defaultValue="">
              <option value="">— (onlayn)</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {fieldErrors.city ? (
              <span className="text-sm text-danger-ink">{fieldErrors.city}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Manzil</span>
            <input name="location" className={field} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700">Narx (so‘m / oyiga)</span>
            <input name="priceUzs" type="number" min={0} defaultValue={0} className={field} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-700">
            Qisqa tavsif (kamida 40 belgi)
          </span>
          <textarea name="summary" rows={3} className={field} required />
          {fieldErrors.summary ? (
            <span className="text-sm text-danger-ink">{fieldErrors.summary}</span>
          ) : null}
        </label>

        <div>
          <Button type="submit" disabled={pending}>
            Qoralama yaratish
          </Button>
        </div>
      </form>
    </Card>
  );
}
