"use client";

import { ClipboardCheck, Pencil, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  enrollmentSummary,
  type EnrollCourseLite,
  type EnrollDraft,
  type EnrollGroupLite,
} from "@/lib/enroll";

/* -------------------------------------------------------------------------- */
/* EnrollResult — the HONEST prototype submission state (Phase 7 §4). It says   */
/* exactly what happened: request prepared, NOT sent, no enrollment occurred.  */
/* Wording constraints: never "So‘rov yuborildi", never "Kursga yozildingiz",    */
/* never "Ustoz qabul qildi". The snapshot below is the same pure projection    */
/* used by review, so nothing can contradict the submitted-looking state.       */
/* -------------------------------------------------------------------------- */

export interface EnrollResultProps {
  course: EnrollCourseLite;
  group: EnrollGroupLite | null;
  draft: EnrollDraft;
  onEditAgain: () => void;
  onClear: () => void;
}

export function EnrollResult({ course, group, draft, onEditAgain, onClear }: EnrollResultProps) {
  const { courseRows, scheduleRows, studentRows, priceRows } = enrollmentSummary(
    course,
    group,
    draft,
  );
  const sections = [
    { title: "Kurs", rows: courseRows },
    { title: "Guruh va vaqt", rows: scheduleRows },
    { title: "O‘quvchi", rows: studentRows },
    { title: "Narx", rows: priceRows },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-accent-50 text-accent-600 [&>svg]:size-6"
        >
          <ClipboardCheck />
        </span>
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-ink-900">
            So‘rov tayyor.
          </h3>
          <p className="mt-1 text-sm text-ink-700">
            Backend hali ulanmaganligi sababli so‘rov ustozga yuborilmadi.
          </p>
        </div>
      </div>

      <AuthNotice live title="Hech narsa serverga jo‘natilmadi">
        <span className="block">
          Backend ulangach, bu yerda so‘rov ustozga yuboriladi va holatini
          profilingizdan kuzatishingiz mumkin bo‘ladi.
        </span>
        <span className="mt-2 block text-ink-500">
          Hozircha so‘rov matni faqat shu brauzerdagi vaqtinchalik prototip
          holatida (ustozlik yozuvi emas).
        </span>
      </AuthNotice>

      <div className="grid gap-3 rounded-xl border border-line bg-surface-muted p-4 text-sm sm:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">
              {section.title}
            </p>
            <dl className="mt-1.5 flex flex-col gap-1">
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-ink-500">{row.label}</dt>
                  <dd className="text-end font-medium break-words text-ink-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <ButtonLink href={`/courses/${course.slug}`} size="lg" fullWidth>
          Kursga qaytish
        </ButtonLink>
        <ButtonLink href="/courses" size="lg" variant="outline" fullWidth>
          Boshqa kurslarni ko‘rish
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={onEditAgain}>
          Ma’lumotlarni tahrirlash
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Trash2 />}
          onClick={onClear}
          className="text-ink-500 hover:text-ink-900"
        >
          Prototip holatini tozalash
        </Button>
      </div>
    </div>
  );
}
