import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { OnboardingProvider } from "@/components/onboarding/draft-store";
import { teacherWorkspaceOptions } from "@/data/teacher-dashboard";
import { TeacherIdentityPanel } from "@/components/teacher-dashboard/identity-panel";
import {
  TeacherSidebarNav,
  TeacherTabNav,
} from "@/components/teacher-dashboard/teacher-nav";

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard — the TEACHER application shell (Phase 9).                */
/*                                                                                */
/* Route choice: a dedicated `/teacher/dashboard` segment rather than nesting    */
/* under the Phase 8 `/dashboard` tree. The student cabinet is locked and its    */
/* layout/nav/not-found are student-specific; a sibling segment keeps the two    */
/* role domains separate at the routing level too (own layout, own nav model,    */
/* own 404), which is exactly the separation the phase brief requires.           */
/*                                                                                */
/* Architecture mirrors Phase 8: server layout, client islands only for the      */
/* identity/picker and the two navs (usePathname + prototype state).             */
/* <OnboardingProvider> mounts once so every teacher screen reads the same       */
/* Phase 6 draft. The marketing header/footer are untouched.                      */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: {
    default: "Ustoz paneli",
    template: "%s · Ustoz paneli",
  },
  description:
    "USTOZ ustoz paneli — kurslar, guruhlar va profil holati (frontend prototipi).",
  robots: { index: false, follow: true },
};

export default function TeacherDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="site-container py-8 lg:py-12">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* ------------------------------ sidebar ------------------------------ */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
              <TeacherIdentityPanel options={teacherWorkspaceOptions} />
            </div>
            <TeacherSidebarNav />
            <p className="text-sm leading-relaxed text-ink-500 max-lg:hidden">
              Panel katalogdagi haqiqiy kurs ma’lumotlarini ko‘rsatadi. Hisob,
              server, to‘lov va so‘rovlarni boshqarish keyingi bosqichlarda
              ulanadi.
            </p>
            <Link
              href="/teachers"
              className="text-sm font-medium text-accent-700 underline underline-offset-2 max-lg:hidden"
            >
              Ommaviy ustozlar sahifasi
            </Link>
          </div>

          {/* ------------------------------ content ------------------------------ */}
          <div className="flex min-w-0 flex-col gap-6">
            <TeacherTabNav />
            {children}
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
