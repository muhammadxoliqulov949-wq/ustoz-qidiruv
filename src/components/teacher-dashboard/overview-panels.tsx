"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { WorkspaceGate } from "./workspace-gate";
import { TeacherRequestCard } from "./request-card";
import { teacherStats, type TeacherDirectory } from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* Teacher overview — a status summary, not an analytics dashboard.             */
/* Every metric is a count/average that already exists in the canonical catalog  */
/* (courses, groups, remaining seats, rating) and each one carries a one-line    */
/* provenance hint. There is deliberately no revenue, payout, growth, conversion */
/* or teaching-hours figure, and no chart: none of those facts exist.             */
/* -------------------------------------------------------------------------- */

export function TeacherOverviewPanels({ directory, demoEnabled = false }: { directory: TeacherDirectory; demoEnabled?: boolean }) {
  return (
    <WorkspaceGate directory={directory} demoEnabled={demoEnabled} heading="Umumiy holat" minHeight="min-h-[42rem]">
      {(workspace, state) => {
        const stats = teacherStats(workspace);
        const request = state.requests[0] ?? null;

        const nextAction =
          workspace.courses.length === 0
            ? {
                title: "Demo katalogida kurs yo‘q",
                body: "Bu demo ustoz profiliga bog‘langan e’lon qilingan kurs topilmadi. Haqiqiy kurslaringizni “Kurslarim” bo‘limida boshqarasiz.",
                href: "/teachers/" + workspace.slug,
                cta: "Ommaviy profilni ko‘rish",
              }
            : !state.completeness.complete
              ? {
                  title: "Profil ma’lumotlarini to‘ldiring",
                  body: `${state.completeness.total} ta maydondan ${state.completeness.filled} tasi to‘ldirilgan. Qolgani: ${state.completeness.missing.join(", ")}.`,
                  href: "/teacher/dashboard/profile",
                  cta: "Profilni ochish",
                }
              : request
                ? {
                    title: "Demo: mahalliy so‘rov mavjud",
                    body: `“${request.courseTitle}” kursi uchun shu brauzerda tayyorlangan demo so‘rov bor. Bu server yozuvi emas.`,
                    href: "/teacher/dashboard/requests",
                    cta: "Haqiqiy so‘rovlarni ko‘rish",
                  }
                : {
                    title: "Kurs va guruhlarni tekshiring",
                    body: "Jadval, guruh va qolgan joylar hisobingizdagi haqiqiy ma’lumotdan olinadi — ularni Kurslarim bo‘limida ko‘rasiz.",
                    href: "/teacher/dashboard/courses",
                    cta: "Kurslarimni ochish",
                  };

        return (
          <div className="flex flex-col gap-8">
            <AuthNotice title="Bu — demo ko‘rinishi, hisobingiz emas">
              Quyidagi ko‘rsatkichlar —{" "}
              <Link
                href={`/teachers/${workspace.slug}`}
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                {workspace.name}
              </Link>{" "}
              demo profilining katalogdagi ma’lumotlari; hisobingizdagi haqiqiy
              holat yuqorida ko‘rsatiladi. Daromad, to‘lov va o‘sish
              statistikasi mavjud emas va o‘ylab topilmaydi.
            </AuthNotice>

            <section aria-labelledby="tw-stats">
              <h2 id="tw-stats" className="sr-only">
                Qisqa holat
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="metric-card flex flex-col gap-1">
                    <p className="text-sm font-medium text-ink-500">{stat.label}</p>
                    <p className="text-2xl font-semibold text-ink-900">{stat.value}</p>
                    <p className="text-sm text-ink-500">{stat.hint}</p>
                  </Card>
                ))}
              </div>
            </section>

            <section aria-labelledby="tw-next">
              <Card className="depth-featured flex flex-col gap-2">
                <Badge variant="accent">Tavsiya etilgan qadam</Badge>
                <h2 id="tw-next" className="text-xl font-semibold text-ink-900">
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

            <section aria-labelledby="tw-request" className="flex flex-col gap-4">
              <h2 id="tw-request" className="text-xl font-semibold text-ink-900">
                Demo: mahalliy so‘rov
              </h2>
              {request ? (
                <TeacherRequestCard request={request} />
              ) : (
                <Card variant="quiet" className="text-base leading-relaxed text-ink-700">
                  Shu brauzerda demo ustoz kurslariga tegishli yozilish
                  qoralamasi yo‘q. Bu bo‘lim faqat shu qurilmadagi demo
                  holatini ko‘rsatadi — haqiqiy so‘rovlar “So‘rovlar”
                  bo‘limida.
                </Card>
              )}
            </section>
          </div>
        );
      }}
    </WorkspaceGate>
  );
}
