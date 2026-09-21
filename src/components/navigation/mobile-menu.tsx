"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonLink, SearchInput } from "@/components/ui";
import { becomeTeacherNav, loginNav, primaryNav } from "@/data/site";

/**
 * Compact (mobile/tablet) navigation panel — part of the simple top-header
 * architecture. Final bottom navigation is intentionally out of Phase 1.
 * CSS state transitions keep open/close calm without adding an animation
 * dependency; Escape/backdrop close and scroll lock are handled by <Header>.
 */
/**
 * Why the panel closes are TYPED (Phase 24): a close caused by Escape or by
 * clicking the backdrop must put focus back on the menu button, while a close
 * caused by choosing a destination must not — the user is already on their way
 * somewhere else and stealing focus back to the header would drop them at the
 * top of the new page.
 */
export type MobileMenuCloseReason = "escape" | "backdrop" | "navigate";

export function MobileMenu({
  id,
  open,
  onClose,
}: {
  id: string;
  open: boolean;
  onClose: (reason: MobileMenuCloseReason) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) {
      const panel = panelRef.current;
      if (!panel) return;
      const raf = requestAnimationFrame(() => {
        panel.querySelector<HTMLElement>("input, a, button")?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  /*
   * Tab trap. The panel is a real modal (it dims and locks the page behind it),
   * so Tab must cycle inside it: without this, the first Tab from the search
   * field walked into the page underneath the backdrop, where the user could
   * activate controls they could not see.
   */
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* Backdrop.
          `w-full`, never `w-screen`: 100vw includes the width of a classic
          vertical scrollbar, so on any browser that still draws one the
          backdrop was wider than the viewport and produced a horizontal
          overflow of its own (Phase 24 responsive fix). */}
      <button
        type="button"
        aria-label="Menyuni yopish"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        inert={!open ? true : undefined}
        data-state={open ? "open" : "closed"}
        onClick={() => onClose("backdrop")}
        className="motion-layer motion-backdrop fixed inset-0 -z-10 h-dvh w-full cursor-default bg-ink-900/10 lg:hidden"
      />

      <div
        ref={panelRef}
        id={id}
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        role="dialog"
        aria-modal="true"
        aria-label="Sayt navigatsiyasi"
        onKeyDown={trapTab}
        className={cn("motion-layer absolute inset-x-0 top-full z-10 mt-2 lg:hidden")}
      >
        <nav
          aria-label="Mobil navigatsiya"
          className={cn(
            "motion-menu mx-auto flex w-full max-w-lg flex-col gap-1 rounded-2xl p-3",
            "border border-ink-900/[0.06] bg-surface/95 shadow-raised backdrop-blur-xl",
            /*
             * The panel hangs below a 72px header and the page behind it is
             * scroll-locked, so on a short viewport (360x640, or any phone in
             * landscape) the last buttons used to fall off the bottom with no
             * way to reach them. It now caps itself under the header and
             * scrolls internally instead.
             */
            "max-h-[calc(100dvh-var(--height-header)-2.5rem)] overflow-y-auto overscroll-contain",
          )}
        >
          <div className="p-1 pb-3">
            <SearchInput
              size="md"
              label="Kurs yoki ustoz qidirish"
              onSubmit={(q) => {
                onClose("navigate");
                router.push(`/courses?q=${encodeURIComponent(q)}`);
              }}
            />
          </div>

          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.prefetch} // unbuilt routes stay inert (site.ts data)
              onClick={() => onClose("navigate")}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5",
                "text-lg font-medium text-ink-900 transition-colors duration-fast",
                "hover:bg-ink-900/[0.045] active:bg-ink-900/[0.07]",
                "outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
              )}
            >
              {item.label}
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-ink-400"
              />
            </Link>
          ))}

          <hr className="my-2 border-line" />

          <div className="flex flex-col gap-2 p-1">
            <ButtonLink
              href={loginNav.href}
              prefetch={loginNav.prefetch}
              variant="outline"
              fullWidth
              onClick={() => onClose("navigate")}
            >
              {loginNav.label}
            </ButtonLink>
            <ButtonLink
              href={becomeTeacherNav.href}
              prefetch={becomeTeacherNav.prefetch}
              fullWidth
              onClick={() => onClose("navigate")}
            >
              {becomeTeacherNav.label}
            </ButtonLink>
          </div>
        </nav>
      </div>
    </>
  );
}
