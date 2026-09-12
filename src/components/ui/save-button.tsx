"use client";

import { Heart } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { useSavedStore } from "@/components/saved/saved-store";
import type { SavedKind } from "@/lib/saved";

export interface SaveButtonProps {
  /** Entity title, used to build the full accessible label. */
  title: string;
  /** What is being saved — courses and teachers live in separate id lists. */
  kind: SavedKind;
  /** CANONICAL dataset id (course.id / teacher.id). Never a slug copy. */
  entityId: string;
  className?: string;
}

/**
 * Independent toggle inside clickable surfaces (course/teacher cards…).
 * Lives above the stretched card link (z-index), stops propagation so
 * saving never triggers navigation. aria-pressed announces state.
 *
 * State comes from the ONE saved store (components/saved/saved-store.ts) —
 * prototype localStorage holding canonical ids only. Until hydration the
 * button renders the unsaved state, matching SSR exactly.
 */
export function SaveButton({ title, kind, entityId, className }: SaveButtonProps) {
  const { ready, has, toggle } = useSavedStore();
  const saved = ready && has(kind, entityId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Saqlangan: ${title}` : `Saqlash: ${title}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(kind, entityId);
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
