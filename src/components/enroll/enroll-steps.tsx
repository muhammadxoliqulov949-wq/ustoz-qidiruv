"use client";

import { ArrowLeftRight, Info, Pencil } from "lucide-react";
import { Button, ButtonLink, Input, TextareaField } from "@/components/ui";
import { PhoneField } from "@/components/auth/phone-input";
import { AuthNotice } from "@/components/auth/auth-notice";
import { cn } from "@/lib/utils";
import {
  ENROLL_NOTE_MAX,
  enrollAuthHrefs,
  groupScheduleLabel,
  groupWhereLabel,
  isFull,
  type EnrollCourseLite,
  type EnrollDraft,
  type EnrollFieldErrors,
  type EnrollGroupLite,
  type SummaryRow,
} from "@/lib/enroll";
import { GroupPicker } from "./group-picker";

/* -------------------------------------------------------------------------- */
/* Enrollment step content — presentation only. Every value on screen is a       */
/* projection of (catalog data ⇄ draft); validators run in the flow shell via    */
/* lib/enroll.enrollStepErrors, so these components just render the returned    */
/* field errors next to the right input (Input/Textarea/Phone already wire      */
/* aria-invalid + aria-describedby). No collapsing panels in review — all       */
/* decisions are visible (Phase 7 spec).                                        */
/* -------------------------------------------------------------------------- */

export interface EnrollStepProps {
  course: EnrollCourseLite;
  group: EnrollGroupLite | null;
  draft: EnrollDraft;
  errors: EnrollFieldErrors;
  patch: (partial: Partial<EnrollDraft>) => void;
  /** Jump back to an editable step (review edits, group changes). */
  onEdit: (stepIndex: number) => void;
  /** Group selection changed — the flow syncs URL + draft. */
  onSelectGroup: (groupId: string) => void;
}

/* --------------------------------- step 1 ---------------------------------- */

export function StepGroup({ course, group, errors, onSelectGroup }: EnrollStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-700">
        <span className="font-semibold text-ink-900">{course.title}</span>
        {course.category ? (
          <span className="text-ink-500"> · {course.category}</span>
        ) : null}
      </p>

      <GroupPicker
        legend="Qaysi guruhga yozilmoqchisiz?"
        groups={course.groups}
        selectedGroupId={group?.id ?? null}
        onSelect={onSelectGroup}
        error={errors.group}
      />
    </div>
  );
}

/** URL-carried group problems — never auto-fixed, always explained. */
export function GroupNotice({ kind }: { kind: "unknown" | "full" }) {
  return (
    <AuthNotice
      variant="warning"
      title={kind === "unknown" ? "Guruh topilmadi" : "Bu guruh to‘lgan"}
    >
      {kind === "unknown"
        ? "Havolada ko‘rsatilgan guruh ushbu kursda mavjud emas — tanlov buzilmasligi uchun hech narsa tanlanmagan holda ochildi. Ro‘yxatdan guruhni tanlang."
        : "Havoladagi guruhda joy qolmagan — boshqa guruh avtomatik tanlanmadi. Ro‘yxatdan bo‘sh guruhni tanlang."}
    </AuthNotice>
  );
}

/* --------------------------------- step 2 ---------------------------------- */

