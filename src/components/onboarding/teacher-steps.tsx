"use client";

import { Check, FileCheck2, ShieldQuestion } from "lucide-react";
import { Input, SelectField, TextareaField } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PhoneField } from "@/components/auth/phone-input";
import { ChipGroup } from "./chip-group";
import { AuthNotice } from "@/components/auth/auth-notice";
import type { FieldErrors, TeacherAnswers } from "@/lib/onboarding";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
  onboardingCities,
  onboardingLanguages,
  TEACHER_TEXT_LIMITS,
} from "@/lib/onboarding";
import { courseLevelLabels } from "@/data/courses";

/* -------------------------------------------------------------------------- */
/* Teacher onboarding steps — the structured counterpart to the student flow.   */
/* Five screens group the sections (identity / expertise+experience /           */
/* formats+languages / bio+approach / verification notice) without becoming    */
/* a giant form. Course data is NOT collected here (it lives in the teacher     */
/* panel's “Kurslarim” section), and identity verification is only explained —  */
/* the flow never shows a fake "Verified". Options reuse the static product     */
/* taxonomies: categories, level labels, city slugs and language tags.          */
/* -------------------------------------------------------------------------- */

export interface TeacherStepProps {
  stepId: string;
  answers: TeacherAnswers;
  errors: FieldErrors;
  onChange: (patch: Partial<TeacherAnswers>) => void;
}

