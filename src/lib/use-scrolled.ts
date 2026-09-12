"use client";

import { useEffect, useState } from "react";

/**
 * True once the window has scrolled past `threshold` px.
 * Passive listener + rAF debounce; SSR-safe (starts false).
 * Used by the header to switch between its clean and floating surfaces.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return scrolled;
}
