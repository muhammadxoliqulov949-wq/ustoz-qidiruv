import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "accent" | "success" | "warning" | "danger";
type Tone = "solid" | "soft";
type Size = "sm" | "md";

const variantClasses: Record<Variant, Record<Tone, string>> = {
  neutral: {
    soft: "bg-ink-900/[0.055] text-ink-700 ring-line ring-1 ring-inset",
    solid: "bg-ink-900 text-white",
  },
  accent: {
    soft: "bg-accent-50 text-accent-700",
    solid: "bg-accent-600 text-white",
  },
  success: {
    soft: "bg-[#e9f7ee] text-[#157a3d]",
    solid: "bg-success text-white",
  },
  warning: {
    soft: "bg-[#fdf3e3] text-[#9a6207]",
    solid: "bg-warning text-white",
  },
  danger: {
    soft: "bg-[#fdeceb] text-[#b42318]",
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
        "inline-flex items-center justify-center rounded-pill font-medium whitespace-nowrap",
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
