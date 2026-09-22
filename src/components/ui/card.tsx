import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Card — one surface recipe, composed from parts.                             */
/*   <Card>                         padding via p-6 by default                */
/*   <Card variant="interactive">   hover + focus state, wraps a Link target  */
/*   <CardMedia>                    full-bleed top area (course cover, later) */
/* -------------------------------------------------------------------------- */

type Variant = "default" | "interactive" | "quiet";

const variantClasses: Record<Variant, string> = {
  default: "depth-card border-white/10 bg-surface shadow-sm",
  interactive:
    "motion-card depth-card border-white/10 bg-surface " +
    "hover:border-white/14 hover:shadow-raised hover:shadow-[0_12px_40px_-18px_rgb(0_0_0/0.7)] focus-within:border-accent-600/30 focus-within:ring-[length:var(--size-focus-ring)] focus-within:ring-accent-600/25",
  /** Quiet grouped surface */
  quiet: "depth-quiet border-white/10",
};

export interface CardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "className"> {
  variant?: Variant;
  /** Disable default padding when composing full-bleed media. */
  padded?: boolean;
  className?: string;
}

export function Card({
  variant = "default",
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        padded && "p-6",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Media band inside a Card. Always negative-margin'd against the Card
 * padding so media stays full-bleed without a `padded={false}` footgun.
 */
export function CardMedia({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { className?: string }) {
  return (
    <div
      className={cn(
        "relative -m-6 mb-0 aspect-[16/10] bg-surface-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface LinkCardProps {
  href: string;
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/**
 * A whole-card navigation target (future course/teacher cards).
 * Keeps real <a> semantics; the interactive ring is drawn by :focus-within
 * via the interactive variant.
 */
export function LinkCard({
  href,
  className,
  children,
  ...rest
}: LinkCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl outline-none",
        variantClasses.interactive,
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}
