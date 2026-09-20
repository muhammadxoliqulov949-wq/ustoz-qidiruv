"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2 } from "lucide-react";
import { Badge, Button, Input, SelectField, TextareaField } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { ChipGroup } from "@/components/onboarding/chip-group";
import { saveTeacherProfileAction } from "@/server/actions/profile";
import {
  buildTeacherProfileFormData,
  TEACHER_PROFILE_LIMITS,
  type TeacherProfileEditValues,
} from "@/lib/teacher-profile";
import {
  languageLabel,
  onboardingCategories,
  onboardingCities,
  onboardingCityLabel,
  onboardingLanguages,
} from "@/lib/onboarding";
import { courseLevelLabels } from "@/data/courses";
import {
  missingVerificationRequirements,
  verificationProfileInput,
  verificationRequirementHint,
  verificationRequirementLabel,
  VERIFICATION_EDITABLE_FIELDS,
  VERIFICATION_MIN_LENGTH,
  type VerificationRequirementKey,
} from "@/lib/teacher-verification";

/* -------------------------------------------------------------------------- */
/* TeacherProfileEditor — the persisted profile, editable.                     */
/*                                                                              */
/* WHY THIS EXISTS                                                              */
/* Verification (/teacher/dashboard/verification) refuses an application until    */
/* six profile fields are filled in, and until now nothing on this page wrote     */
/* those fields to the database: the only editor here saved a browser-local       */
/* draft, so the screen demanded data the teacher had no way to enter. This form  */
/* posts to the SAME `teacher_profiles` row verification reads.                   */
/*                                                                              */
/* ONE SOURCE OF TRUTH, THREE TIMES OVER                                        */
/*   • the field labels and hints come from `VERIFICATION_REQUIREMENTS` — the     */
/*     exact list the server's eligibility predicate evaluates, so a caption      */
/*     cannot promise a threshold the predicate does not use;                     */
/*   • the live "what is still missing" list is `missingVerificationRequirements` */
/*     called on the form's own values, i.e. the same function the verification   */
/*     page and the submission transaction call on the persisted row;             */
/*   • the request body is `buildTeacherProfileFormData()`, the builder the       */
/*     regression suite feeds into the server's reader, so the encoding is        */
/*     tested rather than assumed.                                                */
/*                                                                              */
/* WHAT IT CANNOT DO                                                            */
/* No verification state, no slug, no photo and no user id are in the payload     */
/* (`buildTeacherProfileFormData` cannot express them and the server schema is    */
/* `.strict()`), and a successful save never changes the trust state — that word  */
/* is written only by the admin decision path. The profile image has its own      */
/* managed uploader above this form and is untouched by it.                       */
/* -------------------------------------------------------------------------- */

/**
 * Caption for a requirement-backed field: the label from the shared requirement
 * list plus the fact that a reviewer needs it. Every field rendered from
 * `VERIFICATION_EDITABLE_FIELDS` is a requirement by construction, so the marker
 * is not a second list that could drift.
 */
function requiredCaption(key: VerificationRequirementKey): string {
  return `${verificationRequirementLabel(key)} — tasdiqlash uchun majburiy`;
}

const LEVEL_OPTIONS = ["boshlangich", "orta", "yuqori"] as const;

