"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/lib/use-scrolled";
import { ButtonLink, IconButton, SearchInput } from "@/components/ui";
import { becomeTeacherNav, loginNav, primaryNav } from "@/data/site";
import { Logo } from "./logo";
import { MobileMenu, type MobileMenuCloseReason } from "./mobile-menu";

/* -------------------------------------------------------------------------- */
/* Site header — Phase 1.                                                       */
/* Starts clean (transparent, same 1280px container as the page) and becomes   */
/* a subtle blurred floating surface once the user scrolls.                    */
/* Mobile/tablet (< lg) is the simple architecture: logo + menu + CTA.        */
/* Bottom navigation is deliberately NOT part of this phase.                   */
/* -------------------------------------------------------------------------- */

const navLinkClass = cn(
  "inline-flex items-center rounded-lg px-3 py-2 text-[0.9375rem] font-medium tracking-[-0.01em]",
  "text-ink-700 transition-colors duration-fast hover:bg-white/[0.06] hover:text-ink-900",
  "outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
);

export function Header() {
  const scrolled = useScrolled(8);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Closing the panel is a dialog close, so focus goes back to the control
   * that opened it — unless the close was caused by picking a destination, in
   * which case the router owns focus and yanking it back to the header would
   * scroll the next page to the top.
   */
  const closeMenu = (reason: MobileMenuCloseReason) => {
    setMenuOpen(false);
    if (reason !== "navigate") {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  // Menu open → lock body scroll and allow Escape to dismiss.
  useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Same contract as closeMenu("escape"), inlined so the effect's
      // dependency list stays exactly [menuOpen].
      setMenuOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const floating = scrolled || menuOpen;

  return (
    <header className="sticky top-0 z-50 pt-0 sm:pt-3">
      {/* `relative` anchors the absolutely-positioned mobile menu to the
          container (not the viewport), so the panel matches the bar width. */}
      <div className="site-container relative">
        <div
          className={cn(
            "relative flex h-header items-center gap-4 rounded-2xl px-3",
            "transition-[background-color,border-color,box-shadow,backdrop-filter]",
            "duration-base sm:px-4",
            floating
              ? "depth-floating border-white/10 shadow-raised"
              : "border border-white/[0.06] bg-surface/30 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/28",
          )}
        >
          <Logo />

          {/* Desktop navigation */}
          <nav
            aria-label="Asosiy bo‘limlar"
            className="ml-2 hidden items-center gap-1 lg:flex"
          >
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={item.prefetch} // unbuilt routes stay inert (site.ts data)
                className={navLinkClass}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:gap-3">
            {/* Desktop inline search */}
            <div className="hidden w-56 lg:flex xl:w-72">
              <HeaderSearch />
            </div>

            <ButtonLink
              href={loginNav.href}
              prefetch={loginNav.prefetch}
              variant="ghost"
              size="sm"
              className="max-lg:hidden"
            >
              {loginNav.label}
            </ButtonLink>

            {/* Primary CTA — hidden on compact headers; lives in the menu */}
            <ButtonLink
              href={becomeTeacherNav.href}
              prefetch={becomeTeacherNav.prefetch}
              size="sm"
              className="max-lg:hidden"
            >
              {becomeTeacherNav.label}
            </ButtonLink>

            <IconButton
              ref={menuButtonRef}
              label={menuOpen ? "Menyuni yopish" : "Menyu"}
              icon={menuOpen ? <X /> : <Menu />}
              onClick={() => setMenuOpen((open) => !open)}
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            />
          </div>
        </div>

        {/* Mobile / tablet menu */}
        <MobileMenu id="mobile-menu" open={menuOpen} onClose={closeMenu} />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Header search → /courses?q= (the results engine owns the URL contract;
 * see lib/course-search.ts). Uncontrolled input, navigation on submit.
 */
function HeaderSearch() {
  const router = useRouter();
  return (
    <SearchInput
      size="md"
      label="Kurs yoki ustoz qidirish"
      onSubmit={(query) =>
        router.push(`/courses?q=${encodeURIComponent(query)}`)
      }
    />
  );
}
