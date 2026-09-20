"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  History,
  LayoutGrid,
  LifeBuoy,
  MessageSquareQuote,
  RotateCcw,
  Settings,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn, focusRing } from "@/lib/utils";
import { useActiveStripItem } from "@/lib/use-active-strip-item";
import { ADMIN_NAV, isActiveAdminNav, type AdminNavItem } from "@/lib/admin-workspace";

/* -------------------------------------------------------------------------- */
/* Admin navigation — Phase 15.                                                */
/*                                                                              */
/* ONE model (lib/admin-workspace.ADMIN_NAV) rendered in two shapes: a desktop   */
/* rail and a horizontally scrollable tab strip. Same accessibility contract as   */
/* the student/teacher navs — real nav/ul/a landmarks, `aria-current="page"`,    */
/* and the active item is marked by weight + a rail/underline as well as colour. */
/*                                                                              */
/* The COUNT BADGE is a factual number handed down by the server layout, not     */
/* client state: it can only ever show what the database said at render time.    */
/* Zero is shown as no badge at all, so the rail is not noisy on a quiet day.    */
/* -------------------------------------------------------------------------- */

const icons: Record<AdminNavItem["icon"], ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  teachers: UserRoundCheck,
  courses: BookOpen,
  // Phase 19 — the review moderation queue. Publishing a review is what makes it
  // public and what moves a course's and a teacher's rating, so it is real work.
  reviews: MessageSquareQuote,
  // Phase 17 — the refund queue, which is work nobody can do by waiting: the
  // provider performs the money movement only after an admin approves it.
  refunds: RotateCcw,
  support: LifeBuoy,
  users: Users,
  notifications: Bell,
  settings: Settings,
  activity: History,
};

export interface AdminNavCounts {
  teachers?: number;
  courses?: number;
  /** Reviews waiting for a publish/reject decision. */
  reviews?: number;
  /** Live refund requests: `requested` + `awaiting_provider`. */
  refunds?: number;
  support?: number;
  notifications?: number;
}

function badgeFor(item: AdminNavItem, counts: AdminNavCounts | undefined): number | null {
  if (!counts) return null;
  if (item.icon === "teachers") return counts.teachers && counts.teachers > 0 ? counts.teachers : null;
  if (item.icon === "courses") return counts.courses && counts.courses > 0 ? counts.courses : null;
  if (item.icon === "reviews") return counts.reviews && counts.reviews > 0 ? counts.reviews : null;
  if (item.icon === "refunds") return counts.refunds && counts.refunds > 0 ? counts.refunds : null;
  if (item.icon === "support") return counts.support && counts.support > 0 ? counts.support : null;
  if (item.icon === "notifications") return counts.notifications && counts.notifications > 0 ? counts.notifications : null;
  return null;
}

function CountBadge({ value, label = "kutilmoqda" }: { value: number; label?: string }) {
  return (
    <span className="ms-auto rounded-pill bg-accent-600 px-2 py-px text-xs font-semibold text-white tabular-nums">
      {value}
      <span className="sr-only"> ta {label}</span>
    </span>
  );
}

export function AdminSidebarNav({ counts }: { counts?: AdminNavCounts }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administrator paneli" className="max-lg:hidden">
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV.map((item) => {
          const Icon = icons[item.icon];
          const active = isActiveAdminNav(pathname, item.href);
          const pending = badgeFor(item, counts);
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
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 bottom-2 left-0 w-[3px] rounded-pill",
                    active ? "bg-accent-600" : "bg-transparent",
                  )}
                />
                <Icon className="size-[18px] shrink-0" />
                {item.label}
                {pending ? <CountBadge value={pending} label={item.icon === "notifications" ? "o‘qilmagan bildirishnoma" : undefined} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminTabNav({ counts }: { counts?: AdminNavCounts }) {
  const pathname = usePathname();
  // Phase 24: at 360px the strip is far wider than the window and its
  // scrollbar is hidden, so bring the current section into view.
  const stripRef = useActiveStripItem<HTMLUListElement>(pathname);
  return (
    <nav
      aria-label="Administrator paneli"
      className="-mx-5 border-b border-line px-5 md:-mx-8 md:px-8 lg:hidden"
    >
      <ul
          ref={stripRef}
          className="flex gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        {ADMIN_NAV.map((item) => {
          const Icon = icons[item.icon];
          const active = isActiveAdminNav(pathname, item.href);
          const pending = badgeFor(item, counts);
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
                {pending ? <CountBadge value={pending} label={item.icon === "notifications" ? "o‘qilmagan bildirishnoma" : undefined} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
