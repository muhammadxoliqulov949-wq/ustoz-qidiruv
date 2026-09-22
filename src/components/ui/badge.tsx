import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "accent" | "success" | "warning" | "danger";
type Tone = "solid" | "soft";
type Size = "sm" | "md";

const variantClasses: Record<Variant, Record<Tone, string>> = {
  neutral: {
    soft: "bg-white/[0.07] text-ink-700 ring-white/10 ring-1 ring-inset backdrop-blur-sm",
    solid: "bg-white text-[#0A1411]",
  },
  accent: {
    soft: "bg-accent-50 text-accent-400 ring-accent-600/20 ring-1 ring-inset",
    solid: "bg-accent-600 text-white",
  },
  success: {
    soft: "bg-success-soft text-success-ink ring-white/5 ring-1 ring-inset",
    solid: "bg-success text-white",
  },
  warning: {
    soft: "bg-warning-soft text-warning-ink ring-white/5 ring-1 ring-inset",
    solid: "bg-amber-500 text-[#1A1200]",
  },
  danger: {
    soft: "bg-danger-soft text-danger-ink ring-white/5 ring-1 ring-inset",
    solid: "bg-danger text-white",
  },
};

const sizeClasses: Record<Size, string> = {
  sm: "gap-1 px-2 py-px text-xs",
  md: "gap-1.5 px-2.5 py-0.5 text-sm",
};

export interface BadgeProps
  extends Omit<ComponentPropsWithoutRef<"span">, "className"> {
  variant?: Variant;
  tone?: Tone;
  size?: Size;
  /** Leading status dot (e.g. “online”, “new”). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Small status/metadata label. Inline element — safe inside headings,
 * card rows and lists. The one badge in the system (no separate Chip).
 */
export function Badge({
  variant = "neutral",
  tone = "soft",
  size = "sm",
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "motion-status inline-flex items-center justify-center rounded-pill font-medium whitespace-nowrap",
        sizeClasses[size],
        variantClasses[variant][tone],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-pill bg-current opacity-80",
            variant === "success" && "animate-pulse",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
