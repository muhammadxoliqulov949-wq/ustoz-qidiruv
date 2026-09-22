import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionProps {
  /** Optional id for aria-labelledby wiring from consumers. */
  id?: string;
  ariaLabelledby?: string;
  /** Extra vertical padding etc. — top rhythm (3xl/4xl) is fixed. */
  className?: string;
  children: ReactNode;
}

/**
 * Canonical homepage content section: main container + the shared vertical
 * rhythm (pt-18 → md:pt-26). Only the last section before the footer
 * opts into bottom padding. Guarantees one cadence across every page.
 */
export function Section({ id, ariaLabelledby, className, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledby}
      className={cn("visual-section site-container px-5 pt-18 md:px-8 md:pt-26 xl:px-10", className)}
    >
      {children}
    </section>
  );
}
