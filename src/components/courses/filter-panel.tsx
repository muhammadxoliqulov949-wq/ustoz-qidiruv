"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Pill } from "@/components/ui";
import { cn, focusRing } from "@/lib/utils";
import { coursesPage } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* FilterPanel — the interactive filter controls, used identically in the        */
/* desktop sidebar and the mobile sheet (one client island, two containers).     */
/*                                                                               */
/* Every option is a REAL <a href> (right-clickable, copyable, keyboard-         */
/* operable) built server-side from the URL contract; a click just swaps the     */
/* navigation to router.replace so filtering feels instant, updates the URL      */
/* and never pollutes the back-stack with facet taps. Cross-route options        */
/* (categories) keep normal push behavior. No component state mirrors the URL — */
/* the URL is the state (see lib/course-search.ts).                            */
/* -------------------------------------------------------------------------- */

export interface FilterOptionData {
  label: string;
  href: string;
  selected: boolean;
  /** Opt out of replace (real navigation, e.g. category route changes). */
  push?: boolean;
}

export interface FilterSectionData {
  key: string;
  title: string;
  options: FilterOptionData[];
}

export interface FilterPanelProps {
  sections: FilterSectionData[];
  basePath: string;
  /** Seeded from the URL so the range inputs mirror canonical state. */
  priceMin: string;
  priceMax: string;
  hasActiveFilters: boolean;
  clearHref: string;
  variant: "sidebar" | "sheet";
}

function FilterOptionLink({ option }: { option: FilterOptionData }) {
  const router = useRouter();
  return (
    <Pill
      as="link"
      href={option.href}
      selected={option.selected}
      className="w-fit"
      onClick={
        option.push
          ? undefined
          : (event) => {
              event.preventDefault();
              router.replace(option.href);
            }
      }
    >
      {option.label}
    </Pill>
  );
}

/** Numeric-only input guard; empty string means “unbounded”. */
function sanitizeMoney(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function FilterPanel({
  sections,
  basePath,
  priceMin,
  priceMax,
  hasActiveFilters,
  clearHref,
  variant,
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [min, setMin] = useState(priceMin);
  const [max, setMax] = useState(priceMax);

  const applyRange = () => {
    const next = new URLSearchParams(searchParams.toString());
    if (min) next.set("pmin", min);
    else next.delete("pmin");
    if (max) next.set("pmax", max);
    else next.delete("pmax");
    const query = next.toString();
    router.replace(`${basePath}${query ? `?${query}` : ""}`);
  };

  const body = (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title}>
          <h3 className="text-sm font-semibold text-ink-900">{section.title}</h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {section.options.map((option) => (
              <FilterOptionLink key={option.href + option.label} option={option} />
            ))}
          </div>
          {/* Price range rides under the Narx section */}
          {section.key === "price" ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-500">
                {coursesPage.sections.range}
              </p>
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyRange();
                }}
              >
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-500">
                  {coursesPage.range.from}
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`Oylik narx, eng kam ${coursesPage.range.unit}da`}
                    value={min}
                    onChange={(event) => setMin(sanitizeMoney(event.target.value))}
                    placeholder="0"
                    className={cn(
                      "h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5",
                      "text-sm text-ink-900 placeholder:text-ink-400",
                      "transition-colors duration-fast hover:border-ink-300",
                      focusRing,
                    )}
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-500">
                  {coursesPage.range.to}
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`Oylik narx, eng ko‘p ${coursesPage.range.unit}da`}
                    value={max}
                    onChange={(event) => setMax(sanitizeMoney(event.target.value))}
                    placeholder="∞"
                    className={cn(
                      "h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5",
                      "text-sm text-ink-900 placeholder:text-ink-400",
                      "transition-colors duration-fast hover:border-ink-300",
                      focusRing,
                    )}
                  />
                </label>
                <Button type="submit" variant="outline" size="sm">
                  {coursesPage.range.apply}
                </Button>
              </form>
            </div>
          ) : null}
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
              {coursesPage.clearFilters}
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
              {coursesPage.clearFilters}
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
