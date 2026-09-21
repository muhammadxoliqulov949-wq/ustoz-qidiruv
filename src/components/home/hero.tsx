import { HeroSearch } from "./hero-search";
import { QuickFilters } from "./quick-filters";
import { hero, quickFilters } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* Hero — Phase 1 homepage top section.                                        */
/* Flat on the warm canvas: no gradients, no imagery, no 3D.                   */
/* The top band is deliberately open (no border-b) so the clean header         */
/* before scroll blends into the hero; the floating surface separates later.   */
/* Spacing comes from --spacing section-rhythm tokens only.                     */
/* -------------------------------------------------------------------------- */

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="flex flex-col items-center pb-18 pt-[calc(var(--height-header)+3rem)] md:pb-26 md:pt-[calc(var(--height-header)+5rem)]"
    >
      <div className="motion-hero-reveal site-container flex flex-col items-center text-center">
        <p className="mb-4 text-sm font-semibold tracking-[0.1em] text-accent-600 uppercase">
          {hero.eyebrow}
        </p>

        <h1
          id="hero-title"
          className="max-w-4xl text-4xl font-semibold tracking-[-0.02em] text-balance text-ink-900 sm:text-5xl lg:text-6xl"
        >
          {hero.title}
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-pretty text-ink-500 md:mt-6 md:text-xl md:leading-relaxed">
          {hero.subtitle}
        </p>

        <div className="mt-12 flex w-full max-w-[44rem] flex-col gap-5 md:mt-18">
          <HeroSearch />
          <QuickFilters filters={quickFilters} />
        </div>
      </div>
    </section>
  );
}
