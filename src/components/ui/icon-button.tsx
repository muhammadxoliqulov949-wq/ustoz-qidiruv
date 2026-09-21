import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn, focusRing } from "@/lib/utils";

type Variant = "ghost" | "outline" | "solid" | "onDark";
type Size = "sm" | "md" | "lg";

/**
 * Dimensions follow --size-control-* but shrink slightly at the smallest
 * size so icon buttons can sit inside compact toolbars.
 */
const boxClasses: Record<Size, string> = {
  sm: "size-8 rounded-md",
  md: "size-[var(--size-control-md)] rounded-lg",
  lg: "size-[var(--size-control-lg)] rounded-lg",
};

const variantClasses: Record<Variant, string> = {
  ghost: "text-ink-700 hover:bg-ink-900/[0.05] active:bg-ink-900/[0.08]",
  outline:
    "border border-line-strong bg-surface text-ink-700 hover:border-ink-300 hover:bg-surface-muted",
  solid: "bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-700",
  /** For controls sitting on the dark header/hero surfaces. */
  onDark:
    "text-white/80 hover:bg-white/10 hover:text-white active:bg-white/15",
};

export interface IconButtonProps
  extends Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> {
  /**
   * Accessible name. Screen readers and tooltips both rely on it —
   * icon-only controls are never unlabeled in this design system.
   */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

/**
 * Icon-only control (menu, close, search submit in compact layouts).
 * Renders the icon visually and exposes `label` as the accessible name.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      variant = "ghost",
      size = "md",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "motion-control inline-flex shrink-0 items-center justify-center select-none",
          "transition-colors duration-fast",
          "disabled:pointer-events-none disabled:opacity-55",
          "[&>svg]:size-5 [&>svg]:shrink-0",
          boxClasses[size],
          variantClasses[variant],
          focusRing,
          className,
        )}
        {...rest}
      >
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      </button>
    );
  },
);
