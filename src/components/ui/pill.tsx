"use client";

import { useId, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Pill — the interactive compact choice (quick filters, future facets).      */
/* Two shapes, one skin:                                                      */
/*   as="button"  toggle-able option (renders real <input type=checkbox>)     */
/*   as="link"    navigational filter (real <a>, App Router prefetch)         */
/* -------------------------------------------------------------------------- */

const shell = cn(
  "inline-flex h-9 items-center gap-xs rounded-pill px-3.5 text-sm font-medium whitespace-nowrap",
  "border transition-[background-color,border-color,color,box-shadow] duration-fast select-none",
  focusRing,
);

const restState =
  "border-line-strong bg-surface text-ink-700 shadow-xs hover:border-ink-300 hover:text-ink-900";
const selectedState =
  "border-accent-600 bg-accent-50 text-accent-700 shadow-none";

function PillIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4 [&>svg]:stroke-[1.75]"
    >
      {children}
    </span>
  );
}

function PillCheck({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <PillIcon>
      <Check className="size-4" strokeWidth={2.5} />
    </PillIcon>
  );
}

/* -------------------------------------------------------------------------- */

interface PillLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "className"> {
  as?: "link"; // consumed by <Pill>, never reaches the DOM
  selected?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Navigational pill (e.g. “Online” → /courses?mode=online). */
export function PillLink({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` is the union discriminator; consumed by <Pill>, must not reach the DOM
  as: _as = "link",
  selected = false,
  leadingIcon,
  className,
  children,
  ...rest
}: PillLinkProps) {
  return (
    <Link
      aria-current={selected ? "true" : undefined}
      data-selected={selected || undefined}
      className={cn(shell, selected ? selectedState : restState, className)}
      {...rest}
    >
      {leadingIcon ? <PillIcon>{leadingIcon}</PillIcon> : null}
      {!leadingIcon && selected ? <PillCheck selected={selected} /> : null}
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */

interface PillToggleProps
  extends Omit<
    ComponentPropsWithoutRef<"label">,
    "className" | "children" | "onChange"
  > {
  as: "button";
  /** Controlled selection state. */
  selected?: boolean;
  /** Controlled handler… */
  onChange?: (selected: boolean) => void;
  /** …or fully uncontrolled with an initial value. */
  defaultSelected?: boolean;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Toggle pill. Renders a real checkbox input (visually hidden) so it
 * behaves like a native control for keyboards, screen readers and forms.
 */
export function PillToggle({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` is the union discriminator; consumed by <Pill>, must not reach the DOM
  as: _as,
  selected,
  onChange,
  defaultSelected = false,
  leadingIcon,
  disabled,
  className,
  children,
  ...rest
}: PillToggleProps) {
  const inputId = useId();
  const isControlled = selected !== undefined;
  const [internal, setInternal] = useState(defaultSelected);
  const isChecked = isControlled ? selected : internal;

  const handleChange = (next: boolean) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <label
      htmlFor={inputId}
      data-selected={isChecked ? true : undefined}
      className={cn(
        shell,
        "cursor-pointer",
        isChecked ? selectedState : restState,
        disabled && "pointer-events-none opacity-55",
        className,
      )}
      {...rest}
    >
      <input
        id={inputId}
        type="checkbox"
        className="sr-only"
        checked={isChecked}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.checked)}
      />
      {leadingIcon ? <PillIcon>{leadingIcon}</PillIcon> : <PillCheck selected={isChecked} />}
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */

export type PillProps = PillLinkProps | PillToggleProps;

/**
 * Single entry point; `as` selects the shape:
 *   <Pill as="button" ...>  toggle
 *   <Pill as="link" href>   navigational filter
 */
export function Pill(props: PillProps) {
  return props.as === "button" ? (
    <PillToggle {...props} />
  ) : (
    <PillLink {...props} />
  );
}
