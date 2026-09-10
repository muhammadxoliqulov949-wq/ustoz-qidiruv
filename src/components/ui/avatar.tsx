import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * `ring` size scales with the avatar so 24px and 40px avatars read
 * as the same object at any scale.
 */
const boxClasses: Record<Size, string> = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
};

const ringClasses: Record<Size, string> = {
  xs: "ring-2",
  sm: "ring-2",
  md: "ring-2",
  lg: "ring-[3px]",
  xl: "ring-4",
};

export interface AvatarProps
  extends Omit<ComponentPropsWithoutRef<"span">, "className" | "children"> {
  /** Display name — also the accessible name and the initials fallback. */
  name: string;
  src?: string | null;
  size?: Size;
  /** Optional trailing status dot (e.g. availability on teacher rows). */
  status?: "online" | "offline" | "away";
  /** Override the two-letter derivation (e.g. a logo mark). */
  fallback?: ReactNode;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

const statusColor: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-ink-300",
};

const statusSize: Record<Size, string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
  xl: "size-3.5",
};

/**
 * Person/brand avatar: image → graceful initials fallback, with an
 * optional availability dot. Deterministic tint keeps mock data calm.
 */
export function Avatar({
  name,
  src,
  size = "md",
  status,
  fallback,
  className,
  ...rest
}: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        "rounded-pill bg-accent-50 font-semibold text-accent-700 select-none",
        boxClasses[size],
        className,
      )}
      {...rest}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : (
        fallback ?? initials(name)
      )}

      {status ? (
        <span
          aria-label={status === "online" ? "Onlayn" : undefined}
          className={cn(
            "absolute right-0 bottom-0 rounded-pill ring-surface",
            statusSize[size],
            ringClasses[size],
            statusColor[status],
          )}
        />
      ) : null}
    </span>
  );
}
