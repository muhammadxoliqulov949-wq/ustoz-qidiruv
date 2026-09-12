"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, SelectField, TextareaField } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { PhoneField } from "@/components/auth/phone-input";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";
import { WorkspaceGate } from "./workspace-gate";
import type { TeacherDirectory } from "@/lib/teacher-workspace";
import {
  languageLabel,
  onboardingCategories,
  onboardingCities,
  onboardingCityLabel,
  onboardingLanguages,
  teacherStepErrors,
  TEACHER_TEXT_LIMITS,
  type TeacherAnswers,
} from "@/lib/onboarding";
import { courseLevelLabels } from "@/data/courses";
import type { CourseLevel } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* Teacher profile — two clearly separated layers, never blended silently:      */
/*                                                                              */
/*  • CATALOG (canonical, read-only here): what /teachers/[slug] publishes.      */
/*    The dashboard must not mutate seed data from localStorage, so these rows  */
/*    are displayed with a "katalog" source tag and no edit control.             */
/*  • DRAFT (Phase 6 teacher onboarding): the editable prototype layer. It uses  */
/*    the SAME TeacherAnswers schema, the SAME taxonomies and the SAME           */
/*    teacherStepErrors validators as /onboarding, and writes through the SAME   */
/*    draft store — no second teacher-profile model exists.                      */
/*                                                                              */
/* The seam is the point: when a backend arrives, the draft layer becomes the    */
/* teacher's pending profile edit and the catalog layer becomes their published  */
/* record. The public profile page is untouched by this phase.                   */
/* -------------------------------------------------------------------------- */

const LEVELS: CourseLevel[] = ["boshlangich", "orta", "yuqori"];

export function TeacherProfilePanel({ directory }: { directory: TeacherDirectory }) {
  return (
    <WorkspaceGate directory={directory} heading="Profil" minHeight="min-h-[38rem]">
      {(workspace, state) => (
        <ProfileBody
          workspaceName={workspace.name}
          workspaceSlug={workspace.slug}
          verified={workspace.verified}
          fields={state.profileFields}
          filled={state.completeness.filled}
          total={state.completeness.total}
          missing={state.completeness.missing}
        />
      )}
    </WorkspaceGate>
  );
}

