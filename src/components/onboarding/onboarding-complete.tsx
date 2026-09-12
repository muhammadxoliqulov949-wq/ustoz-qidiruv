"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar, Badge, Button, ButtonLink } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { ROLE_LABELS } from "@/components/auth/role-choice";
import { useOnboardingDraft } from "./draft-store";
import {
  onboardingCategories,
  onboardingCityLabel,
  studentCategoryHref,
  studentCoursesHref,
  studentSummaryRows,
  studentTeachersHref,
  teacherSummaryRows,
  type UserRole,
} from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* OnboardingComplete — the flow's end screen. This is a UI completion           */
/* PREVIEW, and it says so out loud (Phase 6 honesty rule): no "account         */
/* created" wording, no fake verification, no invented profile URL.             */
/*   • student → answer summary + real pre-filtered browse CTAs (?city=&format=  */
/*     per the Phase 3 URL contract). Skipped runs show an explicit skipped      */
/*     state instead of a summary.                                               */
/*   • teacher → "profile as it would look" preview built ONLY from what was     */
/*     typed + an honest pending-verification badge + a pointer that course      */
/*     creation is Phase 10.                                                       */
/* -------------------------------------------------------------------------- */

export interface OnboardingCompleteProps {
  role: UserRole;
  onRestart: () => void;
}

export function OnboardingComplete({ role, onRestart }: OnboardingCompleteProps) {
  const { draft } = useOnboardingDraft();

  if (role === "student") {
    const answers = draft.student;
    const rows = studentSummaryRows(answers).filter((row) => row.value !== null);
    const skipped = draft.skipped && rows.length === 0;
    const categoryHref = studentCategoryHref(answers);

    return (
      <div className="flex flex-col gap-5">
        {skipped ? (
          <div className="rounded-xl border border-line bg-surface-muted p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Onboarding o‘tkazib yuborildi
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">
              Bu holat normal — o‘qishni keyinroq shaxsiylashtirishingiz mumkin.
              Qiziqtirgan yo‘nalishingizni <Link href="/courses" className="font-medium text-accent-700 underline underline-offset-2">kurslar</Link>{" "}
              yoki <Link href="/teachers" className="font-medium text-accent-700 underline underline-offset-2">ustozlar</Link>{" "}
              sahifasidagi filtrlardan istalgan payt tanlaysiz.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface-muted p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">
                Tanlovlaringiz (UI holati)
              </h2>
              <Badge variant="accent" size="md">
                <GraduationCap aria-hidden="true" className="size-3.5" />
                {ROLE_LABELS.student}
              </Badge>
            </div>
            <dl className="mt-3 flex flex-col divide-y divide-line text-sm">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-2">
                  <dt className="shrink-0 text-ink-500">{row.label}</dt>
                  <dd className="text-end font-medium text-ink-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <AuthNotice live title="Bu — onboarding interfeysining yakuni">
          Hisob yaratilmadi va hech qanday ma’lumot serverga yuborilmadi.
          Tanlovlaringiz faqat shu brauzerdagi vaqtinchalik prototip holatida
          saqlanadi; haqiqiy profil va tavsiyalar backend ulanganda shu
          ma’lumotlar asosida quriladi.
        </AuthNotice>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <ButtonLink href={studentCoursesHref(answers)} size="lg" fullWidth leadingIcon={<BookOpen />}>
            Kurslarni ko‘rish
          </ButtonLink>
          <ButtonLink
            href={studentTeachersHref(answers)}
            size="lg"
            variant="outline"
            fullWidth
            leadingIcon={<Users />}
          >
            Ustozlarni ko‘rish
          </ButtonLink>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {categoryHref ? (
            <ButtonLink
              href={categoryHref}
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowRight />}
            >
              Tanlangan yo‘nalish kurslari
            </ButtonLink>
          ) : (
            <span aria-hidden="true" />
          )}
          <ClearDraftButton onRestart={onRestart} />
        </div>
      </div>
    );
  }

  /* -------------------------------- teacher -------------------------------- */
  const answers = draft.teacher;
  const rows = teacherSummaryRows(answers).filter((row) => row.value !== null);
  const specialization = answers.categories
    .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  return (
    <div className="flex flex-col gap-5">
      {/* Profile preview — everything below is what the flow actually knows. */}
      <div className="rounded-xl border border-line bg-surface-muted p-5">
        <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">
          Profil ko‘rinishi — UI holati
        </p>
        <div className="mt-3 flex items-start gap-4">
          <Avatar name={answers.name || "?"} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-ink-900">
              {answers.name || "Ism kiritilmagan"}
            </h2>
            {specialization ? (
              <p className="mt-0.5 text-sm text-ink-500">{specialization}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">
                <BadgeCheck aria-hidden="true" className="size-3.5" />
                Tekshiruv kutilmoqda
              </Badge>
              {answers.city ? (
                <span className="text-sm text-ink-500">{onboardingCityLabel(answers.city)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 border-t border-line pt-3 text-sm sm:grid-cols-2">
          {rows
            .filter((row) => !["Ism", "Telefon"].includes(row.label))
            .map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2"
              >
                <dt className="shrink-0 text-ink-500">{row.label}</dt>
                <dd className="text-end font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
        </dl>
        {answers.bio ? (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-700">
            {answers.bio}
          </p>
        ) : null}
        {answers.approach ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            <span className="font-semibold text-ink-900">O‘qitish uslubi: </span>
            {answers.approach}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-ink-400">
          Kurs yaratish, narx va guruhlar — alohida bosqich (10-bosqich). Bu
          preview’da ular haqida hech qanday ma’lumot yo‘q va bo‘lmasligi kerak.
        </p>
      </div>

      <AuthNotice variant="warning" title="Profil saqlanmadi — bu UI holati">
        Haqiqiy ustoz profilingiz hali yaratilmagan: uni ko‘rish uchun
        <Link
          href="/teachers"
          className="mx-1 font-medium text-accent-700 underline underline-offset-2"
        >
          /teachers
        </Link>
        katalogidagi mavjud profillar ochiladi. Ma’lumotlar tasdiqlash
        (tekshiruv) va hisob backend ulangandagina asosiy tizimga yoziladi.
      </AuthNotice>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <ButtonLink href="/teachers" size="lg" fullWidth leadingIcon={<Users />}>
          Ustozlar katalogi
        </ButtonLink>
        <ButtonLink href="/" size="lg" variant="outline" fullWidth>
          Bosh sahifaga qaytish
        </ButtonLink>
      </div>
      <div className="flex justify-end">
        <ClearDraftButton onRestart={onRestart} />
      </div>
    </div>
  );
}

function ClearDraftButton({ onRestart }: { onRestart: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      leadingIcon={<Trash2 />}
      onClick={onRestart}
      className="text-ink-500 hover:text-ink-900"
    >
      Prototip holatini tozalash
    </Button>
  );
}
