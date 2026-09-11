"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Native <select> that reads/writes ONE URL param — no component state, so     */
/* back/forward and shared links behave exactly like the pill links. A native    */
/* control keeps the OS picker on mobile (keyboard/screen-reader safe) and       */
/* avoids hand-rolled popover mechanics per the “no new interaction systems”      */
/* rule. Used for city + sort on the browse pages.                              */
/* -------------------------------------------------------------------------- */

export interface UrlSelectOption {
  value: string;
  label: string;
}

export interface UrlSelectProps {
  /** Visible + accessible label (rendered as a real <label>). */
  label: string;
  /** URL param this control owns. */
  paramName: string;
  options: UrlSelectOption[];
  /** The value that “owns no param” (canonical default URL). */
  defaultValue: string;
  /** Route the query belongs to: /courses or /categories/<slug>. */
  basePath: string;
  className?: string;
}

export function UrlSelect({
  label,
  paramName,
  options,
  defaultValue,
  basePath,
  className,
}: UrlSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = useId();

  const current = searchParams.get(paramName) ?? defaultValue;

  const handleChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) next.delete(paramName);
    else next.set(paramName, value);
    const query = next.toString();
    router.push(`${basePath}${query ? `?${query}` : ""}`);
  };

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-ink-500",
        className,
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="relative inline-flex items-center">
        <select
          id={id}
          value={current}
          onChange={(event) => handleChange(event.target.value)}
          className={cn(
            "h-9 appearance-none rounded-pill border border-line-strong bg-surface",
            "py-0 pl-3.5 pr-8 text-sm font-medium text-ink-700",
            "transition-colors duration-fast hover:border-ink-300 hover:text-ink-900",
            focusRing,
          )}
        >
          {options.map((option) => (
            <option key={option.value || "default"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 size-4 text-ink-400"
        />
      </span>
    </label>
  );
}
