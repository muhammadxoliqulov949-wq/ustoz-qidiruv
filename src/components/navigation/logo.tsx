import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * USTOZ wordmark. Text-based lockup for now; a vector logo slot replaces
 * the glyph square the day brand assets land (structure stays identical).
 */
export function Logo({
  href = "/",
  tone = "dark",
  className,
}: {
  href?: string;
  /** `light` for dark surfaces (future footer), `dark` for canvas. */
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="USTOZ — bosh sahifa"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg outline-none",
        "focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          "bg-accent-600 font-sans text-sm font-bold text-white",
          "transition-transform duration-fast group-hover:scale-105",
        )}
      >
        U
      </span>
      <span
        className={cn(
          "text-lg font-bold tracking-[0.14em]",
          tone === "light" ? "text-white" : "text-ink-900",
        )}
      >
        USTOZ
      </span>
    </Link>
  );
}