export function TeacherProfileEditor({
  initialValues,
  verificationState,
}: {
  initialValues: TeacherProfileEditValues;
  verificationState: "unverified" | "pending" | "verified";
}) {
  const router = useRouter();
  const [form, setForm] = useState<TeacherProfileEditValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * Live requirement check on the values being edited. Same pure predicate the
   * server runs on the stored row — this is the teacher seeing the server's
   * opinion before they save, not a second, kinder opinion.
   */
  const missing = useMemo(
    () =>
      missingVerificationRequirements(
        verificationProfileInput({
          name: form.name,
          specialization: form.specialization === "" ? null : form.specialization,
          city: form.city === "" ? null : form.city,
          languages: form.languages,
          bio: form.bio === "" ? null : form.bio,
          approach: form.approach === "" ? null : form.approach,
          experienceYears:
            form.experienceYears === "" || Number.isNaN(Number(form.experienceYears))
              ? null
              : Number(form.experienceYears),
        }),
      ),
    [form],
  );
  const requiredTotal = VERIFICATION_EDITABLE_FIELDS.length;
  const filledCount = requiredTotal - missing.length;

  const patch = (next: Partial<TeacherProfileEditValues>) => {
    setForm((current) => ({ ...current, ...next }));
    setMessage(null);
  };

  function submit() {
    setFieldErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await saveTeacherProfileAction(buildTeacherProfileFormData(form));
      if (result.ok) {
        setMessage({
          tone: "success",
          text:
            missing.length === 0
              ? "Profil saqlandi. Endi tasdiqlash uchun ariza yuborishingiz mumkin."
              : "Profil saqlandi. Tasdiqlash uchun yuborishdan oldin qolgan maydonlarni to‘ldiring.",
        });
        // Re-read the persisted row so “Saqlangan profil” and the verification
        // state on this page come from the database, not from local state.
        router.refresh();
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setMessage({ tone: "error", text: result.message ?? "Saqlanmadi." });
    });
  }

  const toggle = (field: "categories" | "levels" | "formats" | "languages") =>
    (value: string, next: boolean) =>
      patch({
        [field]: next
          ? [...form[field], value]
          : form[field].filter((current) => current !== value),
      } as Partial<TeacherProfileEditValues>);

  return (
    <section
      aria-labelledby="teacher-profile-editor"
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="teacher-profile-editor" className="text-xl font-semibold text-ink-900">
            Profil ma’lumotlari
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-ink-500">
            Bu forma hisobingizdagi profilga yoziladi. Tasdiqlash arizasi aynan
            shu ma’lumotlar asosida ko‘rib chiqiladi.
          </p>
        </div>
        <Badge variant={missing.length === 0 ? "success" : "neutral"} size="md">
          <BadgeCheck aria-hidden="true" className="size-3.5" />
          {`Majburiy maydonlar: ${filledCount}/${requiredTotal}`}
        </Badge>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface-muted px-4 py-3">
          <p className="text-sm font-medium text-ink-900">
            Tasdiqlash uchun hali to‘ldirilmagan:
          </p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-sm text-ink-700">
            {missing.map((requirement) => (
              <li key={requirement.key}>
                {requirement.label}
                <span className="text-ink-500"> — {requirement.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          Barcha majburiy maydonlar to‘ldirilgan. Saqlagach{" "}
          <Link
            href="/teacher/dashboard/verification"
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            “Profil tasdig‘i”
          </Link>{" "}
          bo‘limida “Tasdiqlash uchun yuborish” tugmasi faol bo‘ladi.
        </p>
      )}

      {verificationState === "pending" ? (
        <AuthNotice title="Ariza ko‘rib chiqilmoqda">
          Ma’lumotlarni o‘zgartirishingiz mumkin — navbatdagi ariza o‘zgarishsiz
          qoladi va yangi ma’lumotlar keyingi arizada hisobga olinadi.
        </AuthNotice>
      ) : null}

      <div className="flex flex-col gap-5">
        <Input
          name="name"
          label={requiredCaption("name")}
          hint={verificationRequirementHint("name")}
          autoComplete="name"
          value={form.name}
          error={fieldErrors.name}
          onChange={(event) => patch({ name: event.target.value })}
        />

        <Input
          name="specialization"
          label={requiredCaption("specialization")}
          hint={`${verificationRequirementHint("specialization")} Kamida ${VERIFICATION_MIN_LENGTH.specialization} belgi, ko‘pi bilan ${TEACHER_PROFILE_LIMITS.SPECIALIZATION_MAX} belgi.`}
          placeholder="IELTS va umumiy ingliz tili"
          value={form.specialization}
          error={fieldErrors.specialization}
          onChange={(event) => patch({ specialization: event.target.value })}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="city"
            label={requiredCaption("city")}
            hint={verificationRequirementHint("city")}
            value={form.city}
            error={fieldErrors.city}
            onChange={(event) => patch({ city: event.target.value })}
          >
            <option value="">Tanlanmagan</option>
            {onboardingCities.map((slug) => (
              <option key={slug} value={slug}>
                {onboardingCityLabel(slug)}
              </option>
            ))}
          </SelectField>

          <Input
            name="district"
            label="Tuman yoki mo‘ljal"
            hint={`Ixtiyoriy. Ko‘pi bilan ${TEACHER_PROFILE_LIMITS.DISTRICT_MAX} belgi.`}
            value={form.district}
            error={fieldErrors.district}
            onChange={(event) => patch({ district: event.target.value })}
          />
        </div>

        <ChipGroup
          legend={requiredCaption("languages")}
          hint={verificationRequirementHint("languages")}
          values={form.languages}
          error={fieldErrors.languages}
          onToggle={toggle("languages")}
          options={onboardingLanguages.map((tag) => ({ value: tag, label: languageLabel(tag) }))}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="experienceYears"
            label={requiredCaption("experienceYears")}
            hint={verificationRequirementHint("experienceYears")}
            type="number"
            min={TEACHER_PROFILE_LIMITS.EXPERIENCE_MIN}
            max={TEACHER_PROFILE_LIMITS.EXPERIENCE_MAX}
            inputMode="numeric"
            value={form.experienceYears}
            error={fieldErrors.experienceYears}
            onChange={(event) => patch({ experienceYears: event.target.value })}
          />

          <ChipGroup
            legend="Dars formati"
            hint="Ixtiyoriy — ommaviy profilda ko‘rsatiladi."
            values={form.formats}
            error={fieldErrors.formats}
            onToggle={toggle("formats")}
            options={[
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
            ]}
          />
        </div>

        <ChipGroup
          legend="Yo‘nalishlar (fanlar)"
          hint={`Eng ko‘pi bilan ${TEACHER_PROFILE_LIMITS.CATEGORIES_MAX} ta.`}
          maxSelected={TEACHER_PROFILE_LIMITS.CATEGORIES_MAX}
          values={form.categories}
          error={fieldErrors.categories}
          onToggle={toggle("categories")}
          options={onboardingCategories.map((category) => ({
            value: category.slug,
            label: category.name,
          }))}
        />

        <ChipGroup
          legend="O‘quvchi darajalari"
          values={form.levels}
          error={fieldErrors.levels}
          onToggle={toggle("levels")}
          options={LEVEL_OPTIONS.map((level) => ({
            value: level,
            label: courseLevelLabels[level],
          }))}
        />

        <TextareaField
          name="bio"
          label={requiredCaption("bio")}
          hint={`${verificationRequirementHint("bio")} Ko‘pi bilan ${TEACHER_PROFILE_LIMITS.BIO_MAX} belgi.`}
          rows={5}
          counter={{ value: form.bio.trim().length, max: TEACHER_PROFILE_LIMITS.BIO_MAX }}
          value={form.bio}
          error={fieldErrors.bio}
          onChange={(event) => patch({ bio: event.target.value })}
        />

        <TextareaField
          name="approach"
          label={requiredCaption("approach")}
          hint={`${verificationRequirementHint("approach")} Ko‘pi bilan ${TEACHER_PROFILE_LIMITS.APPROACH_MAX} belgi.`}
          rows={5}
          counter={{ value: form.approach.trim().length, max: TEACHER_PROFILE_LIMITS.APPROACH_MAX }}
          value={form.approach}
          error={fieldErrors.approach}
          onChange={(event) => patch({ approach: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="button" onClick={submit} loading={pending} disabled={pending}>
          {pending ? "Saqlanmoqda…" : "Profilni saqlash"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setForm(initialValues);
            setFieldErrors({});
            setMessage(null);
          }}
          disabled={pending}
        >
          Bekor qilish
        </Button>
        <Link
          href="/teacher/dashboard/verification"
          className="text-sm font-medium text-accent-700 underline underline-offset-2"
        >
          Tasdiqlash bo‘limiga o‘tish
        </Link>
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm">
        {message ? (
          <span
            className={
              message.tone === "success"
                ? "flex items-center gap-1.5 font-medium text-ink-900"
                : "font-medium text-danger"
            }
          >
            {message.tone === "success" ? (
              <CheckCircle2 aria-hidden="true" className="size-4 text-accent-700" />
            ) : null}
            {message.text}
          </span>
        ) : null}
      </p>

      <p className="text-xs leading-relaxed text-ink-500">
        Ism, yo‘nalish, shahar, dars tillari, tajriba, tavsif va dars uslubi
        saqlanadi. Tasdiqlash holati bu formadan o‘zgarmaydi — uni faqat
        administrator qarori o‘zgartiradi. Profil rasmi yuqoridagi yuklash
        bo‘limida boshqariladi.
      </p>
    </section>
  );
}
