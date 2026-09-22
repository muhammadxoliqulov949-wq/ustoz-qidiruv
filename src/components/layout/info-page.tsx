import type { ReactNode } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* InfoPage — the shared shell for the Phase 20 informational pages (/about,    */
/* /help, /contacts, /privacy, /terms). Static, server-rendered, no data: the   */
/* same opener rhythm (eyebrow + h1 + intro) as the other marketing pages and   */
/* a narrow reading column for the sections.                                    */
/* -------------------------------------------------------------------------- */

export function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="depth-canvas site-container flex flex-col gap-10 pb-18 pt-14 md:gap-12 md:pb-26 md:pt-18">
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-accent-400 uppercase">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-[-0.03em] text-balance text-ink-900 md:text-5xl leading-[0.95]">
          {title}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-ink-500 md:text-lg">
          {intro}
        </p>
      </div>
      <div className="flex max-w-3xl flex-col gap-10 md:gap-12">{children}</div>
    </div>
  );
}

export function InfoSection({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-[calc(var(--height-header)+1.5rem)]", className)}
    >
      <SectionHeader title={title} as="h2" compact />
      <div className="flex flex-col gap-4 text-base leading-relaxed text-ink-700 md:text-lg">
        {children}
      </div>
    </section>
  );
}

/** Styled inline link for info-page prose (accent, underline, focus ring). */
export function InfoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-accent-400 underline underline-offset-2 decoration-accent-600/30 transition-colors duration-fast hover:text-accent-600 focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
