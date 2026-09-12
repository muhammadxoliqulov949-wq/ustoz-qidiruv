"use client";

import { useEffect, useRef, useState } from "react";
import { cn, focusRing } from "@/lib/utils";

export interface CourseSection {
  id: string;
  label: string;
}

/**
 * In-page section navigation — semantic anchors, not tabs. A quiet strip
 * that sticks under the header on desktop (solid surface, hairline border,
 * no glass on the section itself) and stays in flow on mobile where the
 * rail scrolls horizontally. Active section is tracked with an
 * IntersectionObserver (no scroll listeners); clicks keep real anchor href
 * semantics but scroll with the sticky offset and rewrite the hash without
 * polluting history. Reduced motion → instant jumps.
 */
export function SectionNav({ sections }: { sections: CourseSection[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const indexById = new Map(sections.map((section, index) => [section.id, index]));
    const observer = new IntersectionObserver(
      (entries) => {
        // Whichever tracked section is crossing the reading band wins;
        // ties go to the topmost.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (indexById.get(a.target.id) ?? 0) - (indexById.get(b.target.id) ?? 0),
          );
        const first = visible[0];
        if (first) setActiveId(first.target.id);
      },
      // Reading band: from just under header+nav down to mid viewport.
      { rootMargin: "-152px 0px -55% 0px", threshold: 0 },
    );
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active item visible inside the horizontally scrollable rail.
  // Scroll the rail container itself — element.scrollIntoView() could drag
  // the whole page along and cancel the in-flight anchor jump.
  useEffect(() => {
    const rail = railRef.current;
    if (!activeId || !rail) return;
    const link = rail.querySelector<HTMLElement>(`[data-section="${activeId}"]`);
    if (!link) return;
    rail.scrollLeft = Math.max(
      0,
      link.offsetLeft - (rail.clientWidth - link.clientWidth) / 2,
    );
  }, [activeId]);

  return (
    <nav
      aria-label="Kurs bo‘limlari"
      className={cn(
        "z-30 border-b border-line bg-surface max-lg:-mx-[1.25rem] max-lg:px-[1.25rem]",
        "lg:sticky lg:top-[calc(var(--height-header)+0.75rem)] lg:mx-auto lg:max-w-fit lg:rounded-pill lg:border lg:px-2",
      )}
    >
      <div ref={railRef} className="flex gap-1 overflow-x-auto py-1.5">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <a
              key={section.id}
              data-section={section.id}
              href={`#${section.id}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-medium whitespace-nowrap",
                "transition-colors duration-fast",
                focusRing,
                active
                  ? "bg-accent-50 text-accent-700"
                  : "text-ink-700 hover:bg-ink-900/[0.05] hover:text-ink-900",
              )}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                const target = document.getElementById(section.id);
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                });
                history.replaceState(null, "", `#${section.id}`);
                setActiveId(section.id);
              }}
            >
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
