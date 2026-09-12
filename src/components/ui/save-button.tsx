"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface SaveButtonProps {
  /** Entity title, used to build the full accessible label. */
  title: string;
  className?: string;
}

/**
 * Independent toggle inside clickable surfaces (course cards…).
 * Lives above the stretched card link (z-index), stops propagation so
 * saving never triggers navigation. aria-pressed announces state;
 * persistence arrives with the auth/API phase.
 */
export function SaveButton({ title, className }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Saqlangan: ${title}` : `Saqlash: ${title}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setSaved((value) => !value);
      }}
      className={cn(
        // Position (absolute over the media band) is set by the consumer —
        // z-10 alone keeps it above the stretched card link.
        "z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-pill",
        "bg-surface/95 text-ink-700 shadow-sm ring-1 ring-ink-900/[0.06] backdrop-blur-[2px]",
        "transition-[color,background-color] duration-fast hover:text-accent-600",
        "[&>svg]:size-[18px] [&>svg]:stroke-[1.75]",
        focusRing,
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        className={cn(
          "transition-[fill,color] duration-fast",
          saved && "fill-accent-600 text-accent-600",
        )}
      />
    </button>
  );
}
