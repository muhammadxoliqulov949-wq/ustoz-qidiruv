"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  IconButton,
  Input,
  RadioCardGroup,
  SelectField,
  TextareaField,
} from "@/components/ui";
import { ChipGroup } from "@/components/onboarding/chip-group";
import {
  COURSE_DAY_OPTIONS,
  COURSE_DRAFT_LIMITS,
  emptyCourseDraftGroup,
  emptyCourseDraftModule,
  moveItem,
  type CourseDraft,
  type CourseFieldErrors,
} from "@/lib/course-draft";
import type { CourseAuthoringOptions } from "@/data/course-authoring";
import type { CourseFormat, CourseLevel } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* Step forms — Phase 10. Dumb presentational forms: they receive the draft,    */
/* the error map produced by the pure validator, and a patch callback. No       */
/* validation logic, no storage access, no dataset imports (taxonomies arrive   */
/* as {value,label} options from data/course-authoring.ts).                     */
/*                                                                              */
/* Every control is a design-system primitive, so labels, aria-invalid and      */
/* error wiring come for free. Grouped choices use fieldset/legend; add/remove/ */
/* reorder are real buttons with text-bearing accessible names (no drag-only    */
/* interaction anywhere).                                                       */
/* -------------------------------------------------------------------------- */

export interface StepFormProps {
  draft: CourseDraft;
  errors: CourseFieldErrors;
  patch: (partial: Partial<CourseDraft>) => void;
  options: CourseAuthoringOptions;
}

const L = COURSE_DRAFT_LIMITS;

/* ------------------------------- 1. basics --------------------------------- */

