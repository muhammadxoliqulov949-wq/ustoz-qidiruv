"use client";

import { forwardRef, useId, useState } from "react";
import type {
  ComponentPropsWithoutRef,
  FormEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import { Search, X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { fieldBaseClasses } from "./input";

type Size = "md" | "lg" | "xl";

const shellSize: Record<Size, string> = {
  md: "h-[var(--size-control-md)] rounded-pill pl-10 pr-2 text-base",
  lg: "h-[var(--size-control-lg)] rounded-pill pl-12 pr-2 text-lg",
  /** Hero search — deliberately larger than every other control. */
  xl: "h-16 rounded-pill pl-12 pr-2 text-lg sm:h-[4.5rem] sm:pl-14 sm:pr-2",
};

const clearButton: Record<Size, string> = {
  md: "right-1.5 size-7 rounded-md",
  lg: "right-2 size-9 rounded-lg",
  xl: "right-2 size-11 rounded-lg",
};

const searchIconPos: Record<Size, string> = {
  md: "left-3 size-[18px]",
  lg: "left-4 size-5",
  xl: "left-4 size-5 sm:left-5 sm:size-6",
};

/* -------------------------------------------------------------------------- */

export interface SearchInputProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "className" | "size" | "type" | "onChange" | "value" | "onSubmit"
  > {
  /** Accessible name — always required; visible label stays sr-only. */
  label: string;
  size?: Size;
  /** Controlled value… */
  value?: string;
  /** …and its companion (also fired on Escape / clear). */
  onValueChange?: (value: string) => void;
  /** Fired with the trimmed query on submit; empty submissions are ignored. */
  onSubmit?: (value: string) => void;
  className?: string;
}

/**
 * USTOZ search field — wraps the shared field skin (input.tsx) in a
 * <form role="search">, submits on Enter / button, clears on Escape / X.
 * Used by the header (md), hero (xl) and, later, listing pages (lg).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      label,
      size = "md",
      value,
      onValueChange,
      onSubmit,
      placeholder = "Nima o‘rganmoqchisiz?",
      className,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const inputId = useId();
    const [uncontrolled, setUncontrolled] = useState("");
    const isControlled = value !== undefined;
    const current = isControlled ? value : uncontrolled;

    const setValue = (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    };

    const clearAndRefocus = () => {
      setValue("");
      (ref as RefObject<HTMLInputElement | null>)?.current?.focus();
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const query = current.trim();
      if (query) onSubmit?.(query);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape" && current) {
        event.stopPropagation();
        setValue("");
      }
      onKeyDown?.(event);
    };

    return (
      <form
        role="search"
        onSubmit={handleFormSubmit}
        className={cn("relative w-full", className)}
      >
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>

        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400",
            searchIconPos[size],
          )}
        />

        <input
          ref={ref}
          id={inputId}
          type="search"
          name="q"
          autoComplete="off"
          placeholder={placeholder}
          value={current}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            fieldBaseClasses,
            shellSize[size],
            // Pill-shaped + slightly stronger presence than a plain Input
            "border-2 shadow-sm",
            size === "xl" && "shadow-raised",
            // Neutralize UA search-field decorations
            "[appearance:none] [&::-webkit-search-cancel-button]:hidden",
            "[&::-webkit-search-decoration]:hidden",
            focusRing,
          )}
          {...rest}
        />

        {current ? (
          <button
            type="button"
            aria-label="Qidiruvni tozalash"
            onClick={clearAndRefocus}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center",
              "rounded-pill text-ink-400 transition-colors duration-fast",
              "hover:bg-ink-900/[0.06] hover:text-ink-700",
              clearButton[size],
              focusRing,
            )}
          >
            <X
              aria-hidden="true"
              className={size === "xl" ? "size-5" : "size-4"}
            />
          </button>
        ) : null}

        {size === "xl" ? (
          <button
            type="submit"
            className={cn(
              "absolute top-1/2 right-2 hidden h-11 -translate-y-1/2 items-center gap-2",
              "rounded-lg bg-accent-600 px-4 text-base font-medium text-white",
              "transition-colors duration-fast hover:bg-accent-500 active:bg-accent-700",
              "sm:inline-flex",
              focusRing,
            )}
          >
            <Search aria-hidden="true" className="size-4" />
            Qidirish
          </button>
        ) : null}
      </form>
    );
  },
);