function ProfileBody({
  workspaceName,
  workspaceSlug,
  verified,
  fields,
  filled,
  total,
  missing,
}: {
  workspaceName: string;
  workspaceSlug: string;
  verified: boolean;
  fields: { label: string; value: string | null; source: "catalog" | "draft" }[];
  filled: number;
  total: number;
  missing: string[];
}) {
  const { draft, update } = useOnboardingDraft();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TeacherAnswers | null>(null);
  const [touched, setTouched] = useState(false);

  const answers = draft.teacher;

  if (!editing || form === null) {
    return (
      <div className="flex flex-col gap-6">
        <AuthNotice title="Ommaviy profil va qoralama alohida">
          Katalogdagi ma’lumot{" "}
          <Link
            href={`/teachers/${workspaceSlug}`}
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            ommaviy profilda
          </Link>{" "}
          ko‘rinadi va bu paneldan o‘zgartirilmaydi. Tahrirlash Phase 6 ustoz
          onboarding qoralamasiga yoziladi — u faqat shu brauzerda saqlanadi va
          serverga yuborilmaydi.
        </AuthNotice>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink-900">{workspaceName}</h2>
              <p className="mt-1 text-sm text-ink-500">
                {total} ta maydondan {filled} tasi to‘ldirilgan
                {missing.length === 0 ? "." : ` — bo‘sh: ${missing.join(", ")}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={verified ? "accent" : "neutral"} size="md">
                {verified ? "Tasdiqlangan ustoz" : "Tekshiruv kutilmoqda"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({ ...answers });
                  setTouched(false);
                  setEditing(true);
                }}
              >
                Qoralamani tahrirlash
              </Button>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col">
                <dt className="flex items-center gap-2 text-sm text-ink-500">
                  {field.label}
                  <span className="text-xs text-ink-400">
                    {field.source === "catalog" ? "katalog" : "qoralama"}
                  </span>
                </dt>
                <dd
                  className={
                    field.value === null
                      ? "text-base text-ink-400"
                      : "text-base text-ink-900"
                  }
                >
                  {field.value ?? "To‘ldirilmagan"}
                </dd>
              </div>
            ))}
          </dl>

          <p className="border-t border-line pt-4 text-sm text-ink-500">
            To‘liq onboarding oqimini ko‘rmoqchimisiz?{" "}
            <Link
              href="/onboarding?role=teacher"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Ustoz onboardingini ochish
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  /* --------------------------------- edit --------------------------------- */

  const errors = touched
    ? {
        ...teacherStepErrors(form, "identity"),
        ...teacherStepErrors(form, "expertise"),
        ...teacherStepErrors(form, "format"),
        ...teacherStepErrors(form, "bio"),
      }
    : {};

  const patch = (next: Partial<TeacherAnswers>) =>
    setForm((current) => (current ? { ...current, ...next } : current));

  const submit = () => {
    setTouched(true);
    const blocking = {
      ...teacherStepErrors(form, "identity"),
      ...teacherStepErrors(form, "expertise"),
      ...teacherStepErrors(form, "format"),
      ...teacherStepErrors(form, "bio"),
    };
    if (Object.keys(blocking).length > 0) return;
    update((current) => ({ ...current, role: "teacher", teacher: form }));
    setEditing(false);
  };

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink-900">Qoralamani tahrirlash</h2>

      <Input
        label="To‘liq ism va familiya"
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
        label="Shahar"
        error={errors.city}
        value={form.city ?? ""}
        onChange={(event) =>
          patch({ city: event.target.value === "" ? null : event.target.value })
        }
      >
        <option value="">Tanlanmagan</option>
        {onboardingCities.map((slug) => (
          <option key={slug} value={slug}>
            {onboardingCityLabel(slug)}
          </option>
        ))}
      </SelectField>

      <Input
        label="Tuman yoki mo‘ljal"
        hint="Ixtiyoriy — profil ko‘rinishida qo‘shimcha manzil sifatida chiqadi."
        value={form.district}
        onChange={(event) => patch({ district: event.target.value })}
      />

      <ChipGroup
        legend="Yo‘nalishlar"
        hint="Eng ko‘pi bilan 3 ta."
        maxSelected={3}
        values={form.categories}
        error={errors.categories}
        onToggle={(value, next) =>
          patch({
            categories: next
              ? [...form.categories, value]
              : form.categories.filter((slug) => slug !== value),
          })
        }
        options={onboardingCategories.map((category) => ({
          value: category.slug,
          label: category.name,
        }))}
      />

      <ChipGroup
        legend="O‘quvchi darajalari"
        values={form.levels}
        error={errors.levels}
        onToggle={(value, next) =>
          patch({
            levels: next
              ? [...form.levels, value as CourseLevel]
              : form.levels.filter((level) => level !== value),
          })
        }
        options={LEVELS.map((level) => ({
          value: level,
          label: courseLevelLabels[level],
        }))}
      />

      <Input
        label="Tajriba (yil)"
        type="number"
        min={0}
        max={45}
        inputMode="numeric"
        value={form.experienceYears === null ? "" : String(form.experienceYears)}
        error={errors.experienceYears}
        onChange={(event) => {
          const raw = event.target.value.trim();
          const parsed = raw === "" ? null : Number.parseInt(raw, 10);
          patch({
            experienceYears:
              parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.min(45, parsed)),
          });
        }}
      />

      <ChipGroup
        legend="Dars formati"
        values={form.formats}
        error={errors.formats}
        onToggle={(value, next) =>
          patch({
            formats: next
              ? [...form.formats, value as TeacherAnswers["formats"][number]]
              : form.formats.filter((format) => format !== value),
          })
        }
        options={[
          { value: "online", label: "Online" },
          { value: "offline", label: "Offline" },
        ]}
      />

      <ChipGroup
        legend="Dars tillari"
        values={form.languages}
        error={errors.languages}
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

      <TextareaField
        label="Bio"
        hint={`${TEACHER_TEXT_LIMITS.BIO_MIN}–${TEACHER_TEXT_LIMITS.BIO_MAX} belgi.`}
        rows={4}
        value={form.bio}
        error={errors.bio}
        onChange={(event) => patch({ bio: event.target.value })}
      />

      <TextareaField
        label="O‘qitish uslubi"
        hint={`${TEACHER_TEXT_LIMITS.APPROACH_MIN}–${TEACHER_TEXT_LIMITS.APPROACH_MAX} belgi.`}
        rows={4}
        value={form.approach}
        error={errors.approach}
        onChange={(event) => patch({ approach: event.target.value })}
      />

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={submit}>Saqlash</Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Bekor qilish
        </Button>
      </div>
      <p className="text-sm text-ink-500">
        Saqlash faqat shu brauzerdagi onboarding qoralamasini yangilaydi —
        katalogdagi ommaviy profil o‘zgarmaydi va serverga hech narsa
        yuborilmaydi.
      </p>
    </Card>
  );
}
