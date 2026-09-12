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
/*  • Not indexable and honest about the missing session: nothing here claims     */
/*    the visitor is authenticated.                                               */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: {
    default: "Kabinet",
    template: "%s · Kabinet",
  },
  description:
    "USTOZ o‘quvchi kabineti — yozilish so‘rovlari, saqlangan kurslar va profil (frontend prototipi).",
  robots: { index: false, follow: true },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingProvider>
      <div className="site-container py-8 lg:py-12">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* ------------------------------ sidebar ------------------------------ */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-28">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
              <DashboardIdentity />
            </div>
            <DashboardSidebarNav />
            <p className="text-sm leading-relaxed text-ink-500 max-lg:hidden">
              Bu kabinet brauzeringizdagi prototip holatidan o‘qiydi. Haqiqiy
              hisob, server va to‘lov keyingi bosqichlarda ulanadi.
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
            <DashboardTabNav />
            <RoleNotice />
            {children}
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
