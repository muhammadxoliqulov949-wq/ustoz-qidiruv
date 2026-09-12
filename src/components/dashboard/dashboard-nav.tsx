"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Heart, LayoutGrid, UserRound, Bell } from "lucide-react";
import type { ComponentType } from "react";
import { cn, focusRing } from "@/lib/utils";
import { isActiveNav, STUDENT_NAV, type DashNavItem } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* Dashboard navigation — ONE nav model (lib/dashboard.STUDENT_NAV) rendered    */
/* in two shapes: a desktop sidebar rail (lg+) and a horizontally scrollable     */
/* tab strip below it. Both are real <nav><ul><a> lists, both mark the active   */
/* page with aria-current="page" plus a non-colour cue (weight + left/bottom    */
/* marker), so selection is never colour-only.                                  */
/* The marketing header is untouched — this is the dashboard's own shell.       */
/* -------------------------------------------------------------------------- */

const icons: Record<DashNavItem["icon"], ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  requests: Bookmark,
  saved: Heart,
  profile: UserRound,
  notifications: Bell,
};

export function DashboardSidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="O‘quvchi paneli" className="max-lg:hidden">
      <ul className="flex flex-col gap-1">
        {STUDENT_NAV.map((item) => {
          const Icon = icons[item.icon];
          const active = isActiveNav(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg py-2.5 pr-3 pl-4 text-base",
                  "transition-colors duration-fast",
                  active
                    ? "bg-accent-50 font-semibold text-accent-700"
                    : "font-medium text-ink-700 hover:bg-ink-900/[0.045] hover:text-ink-900",
                  focusRing,
                )}
              >
                {/* Non-colour active cue. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 bottom-2 left-0 w-[3px] rounded-pill",
                    active ? "bg-accent-600" : "bg-transparent",
                  )}
                />
                <Icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardTabNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="O‘quvchi paneli"
      className={cn(
        // Full-bleed to the site-container gutters at every breakpoint so the
        // scrollable strip never creates a horizontal overflow seam.
        "-mx-5 border-b border-line px-5 md:-mx-8 md:px-8 lg:hidden",
      )}
    >
      <ul className="flex gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STUDENT_NAV.map((item) => {
          const Icon = icons[item.icon];
          const active = isActiveNav(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-3 text-base whitespace-nowrap",
                  "transition-colors duration-fast",
                  active
                    ? "border-accent-600 font-semibold text-accent-700"
                    : "border-transparent font-medium text-ink-700 hover:text-ink-900",
                  focusRing,
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