export function StepStudent({ course, group, draft, errors, patch }: EnrollStepProps) {
  const hrefs = enrollAuthHrefs(course, group?.id ?? null);
  return (
    <div className="flex flex-col gap-4">
      {draft.prefillApplied ? (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-ink-500">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-400" />
          <span>
            <span className="font-medium text-ink-700">Prototip prefill.</span>{" "}
            Ism va telefon shu brauzerdagi onboarding UI holatidan olindi — bu
            hisob ma’lumotlari emas.
          </span>
        </p>
      ) : null}

      <Input
        label="Ism va familiya"
        autoComplete="name"
        placeholder="Masalan: Aziza Karimova"
        value={draft.name}
        error={errors.name}
        onChange={(event) => patch({ name: event.target.value })}
      />

      <PhoneField
        value={draft.phone}
        error={errors.phone}
        onChange={(phone) => patch({ phone })}
      />

      <TextareaField
        label="Ustozga qisqa izoh (ixtiyoriy)"
        rows={3}
        maxLength={ENROLL_NOTE_MAX}
        placeholder="Masalan: dushanba kechqurun qulayroq."
        counter={{ value: draft.note.length, max: ENROLL_NOTE_MAX }}
        hint="Maksimum 400 belgi — ustozga yuboriladigan so‘rov matniga qo‘shiladi."
        value={draft.note}
        error={errors.note}
        onChange={(event) => patch({ note: event.target.value })}
      />

      <div className="rounded-xl border border-line bg-surface-muted p-4">
        <p className="text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Hisob hozircha shart emas.</span>{" "}
          Backend ulanganda so‘rov hisobingizga bog‘lanadi — xohlasangiz hozir
          kiring yoki ro‘yxatdan o‘ting, so‘ngra shu yozilishga qaytasiz.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={hrefs.login} variant="outline" size="sm">
            Kirish
          </ButtonLink>
          <ButtonLink href={hrefs.register} size="sm">
            Ro‘yxatdan o‘tish
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- step 3 ---------------------------------- */

export function StepSchedule({ course, group, onEdit }: EnrollStepProps) {
  if (!group) {
    return (
      <AuthNotice title="Guruh hali tanlanmagan">
        Format va jadval guruhga biriktirilgan. Avval 1-qadamdan guruhni
        tanlang.
      </AuthNotice>
    );
  }
  const variants = Array.from(new Set(course.groups.map((g) => g.format)));
  const rows: SummaryRow[] = [
    { label: "Kurs", value: course.title },
    { label: "Ustoz", value: course.teacherName },
    { label: "Guruh", value: group.title },
    { label: "Kunlar va vaqt", value: groupScheduleLabel(group) },
    { label: "Format", value: group.formatLabel },
    { label: "Manzil", value: groupWhereLabel(group) },
    { label: "Boshlanish", value: group.startDateLabel },
    {
      label: "Joylar",
      value: `${group.capacity - group.seatsRemaining}/${group.capacity} band${
        isFull(group) ? " · guruh to‘lgan" : ""
      }`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-muted text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-ink-500">{row.label}</dt>
            <dd className="text-end font-medium break-words text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-ink-500">
        {variants.length > 1
          ? "Format guruhga biriktirilgan — boshqa formatdagi guruhlar ro‘yxati 1-qadamda mavjud, shuning uchun bu yerda alohida format tanlanmaydi."
          : "Ushbu kursning barcha guruhlari bir xil formatda o‘tadi — bu qadam faqat tasdiq uchun."}
      </p>
      <div>
        <Button variant="outline" size="sm" leadingIcon={<ArrowLeftRight />} onClick={() => onEdit(0)}>
          Guruhni o‘zgartirish
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- step 4 ---------------------------------- */

export function StepReview({ course, group, draft, onEdit }: EnrollStepProps) {
  const price =
    course.priceUzs === 0
      ? { value: "Bepul", note: "Bu bepul kurs — to‘lov bosqichi umuman bo‘lmaydi." }
      : {
          value: course.priceSummary,
          note: "Onlayn to‘lov bosqichi backend bilan qo‘shiladi; hozircha narxni ustoz bilan bevosita kelishasiz. Karta ma’lumotlari so‘ralmaydi.",
        };

  return (
    <div className="flex flex-col gap-3">
      <ReviewSection
        title="Kurs"
        rows={[
          { label: "Nomi", value: course.title },
          { label: "Ustoz", value: course.teacherName },
        ]}
      />
      <ReviewSection
        title="Guruh va vaqt"
        onEdit={() => onEdit(0)}
        rows={
          group
            ? [
                { label: "Guruh", value: group.title },
                { label: "Kunlar", value: groupScheduleLabel(group) },
                {
                  label: "Format / manzil",
                  value: `${group.formatLabel} · ${groupWhereLabel(group)}`,
                },
                { label: "Boshlanish", value: group.startDateLabel },
              ]
            : [{ label: "Guruh", value: "Tanlanmagan — orqaga qaytib tanlang" }]
        }
      />
      <ReviewSection
        title="O‘quvchi"
        onEdit={() => onEdit(1)}
        rows={[
          { label: "Ism", value: draft.name.trim() || "Kiritilmagan" },
          { label: "Telefon", value: draft.phone || "Kiritilmagan" },
          ...(draft.note.trim()
            ? ([{ label: "Izoh", value: draft.note.trim() }] as SummaryRow[])
            : []),
        ]}
      />
      <ReviewSection
        title="Narx"
        rows={[
          { label: "To‘lov", value: price.value },
          { label: "Izoh", value: price.note },
        ]}
      />

      <p className="mt-1 text-sm text-ink-500">
        Hisobingizga kirgan bo‘lsangiz, so‘rov haqiqiy saqlanadi va kabinetingizda
        ko‘rinadi. So‘rov{" "}
        <span className="font-medium text-ink-700">joyni band qilmaydi</span> va
        ustoz tomonidan tasdiqlanganini bildirmaydi — tasdiqlash va to‘lov keyingi
        bosqichda qo‘shiladi.
      </p>
    </div>
  );
}

function ReviewSection({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: SummaryRow[];
  onEdit?: () => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
          {title}
        </h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-accent-700",
              "transition-colors duration-fast hover:text-accent-500",
              "focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
            )}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            O‘zgartirish
          </button>
        ) : null}
      </div>
      <dl className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-ink-500">{row.label}</dt>
            <dd className="text-end font-medium break-words text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
