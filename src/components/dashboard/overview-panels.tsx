"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Heart, UserRound } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { EmptyState } from "./empty-state";
import { RequestCard } from "./request-card";
import { useStudentState } from "./use-student-state";
import type { DashCatalog } from "@/lib/dashboard";
import { studentCoursesHref } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* Overview — a status summary, not an analytics dashboard.                     */
/* Every number on this screen is a COUNT of things that really exist in the     */
/* prototype state (saved items, one enrollment draft, filled profile fields).   */
/* There are deliberately no hours, streaks, progress bars, certificates or      */
/* completion percentages: none of those facts exist anywhere in the product.    */
/* -------------------------------------------------------------------------- */

function StatCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: typeof Heart;
}) {
  return (
    <Card variant="interactive" className="metric-card relative flex flex-col gap-1">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-500">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </p>
      <p className="text-2xl font-semibold text-ink-900">
        <Link href={href} className="outline-none after:absolute after:inset-0">
          {value}
        </Link>
      </p>
      <p className="text-sm text-ink-500">{hint}</p>
    </Card>
  );
}

export function OverviewPanels({ catalog }: { catalog: DashCatalog }) {
  const state = useStudentState(catalog);

  if (!state.ready) {
    // Pre-hydration: keep the real section structure (headings stay in the
    // document for SSR/a11y), only the data-dependent bodies wait. The
    // min-height reserves roughly the resolved panel height so the footer
    // does not jump when the prototype stores hydrate (layout-shift fix).
    return (
      <div className="flex min-h-[46rem] flex-col gap-8 sm:min-h-[40rem] lg:min-h-[52rem]">
        <section aria-labelledby="dash-next">
          <h2 id="dash-next" className="text-xl font-semibold text-ink-900">
            Tavsiya etilgan qadam
          </h2>
          <p className="mt-2 text-base text-ink-500" role="status">
            Brauzer holati o‘qilmoqda…
          </p>
        </section>
        <section aria-labelledby="dash-request">
          <h2 id="dash-request" className="text-xl font-semibold text-ink-900">
            Joriy yozilish so‘rovi
          </h2>
        </section>
      </div>
    );
  }

  const { completeness, requests, courses, teachers, answers } = state;
  const request = requests[0] ?? null;

  // The single recommended action, chosen from facts only (no scoring model).
  const nextAction =
    request && request.status === "draft"
      ? {
          title: "Yozilish qoralamangiz tugallanmagan",
          body: `“${request.courseTitle}” uchun boshlangan so‘rovni oxirigacha yakunlang.`,
          href: request.enrollHref,
          cta: "Qoralamani davom ettirish",
        }
      : !completeness.complete
        ? {
            title: "Profilni to‘ldiring",
            body: `${completeness.total} ta maydondan ${completeness.filled} tasi to‘ldirilgan. Qolgani: ${completeness.missing.join(", ")}.`,
            href: "/dashboard/profile",
            cta: "Profilni tahrirlash",
          }
        : courses.length === 0
          ? {
              title: "Kurs saqlab qo‘ying",
              body: "Yoqqan kurslarni saqlasangiz, ular shu kabinetda bir joyda turadi.",
              href: studentCoursesHref(answers),
              cta: "Kurslarni ko‘rish",
            }
          : {
              title: "Keyingi qadam: guruh tanlash",
              body: "Saqlangan kurslardan birini ochib, mos guruh va jadvalni tanlang.",
              href: "/dashboard/saved",
              cta: "Saqlanganlarni ochish",
            };

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------- stats ------------------------------- */}
      <section aria-labelledby="dash-stats">
        <h2 id="dash-stats" className="sr-only">
          Qisqa holat
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            href="/dashboard/courses"
            label="Yozilish so‘rovlari"
            value={String(requests.length)}
            hint={
              request
                ? request.statusLabel
                : "Hali birorta so‘rov boshlanmagan"
            }
            icon={BookOpen}
          />
          <StatCard
            href="/dashboard/saved"
            label="Saqlanganlar"
            value={String(courses.length + teachers.length)}
            hint={`${courses.length} ta kurs · ${teachers.length} ta ustoz`}
            icon={Heart}
          />
          <StatCard
            href="/dashboard/profile"
            label="Profil maydonlari"
            value={`${completeness.filled}/${completeness.total}`}
            hint={
              completeness.complete
                ? "Barcha maydonlar to‘ldirilgan"
                : `To‘ldirilmagan: ${completeness.missing.length} ta`
            }
            icon={UserRound}
          />
        </div>
      </section>

      {/* --------------------------- next action ---------------------------- */}
      <section aria-labelledby="dash-next">
        <Card className="depth-featured flex flex-col gap-2">
          <Badge variant="accent">Tavsiya etilgan qadam</Badge>
          <h2 id="dash-next" className="text-xl font-semibold text-ink-900">
            {nextAction.title}
          </h2>
          <p className="max-w-prose text-base leading-relaxed text-ink-700">
            {nextAction.body}
          </p>
          <div className="mt-2">
            <ButtonLink
              href={nextAction.href}
              variant="primary"
              trailingIcon={<ArrowRight aria-hidden="true" />}
            >
              {nextAction.cta}
            </ButtonLink>
          </div>
        </Card>
      </section>

      {/* ----------------------------- request ------------------------------ */}
      <section aria-labelledby="dash-request" className="flex flex-col gap-4">
        <h2 id="dash-request" className="text-xl font-semibold text-ink-900">
          Joriy yozilish so‘rovi
        </h2>
        {request ? (
          <RequestCard request={request} />
        ) : (
          <EmptyState title="Hozircha so‘rov yo‘q">
            Siz hali birorta kursga yozilish jarayonini boshlamagansiz. Mos
            kursni tanlab, guruh va jadval bilan so‘rov tayyorlashingiz mumkin.
            <p className="mt-3">
              <Link
                href="/courses"
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                Kurslarni ko‘rish
              </Link>
            </p>
          </EmptyState>
        )}
      </section>
    </div>
  );
}
