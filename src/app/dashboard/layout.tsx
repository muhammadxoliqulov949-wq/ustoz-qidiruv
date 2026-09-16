import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { OnboardingProvider } from "@/components/onboarding/draft-store";
import { DashboardIdentity } from "@/components/dashboard/dashboard-identity";
import {
  DashboardSidebarNav,
  DashboardTabNav,
} from "@/components/dashboard/dashboard-nav";
import { RoleNotice } from "@/components/dashboard/role-notice";
import { requireRolePage } from "@/server/auth/guards";
import { getStudentProfile } from "@/server/repo";
import { countUnreadMessages } from "@/server/messaging-service";

/* -------------------------------------------------------------------------- */
/* /dashboard — the STUDENT application shell (Phase 8).                        */
/*                                                                                */
/* Architecture:                                                                  */
/*  • Server layout. The only client islands are the identity area, the two       */
/*    navs (need usePathname) and the role notice — the shell chrome itself is    */
/*    static markup.                                                              */
/*  • <OnboardingProvider> is mounted ONCE here so every dashboard screen reads   */
/*    the same Phase 6 prototype draft (no second provider, no copied state).     */
/*  • The marketing header/footer from the root layout stay exactly as they are;  */
/*    the dashboard adds its own in-page shell rather than redesigning them.      */
/*                                                                                */
/* Phase 11: the shell is now GATED. `requireRolePage("student")` resolves the    */
/* session cookie on the server before anything renders — anonymous visitors are  */
/* sent to /login?next=/dashboard and teachers are bounced to their own panel.    */
/* The identity block is server-rendered from the profile row, so no screen in    */
/* this tree derives identity from localStorage any more.                         */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: {
    default: "Kabinet",
    template: "%s · Kabinet",
  },
  description:
    "USTOZ o‘quvchi kabineti — yozilish so‘rovlari, saqlangan kurslar va profil.",
  robots: { index: false, follow: true },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireRolePage("student", "/dashboard");
  /*
   * Phase 16: the message badge is rendered by the shell on every page. It is a
   * request-time read of the DB read markers — no polling, no client store —
   * so it updates on navigation, on a refresh and after any mutation that
   * revalidates the surface.
   */
  const [profile, unreadMessages] = await Promise.all([
    getStudentProfile(user.id),
    countUnreadMessages(user.id),
  ]);
  return (
    <OnboardingProvider>
      <div className="site-container py-8 lg:py-12">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* ------------------------------ sidebar ------------------------------ */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
              <DashboardIdentity
                name={profile?.name ?? ""}
                onboardingCompleted={profile?.onboardingCompleted ?? false}
              />
            </div>
            <DashboardSidebarNav unreadMessages={unreadMessages} />
            <p className="text-sm leading-relaxed text-ink-500 max-lg:hidden">
              Kabinet hisobingizga bog‘langan. Saqlangan kurslar hozircha shu
              brauzerda saqlanadi. Pullik kurslarga to‘lov so‘rovingiz qabul
              qilingandan so‘ng amalga oshiriladi.
            </p>
            <Link
              href="/courses"
              className="text-sm font-medium text-accent-700 underline underline-offset-2 max-lg:hidden"
            >
              Kurslarni ko‘rish
            </Link>
          </div>

          {/* ------------------------------ content ------------------------------ */}
          <div className="flex min-w-0 flex-col gap-6">
            <DashboardTabNav unreadMessages={unreadMessages} />
            <RoleNotice />
            {children}
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
