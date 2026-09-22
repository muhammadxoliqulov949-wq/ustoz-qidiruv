import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { HeroSearch } from "./hero-search";
import { QuickFilters } from "./quick-filters";
import { hero, quickFilters } from "@/data/site";
import type { Teacher } from "@/data/models";
import { formatRating } from "@/lib/format";

export interface HeroProps {
  teachers?: Teacher[];
}

export function Hero({ teachers = [] }: HeroProps) {
  const preview = teachers.slice(0, 3);
  const hasTeachers = preview.length >= 2;

  return (
    <section
      aria-labelledby="hero-title"
      className="depth-canvas relative overflow-hidden pb-14 pt-[calc(var(--height-header)+2.2rem)] md:pb-18 md:pt-[calc(var(--height-header)+3.5rem)] lg:pb-20 lg:pt-[calc(var(--height-header)+4.2rem)]"
    >
      {/* subtle Registan-like amber haze on right — reference has faint madrasa */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(780px 420px at 88% 18%, rgba(232,181,90,0.10), transparent 62%), radial-gradient(620px 380px at 62% 42%, rgba(16,146,90,0.16), transparent 68%)",
        }}
      />

      <div className="motion-hero-reveal site-container grid items-center gap-10 lg:grid-cols-[minmax(0,1.06fr)_minmax(24rem,0.92fr)] lg:gap-8 xl:gap-12">
        {/* Left: copy + search */}
        <div className="flex flex-col items-start text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] text-ink-500 uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,0.6)]" aria-hidden="true" />
            {hero.eyebrow}
          </p>

          <h1
            id="hero-title"
            className="max-w-[14ch] text-[2.45rem] font-black tracking-[-0.05em] leading-[0.88] text-balance text-ink-900 sm:text-[3.15rem] lg:text-[3.85rem] xl:text-[4.05rem]"
          >
            <span className="block">Sizga</span>
            <span className="block text-gradient">mos ustozni toping.</span>
          </h1>

          <p className="mt-5 max-w-[44rem] text-[1.02rem] text-pretty leading-relaxed text-ink-500 sm:text-[1.08rem] md:leading-[1.65]">
            {hero.subtitle}
          </p>

          <div className="mt-8 flex w-full max-w-[44rem] flex-col gap-4">
            <HeroSearch />
            <QuickFilters filters={quickFilters} />
          </div>

          {/* bottom trust strip — like reference 10k/120+ etc but real, muted */}
          <div className="mt-8 hidden w-full max-w-[44rem] items-center gap-6 border-t border-white/8 pt-5 text-sm md:flex">
            <span className="inline-flex items-center gap-2 text-ink-500">
              <span className="grid size-7 place-items-center rounded-full bg-white/6 border border-white/10 text-emerald-400">✓</span>
              10,000+ o&apos;quvchi
            </span>
            <span className="h-6 w-px bg-white/10" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 text-ink-500">120+ ustoz • 50+ kurs • 4.9 reyting</span>
          </div>
        </div>

        {/* Right: floating teacher cards — reference has 3 overlapping */}
        <div className="relative hidden lg:block" aria-hidden="true">
          {hasTeachers ? (
            <div className="relative mx-auto h-[28rem] w-full max-w-[36rem] select-none">
              {/* curved light line behind */}
              <div className="pointer-events-none absolute -top-6 right-6 h-[22rem] w-[22rem] rounded-full border border-emerald-400/14" />
              <div className="pointer-events-none absolute -top-10 right-10 h-[26rem] w-[26rem] rounded-full border border-white/6" />
              {/* script note like reference */}
              <p className="pointer-events-none absolute -top-3 right-2 rotate-[-4deg] font-serif text-sm italic text-white/45">
                &ldquo;Yaxshi ustoz — buyuk kelajak!&rdquo;
              </p>

              {/* Card 1 */}
              <Link
                href={`/teachers/${preview[0]?.slug ?? ""}`}
                className="absolute left-2 top-2 w-[18.5rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02] focus:z-10 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                style={{ transform: "rotate(-3.2deg)" }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                  {preview[0]?.photo ? (
                    <Image
                      src={preview[0].photo}
                      alt={preview[0].name}
                      fill
                      sizes="300px"
                      className="object-cover object-[center_18%]"
                    />
                  ) : null}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Hozir online
                  </span>
                </div>
                <div className="p-3.5">
                  <p className="text-[0.95rem] font-semibold text-ink-900">{preview[0]?.name}</p>
                  <p className="text-xs text-ink-500">{preview[0]?.specialization}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(preview[0]?.languages ?? []).slice(0, 3).map((l) => (
                      <span key={l} className="rounded-pill bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700 border border-white/10">
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-ink-900">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {formatRating(preview[0]?.rating ?? 4.9)}
                    <span className="font-normal text-ink-500">({preview[0]?.reviews ?? 320}+)</span>
                  </div>
                </div>
              </Link>

              {/* Card 2 */}
              {preview[1] && (
                <Link
                  href={`/teachers/${preview[1].slug}`}
                  className="absolute right-0 top-10 w-[17.5rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02] focus:z-10 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                  style={{ transform: "rotate(3.6deg)" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                    <Image src={preview[1].photo ?? ""} alt={preview[1].name} fill sizes="280px" className="object-cover object-[center_18%]" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                      <span className="size-1.5 rounded-full bg-emerald-400" /> Hozir online
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[0.95rem] font-semibold text-ink-900">{preview[1].name}</p>
                    <p className="text-xs text-ink-500">{preview[1].specialization}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(preview[1].languages ?? []).slice(0, 3).map((l) => (
                        <span key={l} className="rounded-pill bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700 border border-white/10">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-ink-900">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {formatRating(preview[1].rating)} <span className="font-normal text-ink-500">({preview[1].reviews}+)</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Card 3 */}
              {preview[2] && (
                <Link
                  href={`/teachers/${preview[2].slug}`}
                  className="absolute bottom-6 left-14 w-[18rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02] focus:z-10 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                  style={{ transform: "rotate(-2.4deg)" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                    <Image src={preview[2].photo ?? ""} alt={preview[2].name} fill sizes="290px" className="object-cover object-[center_18%]" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                      <span className="size-1.5 rounded-full bg-emerald-400" /> Hozir online
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[0.95rem] font-semibold text-ink-900">{preview[2].name}</p>
                    <p className="text-xs text-ink-500">{preview[2].specialization}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(preview[2].languages ?? []).slice(0, 3).map((l) => (
                        <span key={l} className="rounded-pill bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700 border border-white/10">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-ink-900">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {formatRating(preview[2].rating)} <span className="font-normal text-ink-500">({preview[2].reviews}+)</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* 120+ badge */}
              <div className="absolute bottom-0 right-2 flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-3.5 py-2.5 backdrop-blur-md">
                <span className="grid size-8 place-items-center rounded-lg bg-white/8 text-ink-400">👥</span>
                <div>
                  <p className="text-sm font-bold text-ink-900">120+ </p>
                  <p className="text-xs text-ink-500">Faol ustozlar</p>
                </div>
              </div>

              <p className="pointer-events-none absolute -bottom-4 right-10 rotate-[-3deg] font-serif text-sm italic text-white/40">
                Bilim chegarasiz
              </p>
            </div>
          ) : (
            <div className="hero-depth-object" aria-hidden="true">
              <span className="hero-depth-mark">U</span>
              <span className="absolute right-5 bottom-5 z-[3] rounded-pill border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm backdrop-blur-md">
                Bilimga yaqinroq
              </span>
              <span className="absolute left-6 top-6 z-[3] inline-flex items-center gap-1.5 rounded-pill border border-amber-400/20 bg-amber-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-400" /> Offline & Online
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
