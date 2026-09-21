"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the CURRENT item of a horizontally scrollable strip inside the visible
 * area (Phase 24 mobile navigation fix).
 *
 * WHY IT EXISTS
 *   The student, teacher and admin workspaces all render their section list as
 *   a full-bleed tab strip that scrolls sideways below `lg`. At 360px the strip
 *   is ~970–1330px of content in a 320px window, and the scrollbar is hidden by
 *   design — so on a deep link (or after a client-side navigation) the selected
 *   tab was very often parked off-screen to the right. The page still said
 *   `aria-current="page"`, but nothing on screen agreed with it: the user had no
 *   way to tell which section they were in without swiping blind.
 *
 * CONTRACT
 *   • Scrolls the STRIP, never `scrollIntoView()` on the item: the strip lives
 *     inside a page that may itself be mid-scroll, and scrollIntoView would drag
 *     the document along with it (the same reason course-detail/SectionNav
 *     scrolls its rail by hand).
 *   • Centres the active item, clamped to the real scroll range.
 *   • No-op when the strip is not actually overflowing (desktop widths, short
 *     label sets) so nothing shifts where nothing needs to.
 *   • Honours `prefers-reduced-motion` — instant jump instead of a glide.
 *
 * @param dependency re-runs the alignment when the route changes.
 */
export function useActiveStripItem<T extends HTMLElement>(
  dependency: string,
): React.RefObject<T | null> {
  const stripRef = useRef<T>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    if (strip.scrollWidth <= strip.clientWidth + 1) return;

    const stripRect = strip.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const delta =
      activeRect.left - stripRect.left - (strip.clientWidth - activeRect.width) / 2;
    const next = Math.max(
      0,
      Math.min(strip.scrollLeft + delta, strip.scrollWidth - strip.clientWidth),
    );
    if (Math.abs(next - strip.scrollLeft) < 2) return;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: next, behavior: reduceMotion ? "auto" : "smooth" });
  }, [dependency]);

  return stripRef;
}
