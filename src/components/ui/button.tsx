import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Variants — defined once here; every consumer (nav CTA, hero, forms) uses   */
/* these. Do not replicate these class strings outside this file.             */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "invert";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-fast " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&>svg]:size-[1.15em] [&>svg]:shrink-0";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent-600 text-white shadow-xs hover:bg-accent-500 active:bg-accent-700 active:scale-[0.99]",
  secondary:
    "bg-ink-900 text-white shadow-xs hover:bg-ink-700 active:bg-ink-900 active:scale-[0.99]",
  outline:
    "border border-line-strong bg-surface text-ink-900 hover:border-ink-300 hover:bg-surface-muted active:bg-[#f1f1ee]",
  ghost: "text-ink-700 hover:bg-ink-900/[0.05] active:bg-ink-900/[0.08]",
  danger: "bg-danger text-white shadow-xs hover:bg-danger/90 active:bg-danger",
  /** On dark brand surfaces (emerald editorial cards). */
  invert:
    "bg-white text-accent-700 shadow-xs hover:bg-accent-50 active:bg-accent-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-[var(--size-control-sm)] px-3.5 text-sm",
  md: "h-[var(--size-control-md)] px-5 text-base",
  lg: "h-[var(--size-control-lg)] px-6 text-lg",
};

/* -------------------------------------------------------------------------- */

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "className"> {
  /** Appended after variant/size classes — extend, don't fight the system. */
  className?: string;
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables the button, and announces the busy state. */
  loading?: boolean;
  /** Full-width (search forms, mobile sheets). */
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * USTOZ Button — the only button in the design system.
 * Renders a native <button>; use <ButtonLink> for navigation.
 *
 * Responsive hiding: the base already sets `inline-flex`, and in v4 a plain
 * `hidden` class can lose to it (same layer, later sort). Always hide with
 * media variants instead — e.g. `max-lg:hidden`, never `hidden lg:flex`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        className={cn(
          base,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          focusRing,
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          leadingIcon
        )}
        {children}
        {loading ? null : trailingIcon}
      </button>
    );
  },
);

/* -------------------------------------------------------------------------- */

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "className"> {
  className?: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Navigation-styled exactly like Button (App Router <Link> wrapper).
 * Keeps <a href> semantics without losing the shared variant tokens.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  function ButtonLink(
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        className={cn(
          base,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          focusRing,
          className,
        )}
        {...rest}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </Link>
    );
  },
);
