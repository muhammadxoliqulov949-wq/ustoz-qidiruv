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
 * Conditionally rendered (no animation machinery); Escape/backdrop close and
 * scroll lock are handled by <Header>.
 */
export function MobileMenu({
  id,
  open,
  onClose,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Menyuni yopish"
        onClick={onClose}
        className="fixed inset-0 top-0 -z-10 h-dvh w-screen cursor-default bg-ink-900/10 backdrop-blur-[2px] lg:hidden"
      />

      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-label="Sayt navigatsiyasi"
        className={cn("absolute inset-x-0 top-full z-10 mt-2 lg:hidden")}
      >
        <nav
          aria-label="Mobil navigatsiya"
          className={cn(
            "mx-auto flex w-full max-w-lg flex-col gap-1 rounded-2xl p-3",
            "border border-ink-900/[0.06] bg-surface/95 shadow-raised backdrop-blur-xl",
          )}
        >
          <div className="p-1 pb-3">
            <SearchInput
              size="md"
              label="Kurs yoki ustoz qidirish"
              onSubmit={(q) => {
                onClose();
                router.push(`/courses?q=${encodeURIComponent(q)}`);
              }}
            />
          </div>

          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.prefetch} // unbuilt routes stay inert (site.ts data)
              onClick={onClose}
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
              onClick={onClose}
            >
              {loginNav.label}
            </ButtonLink>
            <ButtonLink
              href={becomeTeacherNav.href}
              prefetch={becomeTeacherNav.prefetch}
              fullWidth
              onClick={onClose}
            >
              {becomeTeacherNav.label}
            </ButtonLink>
          </div>
        </nav>
      </div>
    </>
  );
}