export function StepBasics({ draft, errors, patch, options }: StepFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Kurs nomi"
        hint={`Katalog kartasida ko‘rinadi. ${L.TITLE_MIN}–${L.TITLE_MAX} belgi.`}
        value={draft.title}
        error={errors.title}
        onChange={(event) => patch({ title: event.target.value })}
      />

      <SelectField
        label="Yo‘nalish"
        error={errors.categoryId}
        value={draft.categoryId ?? ""}
        onChange={(event) =>
          patch({ categoryId: event.target.value === "" ? null : event.target.value })
        }
      >
        <option value="">Tanlanmagan</option>
        {options.categories.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <RadioCardGroup
        legend="Kurs darajasi"
        columns={3}
        value={draft.level}
        error={errors.level}
        onChange={(value) => patch({ level: value as CourseLevel })}
        options={options.levels.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />

      <TextareaField
        label="Qisqa tavsif"
        hint={`Kurs kartasi va sarlavha ostidagi matn. ${L.SUMMARY_MIN}–${L.SUMMARY_MAX} belgi.`}
        rows={3}
        value={draft.summary}
        error={errors.summary}
        counter={{ value: draft.summary.trim().length, max: L.SUMMARY_MAX }}
        onChange={(event) => patch({ summary: event.target.value })}
      />

      <ChipGroup
        legend="O‘qitish tillari"
        hint="Katalogdagi til teglari bilan bir xil ro‘yxat."
        error={errors.teachingLanguages}
        maxSelected={L.MAX_LANGUAGES}
        options={options.languages}
        values={draft.teachingLanguages}
        onToggle={(value, next) =>
          patch({
            teachingLanguages: next
              ? [...draft.teachingLanguages, value]
              : draft.teachingLanguages.filter((item) => item !== value),
          })
        }
      />
    </div>
  );
}

/* ------------------------------- 2. format --------------------------------- */

export function StepFormat({ draft, errors, patch, options }: StepFormProps) {
  const online = draft.format === "online";
  return (
    <div className="flex flex-col gap-5">
      <RadioCardGroup
        legend="Dars formati"
        columns={3}
        value={draft.format}
        error={errors.format}
        onChange={(value) => {
          const format = value as CourseFormat;
          // Online courses structurally cannot carry an address.
          patch(
            format === "online"
              ? { format, city: null, location: "" }
              : { format },
          );
        }}
        options={options.formats.map((option) => ({
          value: option.value,
          label: option.label,
          description:
            option.value === "online"
              ? "Manzil so‘ralmaydi"
              : option.value === "offline"
                ? "Sinfda o‘tiladi"
                : "Sinf va onlayn aralash",
        }))}
      />

      {draft.format === null ? null : online ? (
        <p className="rounded-xl border border-line bg-surface-muted p-4 text-sm text-ink-700">
          Onlayn kurs uchun jismoniy manzil so‘ralmaydi. Uchrashuv havolalari
          (Zoom, Meet) bu bosqichda saqlanmaydi — ular haqiqiy backend bilan
          birga keladi.
        </p>
      ) : (
        <>
          <SelectField
            label="Shahar"
            error={errors.city}
            value={draft.city ?? ""}
            onChange={(event) =>
              patch({ city: event.target.value === "" ? null : event.target.value })
            }
          >
            <option value="">Tanlanmagan</option>
            {options.cities.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Input
            label="Manzil yoki mo‘ljal"
            hint="Masalan: “Toshkent, Chilonzor — 12-kvartal”."
            value={draft.location}
            error={errors.location}
            onChange={(event) => patch({ location: event.target.value })}
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------- 3. price --------------------------------- */

export function StepPrice({ draft, errors, patch }: StepFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <RadioCardGroup
        legend="Narx turi"
        columns={2}
        value={draft.pricing}
        onChange={(value) =>
          patch(
            value === "free"
              ? { pricing: "free", priceUzs: null }
              : { pricing: "paid" },
          )
        }
        options={[
          { value: "free", label: "Bepul", description: "Katalogda “Bepul” deb chiqadi" },
          { value: "paid", label: "Pullik", description: "Oylik to‘lov, so‘mda" },
        ]}
      />

      {draft.pricing === "paid" ? (
        <Input
          label="Oylik narx (so‘m)"
          inputMode="numeric"
          hint="Faqat oylik to‘lov qo‘llab-quvvatlanadi — katalog modeli shunday."
          value={draft.priceUzs === null ? "" : String(draft.priceUzs)}
          error={errors.priceUzs}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 9);
            patch({ priceUzs: digits === "" ? null : Number(digits) });
          }}
        />
      ) : null}

      <p className="rounded-xl border border-line bg-surface-muted p-4 text-sm text-ink-700">
        To‘lov tizimlari (Payme, Click, Uzum), chegirmalar, kuponlar va
        bo‘lib-to‘lash bu bosqichda yo‘q va soxta ko‘rinishda ham qo‘shilmaydi.
      </p>
    </div>
  );
}

/* -------------------------------- 4. groups -------------------------------- */

export function StepGroups({ draft, errors, patch }: StepFormProps) {
  const setGroup = (id: string, partial: Partial<CourseDraft["groups"][number]>) =>
    patch({
      groups: draft.groups.map((group) =>
        group.id === id ? { ...group, ...partial } : group,
      ),
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border border-line bg-surface-muted p-4 text-sm text-ink-700">
        Bu yerda faqat <strong className="font-semibold">rejalashtirilgan sig‘im</strong>{" "}
        kiritiladi. Band bo‘lgan joylar soni haqiqiy yozilishlardan kelib chiqadi —
        prototipda bunday ma’lumot yo‘q, shuning uchun so‘ralmaydi ham.
      </p>

      {errors.groups ? (
        <p className="text-sm text-danger" role="alert">
          {errors.groups}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {draft.groups.map((group, index) => {
          const key = `groups.${group.id}`;
          return (
            <li key={group.id}>
              <Card className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-ink-900">
                    {index + 1}-guruh
                  </h3>
                  {draft.groups.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 aria-hidden="true" />}
                      onClick={() =>
                        patch({
                          groups: draft.groups.filter((item) => item.id !== group.id),
                        })
                      }
                    >
                      {index + 1}-guruhni o‘chirish
                    </Button>
                  ) : null}
                </div>

                <Input
                  label="Guruh nomi"
                  value={group.title}
                  error={errors[`${key}.title`]}
                  onChange={(event) => setGroup(group.id, { title: event.target.value })}
                />

                <ChipGroup
                  legend="Dars kunlari"
                  error={errors[`${key}.days`]}
                  options={COURSE_DAY_OPTIONS.map((day) => ({
                    value: day.value,
                    label: day.label,
                  }))}
                  values={group.days}
                  onToggle={(value, next) =>
                    setGroup(group.id, {
                      days: next
                        ? COURSE_DAY_OPTIONS.map((day) => day.value).filter(
                            (day) => group.days.includes(day) || day === value,
                          )
                        : group.days.filter((day) => day !== value),
                    })
                  }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Boshlanish vaqti"
                    type="time"
                    value={group.startTime}
                    error={errors[`${key}.startTime`]}
                    onChange={(event) =>
                      setGroup(group.id, { startTime: event.target.value })
                    }
                  />
                  <Input
                    label="Boshlanish sanasi"
                    type="date"
                    value={group.startDate}
                    error={errors[`${key}.startDate`]}
                    onChange={(event) =>
                      setGroup(group.id, { startDate: event.target.value })
                    }
                  />
                  <Input
                    label="Sig‘im (joy)"
                    inputMode="numeric"
                    value={group.capacity === null ? "" : String(group.capacity)}
                    error={errors[`${key}.capacity`]}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
                      setGroup(group.id, {
                        capacity: digits === "" ? null : Number(digits),
                      });
                    }}
                  />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Plus aria-hidden="true" />}
          disabled={draft.groups.length >= L.MAX_GROUPS}
          onClick={() => patch({ groups: [...draft.groups, emptyCourseDraftGroup()] })}
        >
          Guruh qo‘shish
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- 5. syllabus -------------------------------- */

export function StepSyllabus({ draft, errors, patch }: StepFormProps) {
  const setModule = (id: string, partial: Partial<CourseDraft["syllabus"][number]>) =>
    patch({
      syllabus: draft.syllabus.map((module) =>
        module.id === id ? { ...module, ...partial } : module,
      ),
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-500">
        Modullar ommaviy kurs sahifasidagi “Dastur” bloki bilan bir xil tuzilmada
        (nomi, tavsifi, darslar soni). Tartibni pastdagi tugmalar bilan
        o‘zgartirasiz — drag-and-drop yo‘q, chunki u klaviatura bilan ishlamaydi.
      </p>

      {errors.syllabus ? (
        <p className="text-sm text-danger" role="alert">
          {errors.syllabus}
        </p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {draft.syllabus.map((module, index) => {
          const key = `syllabus.${module.id}`;
          const name = module.title.trim() === "" ? `${index + 1}-modul` : module.title.trim();
          return (
            <li key={module.id}>
              <Card className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink-900">
                    {index + 1}-modul
                  </h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label={`${name}ni yuqoriga ko‘chirish`}
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => patch({ syllabus: moveItem(draft.syllabus, index, -1) })}
                     icon={<ArrowUp aria-hidden="true" />} />
                    <IconButton
                      label={`${name}ni pastga ko‘chirish`}
                      variant="ghost"
                      size="sm"
                      disabled={index === draft.syllabus.length - 1}
                      onClick={() => patch({ syllabus: moveItem(draft.syllabus, index, 1) })}
                     icon={<ArrowDown aria-hidden="true" />} />
                    <IconButton
                      label={`${name}ni o‘chirish`}
                      variant="ghost"
                      size="sm"
                      disabled={draft.syllabus.length <= 1}
                      onClick={() =>
                        patch({
                          syllabus: draft.syllabus.filter((item) => item.id !== module.id),
                        })
                      }
                     icon={<Trash2 aria-hidden="true" />} />
                  </div>
                </div>

                <Input
                  label="Modul nomi"
                  value={module.title}
                  error={errors[`${key}.title`]}
                  onChange={(event) => setModule(module.id, { title: event.target.value })}
                />
                <TextareaField
                  label="Modul tavsifi"
                  rows={3}
                  value={module.description}
                  error={errors[`${key}.description`]}
                  onChange={(event) =>
                    setModule(module.id, { description: event.target.value })
                  }
                />
                <Input
                  label="Darslar soni"
                  inputMode="numeric"
                  className="sm:max-w-48"
                  value={module.lessons === null ? "" : String(module.lessons)}
                  error={errors[`${key}.lessons`]}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
                    setModule(module.id, {
                      lessons: digits === "" ? null : Number(digits),
                    });
                  }}
                />
              </Card>
            </li>
          );
        })}
      </ol>

      <div>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Plus aria-hidden="true" />}
          disabled={draft.syllabus.length >= L.MAX_MODULES}
          onClick={() => patch({ syllabus: [...draft.syllabus, emptyCourseDraftModule()] })}
        >
          Modul qo‘shish
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- 6. detail -------------------------------- */

function BulletEditor({
  legend,
  hint,
  values,
  errors,
  keyPrefix,
  onChange,
}: {
  legend: string;
  hint: string;
  values: string[];
  errors: CourseFieldErrors;
  keyPrefix: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1 px-0 text-sm font-medium text-ink-700">{legend}</legend>
      <p className={`mb-2 text-sm ${errors[keyPrefix] ? "text-danger" : "text-ink-500"}`}>
        {errors[keyPrefix] ?? hint}
      </p>
      <ul className="flex flex-col gap-3">
        {values.map((value, index) => (
          <li key={`${keyPrefix}-${index}`} className="flex items-start gap-2">
            <Input
              className="flex-1"
              label={`${legend} — ${index + 1}-qator`}
              value={value}
              error={errors[`${keyPrefix}.${index}`]}
              onChange={(event) => {
                const next = values.slice();
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <span className="pt-7">
              <IconButton
                label={`${index + 1}-qatorni o‘chirish`}
                variant="ghost"
                size="sm"
                disabled={values.length <= 1}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
               icon={<Trash2 aria-hidden="true" />} />
            </span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-3"
        variant="outline"
        size="sm"
        leadingIcon={<Plus aria-hidden="true" />}
        disabled={values.length >= L.MAX_BULLETS}
        onClick={() => onChange([...values, ""])}
      >
        Qator qo‘shish
      </Button>
    </fieldset>
  );
}

export function StepDetail({ draft, errors, patch }: StepFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <TextareaField
        label="To‘liq tavsif"
        hint={`Ommaviy sahifadagi “Kurs haqida” matni. ${L.LONG_MIN}–${L.LONG_MAX} belgi.`}
        rows={7}
        value={draft.longDescription}
        error={errors.longDescription}
        counter={{ value: draft.longDescription.trim().length, max: L.LONG_MAX }}
        onChange={(event) => patch({ longDescription: event.target.value })}
      />

      <BulletEditor
        legend="Kim uchun"
        hint={`Kamida ${L.MIN_AUDIENCE} ta qator.`}
        values={draft.audience}
        errors={errors}
        keyPrefix="audience"
        onChange={(audience) => patch({ audience })}
      />

      <BulletEditor
        legend="Nimalarni o‘rganadi"
        hint={`Kamida ${L.MIN_OUTCOMES} ta natija.`}
        values={draft.learningOutcomes}
        errors={errors}
        keyPrefix="learningOutcomes"
        onChange={(learningOutcomes) => patch({ learningOutcomes })}
      />
    </div>
  );
}
