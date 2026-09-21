"use client";

import { Layers, MapPin, Wifi } from "lucide-react";
import { Input, RadioCardGroup, SelectField } from "@/components/ui";
import { PhoneField } from "@/components/auth/phone-input";
import { ChipGroup } from "./chip-group";
import type { FieldErrors, StudentAnswers } from "@/lib/onboarding";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
  onboardingCities,
  onboardingLanguages,
} from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* Student onboarding steps — three light screens (Phase 6: “avoid long        */
/* forms, personalize future course discovery”). Every option list is          */
/* derived from the real catalog (cities, languages, categories); there is     */
/* deliberately NO fake "recommended for you" result anywhere in this flow.    */
/* Teacher-only fields never appear here (role-integrity rule).                */
/* -------------------------------------------------------------------------- */

export interface StudentStepProps {
  stepId: string;
  answers: StudentAnswers;
  errors: FieldErrors;
  onChange: (patch: Partial<StudentAnswers>) => void;
}

export function StudentStep({ stepId, answers, errors, onChange }: StudentStepProps) {
  if (stepId === "identity") {
    return (
      <div className="flex flex-col gap-4">
        <Input
          label="To‘liq ism"
          placeholder="Masalan: Aziza Karimova"
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
        <p className="text-sm text-ink-500">
          Telefon raqami — kelajakda hisobingizga ulanadigan yagona identifikator;
          hozircha faqat shu brauzerdagi onboarding holatida saqlanadi.
        </p>
      </div>
    );
  }

  if (stepId === "place") {
    return (
      <div className="flex flex-col gap-4">
        <SelectField
          label="Shahringiz"
          hint="Offline kurslarni shu shahar bo‘yicha saralaymiz — onlayn o‘qisangiz bo‘sh qoldiring."
          value={answers.city ?? ""}
          onChange={(event) =>
            onChange({ city: event.target.value === "" ? null : event.target.value })
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
          legend="Qanday formatda o‘qimoqchisiz?"
          value={answers.format}
          onChange={(value) => onChange({ format: value as StudentAnswers["format"] })}
          error={errors.format}
          columns={3}
          options={[
            { value: "online", label: "Online", description: "Masofadan, istalgan joydan.", icon: Wifi },
            { value: "offline", label: "Offline", description: "Shahringizda, yuzma-yuz.", icon: MapPin },
            { value: "both", label: "Ikkalasi", description: "Qulay bo‘lgan joyda.", icon: Layers },
          ]}
        />
      </div>
    );
  }

  // interests
  return (
    <div className="flex flex-col gap-5">
      <ChipGroup
        legend="Qaysi yo‘nalishlar qiziqtiradi?"
        hint="Kurs va ustoz qidiruvingiz ushbu tanlovga moslashadi."
        values={answers.interests}
        onToggle={(value, next) =>
          onChange({
            interests: next
              ? [...answers.interests, value]
              : answers.interests.filter((slug) => slug !== value),
          })
        }
        error={errors.interests}
        options={onboardingCategories.map((category) => ({
          value: category.slug,
          label: category.name,
        }))}
      />
      <ChipGroup
        legend="O‘qish tili"
        hint="Kamida bittani belgilang."
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
      <p className="text-sm text-ink-500">
        Bu tanlov hozircha faqat onboarding holatida saqlanadi — tavsiya
        tizimi backend ulanganda shu ma’lumotni ishlatadi. Hozircha hech
        qanday “sizga tavsiya” ro‘yxati ko‘rsatilmaydi.
      </p>
    </div>
  );
}
