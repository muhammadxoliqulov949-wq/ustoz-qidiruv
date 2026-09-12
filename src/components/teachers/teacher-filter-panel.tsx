"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { cn, focusRing } from "@/lib/utils";
import { teachersPage } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* TeacherFilterPanel — same URL-state recipe as the Phase 3 FilterPanel         */
/* (one client island, shared by the desktop sidebar and the mobile sheet):      */
/* every option is a real <a href> built server-side from lib/teacher-search;   */
/* clicks route through router.replace so facets never pollute the back-stack.  */
/* No price-range form here — teacher pricing is shown per card, derived from    */
/* their courses; a range slider would filter on invented numbers.               */
/* -------------------------------------------------------------------------- */

export interface TeacherFilterOption {
  label: string;
  href: string;
  selected: boolean;
}

export interface TeacherFilterSection {
  key: string;
  title: string;
  options: TeacherFilterOption[];
}

export interface TeacherFilterPanelProps {
  sections: TeacherFilterSection[];
  hasActiveFilters: boolean;
  clearHref: string;
  variant: "sidebar" | "sheet";
}

export function TeacherFilterPanel({
  sections,
  hasActiveFilters,
  clearHref,
  variant,
}: TeacherFilterPanelProps) {
  const router = useRouter();

  const body = (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          <h3 className="text-sm font-semibold text-ink-900">{section.title}</h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {section.options.map((option) => (
              <Pill
                key={option.href + option.label}
                as="link"
                href={option.href}
                selected={option.selected}
                className="w-fit"
                onClick={(event) => {
                  event.preventDefault();
                  router.replace(option.href);
                }}
              >
                {option.label}
              </Pill>
            ))}
          </div>
        </section>
      ))}

      {hasActiveFilters ? (
        <p className="border-t border-line pt-4">
          {variant === "sheet" ? (
            <button
              type="button"
              onClick={() => router.replace(clearHref)}
              className={cn(
                "rounded-md text-sm font-medium text-accent-700 underline-offset-4 hover:underline",
                focusRing,
              )}
            >
              {teachersPage.clearFilters}
            </button>
          ) : (
            <Link
              href={clearHref}
              onClick={(event) => {
                event.preventDefault();
                router.replace(clearHref);
              }}
              className={cn(
                "rounded-md text-sm font-medium text-accent-700 underline-offset-4 hover:underline",
                focusRing,
              )}
            >
              {teachersPage.clearFilters}
            </Link>
          )}
        </p>
      ) : null}
    </div>
  );

  if (variant === "sidebar") {
    return <Card className="p-5">{body}</Card>;
  }
  return body;
}
