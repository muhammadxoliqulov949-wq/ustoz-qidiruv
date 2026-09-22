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
          <p className="mb-5 inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[0.7rem] font-bold tracking-[0.16em] text-ink-500 uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-accent-400 shadow-[0_0_10px_2px_rgb(46_191_122/0.6)]" aria-hidden="true" />
            {hero.eyebrow}
          </p>

        <h1
          id="hero-title"
          className="max-w-[14ch] text-[2.5rem] font-bold tracking-[-0.045em] leading-[0.90] text-balance text-ink-900 sm:text-[3.35rem] lg:text-[3.95rem]"
        >
          <span className="block">Sizga</span>
          <span className="block text-gradient">mos ustozni toping.</span>
        </h1>

        <p className="mt-6 max-w-[46rem] text-[1.05rem] text-pretty leading-relaxed text-ink-500 md:text-[1.125rem] md:leading-relaxed">
          {hero.subtitle}
        </p>

        <div className="mt-10 flex w-full max-w-[44rem] flex-col gap-5">
          <HeroSearch />
          <QuickFilters filters={quickFilters} />
        </div>
        </div>

        <div className="hero-depth-object hidden lg:block" aria-hidden="true">
          <span className="hero-depth-mark">U</span>
          <span className="absolute right-5 bottom-5 z-[3] rounded-pill border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm backdrop-blur-md">
            Bilimga yaqinroq
          </span>
          <span className="absolute left-6 top-6 z-[3] inline-flex items-center gap-1.5 rounded-pill border border-amber-400/20 bg-amber-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-400" /> Offline & Online
          </span>
        </div>
      </div>
    </section>
  );
}
