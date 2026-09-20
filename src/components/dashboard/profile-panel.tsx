"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, MapPin, Wifi } from "lucide-react";
import {
  Button,
  Card,
  Input,
  RadioCardGroup,
  SelectField,
} from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { PhoneField } from "@/components/auth/phone-input";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";
import { studentProfileFields } from "./use-student-state";
import { profileCompleteness } from "@/lib/dashboard";
import {
  languageLabel,
  onboardingCategories,
  onboardingCities,
  onboardingCityLabel,
  onboardingLanguages,
  studentStepErrors,
  type StudentAnswers,
} from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* Profile panel — the student profile IS the Phase 6 onboarding student        */
/* answers. This screen is an editor over that exact schema:                     */
/*   • same StudentAnswers shape, same option taxonomies (derived from the       */
/*     catalog), same validators (studentStepErrors) — no parallel form model;   */
/*   • writes through the SAME OnboardingProvider/draft store, so onboarding     */
/*     and the dashboard can never disagree and the storage format is unchanged; */
/*   • saving here is UI state only; the notice says so.                         */
/* -------------------------------------------------------------------------- */

export function ProfilePanel() {
  const { ready, draft, update } = useOnboardingDraft();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StudentAnswers | null>(null);
  const [touched, setTouched] = useState(false);

  if (!ready) {
    return (
      <Card className="flex min-h-[24rem] flex-col gap-2">
        <h2 className="text-xl font-semibold text-ink-900">
          O‘quvchi ma’lumotlari
        </h2>
        <p className="text-base text-ink-500" role="status">
          Brauzer holati o‘qilmoqda…
        </p>
      </Card>
    );
  }

  const answers = draft.student;
  const fields = studentProfileFields(answers);
  const completeness = profileCompleteness(fields);

  /* --------------------------------- read --------------------------------- */

  if (!editing || form === null) {
    return (
      <div className="flex flex-col gap-6">
        <AuthNotice title="Bu profil hisob emas">
          Ma’lumotlar Phase 6 onboarding qoralamasidan o‘qiladi va shu
          brauzerda saqlanadi. Server, parol va hisob tasdig‘i keyingi
          bosqichlarda ulanadi.
        </AuthNotice>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">
                O‘quvchi ma’lumotlari
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {completeness.total} ta maydondan {completeness.filled} tasi
                to‘ldirilgan
                {completeness.complete
                  ? "."
                  : ` — to‘ldirilmagan: ${completeness.missing.join(", ")}.`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setForm({ ...answers });
                setTouched(false);
                setEditing(true);
              }}
            >
              Tahrirlash
            </Button>
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col">
                <dt className="text-sm text-ink-500">{field.label}</dt>
                <dd
                  className={
                    field.value === null
                      ? "text-base text-ink-500"
                      : "text-base text-ink-900"
                  }
                >
                  {field.value ?? "To‘ldirilmagan"}
                </dd>
              </div>
            ))}
          </dl>

          <p className="border-t border-line pt-4 text-sm text-ink-500">
            To‘liq onboarding oqimini qayta ko‘rmoqchimisiz?{" "}
            <Link
              href="/onboarding?role=student"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Onboardingni ochish
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  /* --------------------------------- edit --------------------------------- */

  // Same validators as the onboarding steps — one contract, two surfaces.
  const errors = touched
    ? {
        ...studentStepErrors(form, "identity"),
        ...studentStepErrors(form, "place"),
      }
    : {};
  const patch = (next: Partial<StudentAnswers>) =>
    setForm((current) => (current ? { ...current, ...next } : current));

  const submit = () => {
    setTouched(true);
    const blocking = {
      ...studentStepErrors(form, "identity"),
      ...studentStepErrors(form, "place"),
    };
    if (Object.keys(blocking).length > 0) return;
    update((current) => ({ ...current, role: "student", student: form }));
    setEditing(false);
  };

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink-900">
        Profilni tahrirlash
      </h2>

      <Input
        label="To‘liq ism"
        placeholder="Masalan: Aziza Karimova"
        autoComplete="name"
        value={form.name}
        error={errors.name}
        onChange={(event) => patch({ name: event.target.value })}
      />

      <PhoneField
        value={form.phone}
        error={errors.phone}
        onChange={(phone) => patch({ phone })}
      />

      <SelectField
        label="Shahringiz"
        hint="Offline kurslar shu shahar bo‘yicha saralanadi — faqat onlayn o‘qisangiz bo‘sh qoldiring."
        value={form.city ?? ""}
        onChange={(event) =>
          patch({ city: event.target.value === "" ? null : event.target.value })
        }
      >
        <option value="">Tanlanmagan — faqat onlayn</option>
        {onboardingCities.map((slug) => (
          <option key={slug} value={slug}>
            {onboardingCityLabel(slug)}
          </option>
        ))}
      </SelectField>

      <RadioCardGroup
        legend="Qanday formatda o‘qiysiz?"
        value={form.format}
        onChange={(value) => patch({ format: value as StudentAnswers["format"] })}
        error={errors.format}
        columns={3}
        options={[
          { value: "online", label: "Online", description: "Masofadan, istalgan joydan.", icon: Wifi },
          { value: "offline", label: "Offline", description: "Shahringizda, yuzma-yuz.", icon: MapPin },
          { value: "both", label: "Ikkalasi", description: "Qulay bo‘lgan joyda.", icon: Layers },
        ]}
      />

      <ChipGroup
        legend="Qiziqtirgan yo‘nalishlar"
        hint="Kurs va ustoz qidiruvingiz shu tanlovga moslashadi."
        values={form.interests}
        onToggle={(value, next) =>
          patch({
            interests: next
              ? [...form.interests, value]
              : form.interests.filter((slug) => slug !== value),
          })
        }
        options={onboardingCategories.map((category) => ({
          value: category.slug,
          label: category.name,
        }))}
      />

      <ChipGroup
        legend="O‘qish tili"
        values={form.languages}
        onToggle={(value, next) =>
          patch({
            languages: next
              ? [...form.languages, value]
              : form.languages.filter((tag) => tag !== value),
          })
        }
        options={onboardingLanguages.map((tag) => ({
          value: tag,
          label: languageLabel(tag),
        }))}
      />

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={submit}>Saqlash</Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Bekor qilish
        </Button>
      </div>
      <p className="text-sm text-ink-500">
        Saqlash faqat shu brauzerdagi qoralama holatini yangilaydi — serverga
        hech narsa yuborilmaydi.
      </p>
    </Card>
  );
}
