import { HeroSearch } from "./hero-search";
import { QuickFilters } from "./quick-filters";
import { hero, quickFilters } from "@/data/site";

/* -------------------------------------------------------------------------- */
/* Hero — Phase 1 homepage top section.                                        */
/* Phase 26: editorial split composition with a light, CSS-only depth object.   */
/* Spacing comes from --spacing section-rhythm tokens only.                     */
/* -------------------------------------------------------------------------- */

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="depth-canvas relative overflow-hidden pb-18 pt-[calc(var(--height-header)+3rem)] md:pb-26 md:pt-[calc(var(--height-header)+5rem)]"
    >
      <div className="motion-hero-reveal site-container grid items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,.72fr)] lg:gap-16">
        <div className="flex flex-col items-start text-left">
          <p className="mb-4 inline-flex rounded-pill border border-accent-600/15 bg-accent-50 px-3 py-1.5 text-sm font-semibold tracking-[0.08em] text-accent-700 uppercase">
            {hero.eyebrow}
          </p>

        <h1
          id="hero-title"
          className="max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-balance text-ink-900 sm:text-5xl lg:text-6xl"
        >
          {hero.title}
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-pretty text-ink-500 md:text-xl md:leading-relaxed">
          {hero.subtitle}
        </p>

        <div className="mt-10 flex w-full max-w-[44rem] flex-col gap-5">
          <HeroSearch />
          <QuickFilters filters={quickFilters} />
        </div>
        </div>

        <div className="hero-depth-object hidden lg:block" aria-hidden="true">
          <span className="hero-depth-mark">U</span>
          <span className="absolute right-6 bottom-6 z-[3] rounded-pill border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-accent-700 shadow-sm backdrop-blur-sm">
            Bilimga yaqinroq
          </span>
        </div>
      </div>
    </section>
  );
}
