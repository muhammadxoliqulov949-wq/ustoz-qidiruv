import Link from "next/link";
import { Logo } from "@/components/navigation/logo";
import { footerGroups } from "@/data/site";

/**
 * Homepage footer — light and minimal (surface band, hairline top).
 * Every link resolves to a built route. Per-link prefetch stays declared in
 * the nav data (site.ts) as the standing convention: any future unbuilt link
 * must set prefetch:false until its route exists. No newsletter, no social
 * clutter, no app badges.
 */
export function Footer() {
  return (
    <footer className="site-footer mt-18 border-t border-line bg-surface md:mt-26">
      <div className="site-container py-12 md:py-18">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="flex flex-col items-start gap-4 xl:col-span-2">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-500">
              Onlayn va offlayn kurslar, tajribali ustozlar — bitta
              sokin, tez qidiruvda.
            </p>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="text-sm font-semibold text-ink-900">
                {group.title}
              </h3>
              {/*
                Phase 24 (touch targets): the links are 13px text with a 10px
                gap, i.e. a 16px-tall hit area. `py-1 -my-1` grows the target to
                24px (WCAG 2.5.8) while the negative margin keeps the visible
                rhythm of the list exactly as designed.
              */}
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      prefetch={link.prefetch}
                      className="-my-1 inline-block rounded-md py-1 text-sm text-ink-500 transition-colors duration-fast hover:text-ink-900 focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-4 text-sm text-ink-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} USTOZ. Barcha huquqlar himoyalangan.</p>
          <p>O‘zbekiston — Toshkent</p>
        </div>
      </div>
    </footer>
  );
}
