import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { OnboardingProvider } from "@/components/onboarding/draft-store";
import { TeacherIdentityPanel } from "@/components/teacher-dashboard/identity-panel";
import {
  TeacherSidebarNav,
  TeacherTabNav,
} from "@/components/teacher-dashboard/teacher-nav";
import { requireRolePage } from "@/server/auth/guards";
import { countUnreadMessages } from "@/server/messaging-service";
import { countUnreadNotifications } from "@/server/notification-service";
import { getTeacherProfile } from "@/server/repo";

/* -------------------------------------------------------------------------- */
/* /teacher/dashboard — the TEACHER application shell (Phase 9).                */
/*                                                                                */
/* Route choice: a dedicated `/teacher/dashboard` segment rather than nesting    */
/* under the Phase 8 `/dashboard` tree. The student cabinet is locked and its    */
/* layout/nav/not-found are student-specific; a sibling segment keeps the two    */
/* role domains separate at the routing level too (own layout, own nav model,    */
/* own 404), which is exactly the separation the phase brief requires.           */
/*                                                                                */
/* Phase 11: the shell is GATED by `requireRolePage("teacher")`. The Phase 9     */
/* WORKSPACE PICKER IS GONE AS AN IDENTITY SOURCE — the panel now shows the      */
/* signed-in teacher resolved from the session cookie on the server. Selecting   */
/* "who you are" from a localStorage-backed dropdown could never be an           */
/* authorization decision, so it is no longer offered at all.                    */
/*                                                                                */
/* Architecture mirrors Phase 8: server layout, client islands only for the      */
/* the two navs (usePathname).                                                   */
/* <OnboardingProvider> mounts once so every teacher screen reads the same       */
/* Phase 6 draft. The marketing header/footer are untouched.                      */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: {
    default: "Ustoz paneli",
    template: "%s · Ustoz paneli",
  },
  description:
    "USTOZ ustoz paneli — kurslar, guruhlar va profil holati.",
  robots: { index: false, follow: true },
};

export default async function TeacherDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRolePage("teacher", "/teacher/dashboard");
  // Phase 16: unread-message badge, derived from the read markers on the server.
  const [profile, unreadMessages, unreadNotifications] = await Promise.all([
    getTeacherProfile(user.id),
    countUnreadMessages(user.id),
    countUnreadNotifications(user.id),
  ]);
  return (
    <OnboardingProvider>
      <div className="site-container py-8 lg:py-12">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* ------------------------------ sidebar ------------------------------ */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
              <TeacherIdentityPanel
                name={profile?.name ?? ""}
                verification={profile?.verification ?? "unverified"}
                onboardingCompleted={profile?.onboardingCompleted ?? false}
              />
            </div>
            <TeacherSidebarNav unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
            <p className="text-sm leading-relaxed text-ink-500 max-lg:hidden">
              Panel hisobingizga bog‘langan. Yozilish so‘rovlarini shu yerda
              qabul qilasiz yoki rad etasiz. To‘lovlar o‘quvchi tomonidan
              amalga oshiriladi.
            </p>
            <Link
              href="/teachers"
              className="-my-1 inline-block py-1 text-sm font-medium text-accent-700 underline underline-offset-2 max-lg:hidden"
            >
              Ommaviy ustozlar sahifasi
            </Link>
          </div>

          {/* ------------------------------ content ------------------------------ */}
          <div className="flex min-w-0 flex-col gap-6">
            <TeacherTabNav unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
            {children}
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