export function TeacherStep({ stepId, answers, errors, onChange }: TeacherStepProps) {
  if (stepId === "identity") {
    return (
      <div className="flex flex-col gap-4">
        <Input
          label="To‘liq ism va familiya"
          placeholder="Masalan: Dilshod Rahimov"
          autoComplete="name"
          value={answers.name}
          error={errors.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <PhoneField
          value={answers.phone}
          error={errors.phone}
          onChange={(phone) => onChange({ phone })}
        />
        <SelectField
          label="Shahar"
          hint="Profil kartochkasida va /teachers filtrida shu ko‘rinadi."
          value={answers.city ?? ""}
          error={errors.city}
          onChange={(event) =>
            onChange({ city: event.target.value === "" ? null : event.target.value })
          }
        >
          <option value="">Shaharni tanlang…</option>
          {onboardingCities.map((slug) => (
            <option key={slug} value={slug}>
              {onboardingCityLabel(slug)}
            </option>
          ))}
        </SelectField>
        <Input
          label="Tuman yoki mavze (ixtiyoriy)"
          placeholder="Masalan: Chilonzor"
          value={answers.district}
          onChange={(event) => onChange({ district: event.target.value })}
          hint="Offline darslar uchun manzil ko‘rinishi — keyinroq ham to‘ldirsa bo‘ladi."
        />
      </div>
    );
  }

  if (stepId === "expertise") {
    return (
      <div className="flex flex-col gap-5">
        <ChipGroup
          legend="Qaysi yo‘nalishlarda o‘qitasiz?"
          hint={
            answers.categories.length >= 3
              ? "Maksimal 3 ta yo‘nalish tanlangan — bittasini olib tashlasiz, boshqasini qo‘shasiz."
              : "1–3 ta yo‘nalish. Profil yo‘nalish bo‘yicha qidiruvda shu ro‘yxatdan topiladi."
          }
          values={answers.categories}
          maxSelected={3}
          onToggle={(value, next) =>
            onChange({
              categories: next
                ? [...answers.categories, value]
                : answers.categories.filter((slug) => slug !== value),
            })
          }
          error={errors.categories}
          options={onboardingCategories.map((category) => ({
            value: category.slug,
            label: category.name,
          }))}
        />
        <ChipGroup
          legend="Qaysi darajadagi o‘quvchilarni qabul qilasiz?"
          values={answers.levels}
          onToggle={(value, next) =>
            onChange({
              levels: next
                ? [...answers.levels, value as TeacherAnswers["levels"][number]]
                : answers.levels.filter((level) => level !== value),
            })
          }
          error={errors.levels}
          options={(Object.keys(courseLevelLabels) as (keyof typeof courseLevelLabels)[]).map(
            (level) => ({ value: level, label: courseLevelLabels[level] }),
          )}
        />
        <Input
          label="Nechinchi yildansiz (to‘liq yil)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Masalan: 5"
          value={answers.experienceYears === null ? "" : String(answers.experienceYears)}
          error={errors.experienceYears}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D+/g, "").slice(0, 2);
            onChange({ experienceYears: digits === "" ? null : Number(digits) });
          }}
          hint="0–45 oralig‘ida. /teachers sahifasidagi “Tajriba” filtri shu qiymatdan foydalanadi."
        />
      </div>
    );
  }

  if (stepId === "format") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <ChipGroup
            legend="Dars formati — kamida bittani tanlang"
            values={answers.formats}
            onToggle={(value, next) =>
              onChange({
                formats: next
                  ? [...answers.formats, value as TeacherAnswers["formats"][number]]
                  : answers.formats.filter((format) => format !== value),
              })
            }
            error={errors.formats}
            options={[
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
            ]}
          />
        </div>
        <div>
          <ChipGroup
            legend="O‘qish tillari — kamida bittani tanlang"
            values={answers.languages}
            onToggle={(value, next) =>
              onChange({
                languages: next
                  ? [...answers.languages, value]
                  : answers.languages.filter((tag) => tag !== value),
              })
            }
            error={errors.languages}
            options={onboardingLanguages.map((tag) => ({ value: tag, label: languageLabel(tag) }))}
          />
        </div>
        <p className="text-sm text-ink-500">
          Gibrid (onlayn + sinf) formati kurs yaratilganda belgilanadi —
          shuning uchun bu yerda so‘ralmaydi.
        </p>
      </div>
    );
  }

  if (stepId === "bio") {
    const { BIO_MIN, BIO_MAX, APPROACH_MIN, APPROACH_MAX } = TEACHER_TEXT_LIMITS;
    return (
      <div className="flex flex-col gap-5">
        <TextareaField
          label="O‘zingiz haqingizda"
          rows={5}
          value={answers.bio}
          error={errors.bio}
          counter={{ value: answers.bio.trim().length, max: BIO_MAX }}
          hint={`Nima o‘qitishingiz va tajribangiz haqida qisqa tanishuv — kamida ${BIO_MIN} belgi. O‘quvchilar buni kurs va ustoz kartochkalarida ko‘radi.`}
          onChange={(event) => onChange({ bio: event.target.value })}
        />
        <TextareaField
          label="Darslaringiz qanday o‘tadi?"
          rows={4}
          value={answers.approach}
          error={errors.approach}
          counter={{ value: answers.approach.trim().length, max: APPROACH_MAX }}
          hint={`O‘qitish yondashuvingiz — kamida ${APPROACH_MIN} belgi. Profildagi “O‘qitish uslubi” bo‘limiga yoziladi.`}
          onChange={(event) => onChange({ approach: event.target.value })}
        />
        <p className="text-sm text-ink-500">
          Kurs dasturi, narx va guruhlar bu yerda so‘ralmaydi — kurs yaratish
          ustoz panelidagi “Kurslarim” bo‘limida bajariladi.
        </p>
      </div>
    );
  }

  // verify
  return (
    <div className="flex flex-col gap-4">
      <AuthNotice variant="warning" title="Tekshiruv alohida jarayon">
        Profilni saqlash sizni tasdiqlangan ustozga aylantirmaydi.
        Tasdiqlash arizasini saqlaganingizdan so‘ng ustoz panelidagi “Profil
        tasdig‘i” bo‘limidan yuborasiz — uni administrator ko‘rib chiqadi.
      </AuthNotice>

      <ul className="flex flex-col gap-2 text-sm text-ink-700">
        <li className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-muted px-3.5 py-3">
          <ShieldQuestion aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-400" />
          <span>
            <span className="font-medium text-ink-900">Telefon raqami</span> —
            hisobingizdagi raqam ishlatiladi. SMS orqali tasdiqlash joriy
            qilinmagan.
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-muted px-3.5 py-3">
          <FileCheck2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-400" />
          <span>
            <span className="font-medium text-ink-900">Hujjat va malaka</span> —
            tasdiqlash arizasi bilan birga ustoz panelida yuklanadi va
            administrator tomonidan ko‘rib chiqiladi.
          </span>
        </li>
      </ul>

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface p-4 shadow-xs",
          "transition-colors duration-fast hover:border-ink-300",
          "[&:has(input:focus-visible)]:ring-[length:var(--size-focus-ring)] [&:has(input:focus-visible)]:ring-accent-600/35 [&:has(input:focus-visible)]:ring-offset-2 [&:has(input:focus-visible)]:ring-offset-canvas",
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={answers.declaration}
          aria-invalid={errors.declaration ? true : undefined}
          onChange={(event) => onChange({ declaration: event.target.checked })}
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
            "transition-[background-color,border-color] duration-fast",
            answers.declaration
              ? "border-accent-600 bg-accent-600 text-white"
              : "border-line-strong bg-surface text-transparent",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <span className="text-sm leading-snug text-ink-700">
          Ko‘rsatgan ma’lumotlarim rost ekanini tasdiqlayman. Bu belgilash hozircha
          faqat onboarding UI qadami — u hisobni yoki tekshiruvni
          tasdiqlamaydi.
          {errors.declaration ? (
            <span className="mt-1 block font-medium text-danger">{errors.declaration}</span>
          ) : null}
        </span>
      </label>
    </div>
  );
}
