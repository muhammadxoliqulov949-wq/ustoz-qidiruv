import Link from "next/link";
import { Logo } from "@/components/navigation/logo";
import { footerGroups } from "@/data/site";

/**
 * Homepage footer — light and minimal (surface band, hairline top).
 * All routes are future-phase destinations → prefetch={false} until
 * their pages exist. No newsletter, no social clutter, no app badges.
 */
export function Footer() {
  return (
    <footer className="mt-3xl border-t border-line bg-surface md:mt-4xl">
      <div className="site-container py-2xl md:py-3xl">
        <div className="grid gap-xl sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      prefetch={false} // future pages land in Phase 3+
                      className="rounded-md text-sm text-ink-500 transition-colors duration-fast hover:text-ink-900 focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35 focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-2xl flex flex-col gap-2 border-t border-line pt-lg text-sm text-ink-400 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} USTOZ. Barcha huquqlar himoyalangan.</p>
          <p>O‘zbekiston — Toshkent</p>
        </div>
      </div>
    </footer>
  );
}
