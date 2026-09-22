import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { HeroSearch } from "./hero-search";
import { QuickFilters } from "./quick-filters";
import { quickFilters } from "@/data/site";
import type { Teacher } from "@/data/models";
import { formatRating } from "@/lib/format";

export interface HeroProps {
  teachers?: Teacher[];
}

export function Hero({ teachers = [] }: HeroProps) {
  const preview = teachers.slice(0, 3);
  const hasTeachers = preview.length >= 1;

  return (
    <section
      aria-labelledby="hero-title"
      className="depth-canvas relative overflow-hidden pb-12 pt-[calc(var(--height-header)+1.8rem)] md:pb-16 md:pt-[calc(var(--height-header)+2.8rem)] lg:pb-20 lg:pt-[calc(var(--height-header)+3.2rem)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.85]"
        style={{
          background:
            "radial-gradient(820px 420px at 92% 10%, rgba(232,181,90,0.12), transparent 62%), radial-gradient(700px 400px at 62% 42%, rgba(16,146,90,0.18), transparent 68%), radial-gradient(1100px 620px at 50% 108%, rgba(14,69,49,0.22), transparent 72%)",
        }}
      />

      <div className="motion-hero-reveal site-container grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 xl:gap-10">
        {/* Left */}
        <div className="flex flex-col items-start text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] text-ink-500 uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,0.6)]" aria-hidden="true" />
            Onlayn va offlayn ustozlar bazasi
          </p>

          <h1 id="hero-title" className="max-w-[14ch] font-black tracking-[-0.05em] leading-[0.88] text-balance">
            <span className="block text-[0.85rem] font-bold tracking-[0.32em] text-ink-500 uppercase sm:text-[0.95rem]">ZAMONAVIY</span>
            <span className="mt-2 block text-[2.55rem] text-ink-900 sm:text-[3.05rem] lg:text-[3.55rem] xl:text-[3.85rem]">USTOZNI</span>
            <span className="block text-[2.55rem] text-ink-900 sm:text-[3.05rem] lg:text-[3.55rem] xl:text-[3.85rem]">TOPISHNING</span>
            <span className="block text-gradient text-[2.55rem] sm:text-[3.05rem] lg:text-[3.55rem] xl:text-[3.85rem]">INNOVATSION YO&apos;LI</span>
          </h1>

          <p className="mt-5 max-w-[36rem] text-[1.02rem] leading-relaxed text-pretty text-ink-500 sm:text-[1.08rem]">
            Tajribali va malakali ustozlar bilan o&apos;zingiz istagan fan yoki ko&apos;nikmani o&apos;rganing — onlayn va offlayn formatlarda.
          </p>

          <div className="mt-8 flex w-full max-w-[44rem] flex-col gap-4">
            <HeroSearch />
            <QuickFilters filters={quickFilters} />
          </div>

          <div className="mt-6 flex hidden w-full max-w-[44rem] items-center gap-3 border-t border-white/8 pt-4 text-xs text-ink-500 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              10 000+ o&apos;quvchi ishonadi
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span>120+ faol ustoz • 4.9 o&apos;rtacha reyting</span>
          </div>
        </div>

        {/* Right: floating teacher cards */}
        <div className="relative hidden min-h-[30rem] lg:block" aria-hidden="true">
          {hasTeachers ? (
            <div className="relative mx-auto h-[32rem] w-full max-w-[38rem] select-none">
              {/* decorative curved lines */}
              <div className="pointer-events-none absolute -right-2 top-6 h-[24rem] w-[24rem] rounded-full border border-emerald-400/10" />
              <div className="pointer-events-none absolute -right-6 top-2 h-[28rem] w-[28rem] rounded-full border border-white/[0.06]" />
              <div className="pointer-events-none absolute left-6 top-10 h-[20rem] w-[20rem] rounded-full border border-amber-400/10" style={{ borderStyle: "dashed" }} />

              <p className="pointer-events-none absolute -top-1 right-4 rotate-[-4deg] font-serif text-[13px] italic text-white/45">
                &ldquo;Yaxshi ustoz — buyuk kelajak!&rdquo;
              </p>

              {/* Card 1 - top left tilted */}
              <Link
                href={`/teachers/${preview[0]?.slug ?? ""}`}
                className="absolute left-0 top-3 w-[19.5rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02] focus:z-10 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                style={{ transform: "rotate(-3.5deg)" }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                  {preview[0]?.photo ? (
                    <Image src={preview[0].photo} alt={preview[0].name} fill sizes="320px" className="object-cover object-[center_18%]" />
                  ) : null}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_1px_rgba(16,185,129,0.8)]" /> Hozir online
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-pill bg-amber-500 px-2 py-1 text-[11px] font-bold text-amber-950 shadow-md">Top</span>
                </div>
                <div className="p-3.5">
                  <p className="text-[0.98rem] font-semibold leading-none text-ink-900">{preview[0]?.name}</p>
                  <p className="mt-1 text-xs text-ink-500">{preview[0]?.specialization}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(preview[0]?.languages ?? []).slice(0, 3).map((l) => (
                      <span key={l} className="rounded-pill border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {formatRating(preview[0]?.rating ?? 4.9)}
                    <span className="font-normal text-ink-500">({preview[0]?.reviews ?? 312} izoh)</span>
                  </div>
                </div>
              </Link>

              {/* Card 2 - right */}
              {preview[1] && (
                <Link
                  href={`/teachers/${preview[1].slug}`}
                  className="absolute right-1 top-[5.5rem] w-[18rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02]"
                  style={{ transform: "rotate(3.2deg)" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                    <Image src={preview[1].photo ?? ""} alt={preview[1].name} fill sizes="290px" className="object-cover object-[center_18%]" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                      <span className="size-1.5 rounded-full bg-emerald-400" /> Hozir online
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[0.98rem] font-semibold leading-none text-ink-900">{preview[1].name}</p>
                    <p className="mt-1 text-xs text-ink-500">{preview[1].specialization}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(preview[1].languages ?? []).slice(0, 3).map((l) => (
                        <span key={l} className="rounded-pill border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {formatRating(preview[1].rating)} <span className="font-normal text-ink-500">({preview[1].reviews} izoh)</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Card 3 - bottom left */}
              {preview[2] && (
                <Link
                  href={`/teachers/${preview[2].slug}`}
                  className="absolute bottom-10 left-8 w-[19rem] overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-raised transition-transform duration-300 hover:z-10 hover:scale-[1.02]"
                  style={{ transform: "rotate(-2.2deg)" }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
                    <Image src={preview[2].photo ?? ""} alt={preview[2].name} fill sizes="300px" className="object-cover object-[center_18%]" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-emerald-400/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                      <span className="size-1.5 rounded-full bg-emerald-400" /> Hozir online
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[0.98rem] font-semibold leading-none text-ink-900">{preview[2].name}</p>
                    <p className="mt-1 text-xs text-ink-500">{preview[2].specialization}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(preview[2].languages ?? []).slice(0, 3).map((l) => (
                        <span key={l} className="rounded-pill border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {formatRating(preview[2].rating)} <span className="font-normal text-ink-500">({preview[2].reviews} izoh)</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* 120+ badge */}
              <div className="absolute bottom-0 right-3 flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/8 px-3.5 py-2.5 backdrop-blur-md">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-ink-300">👥</span>
                <div>
                  <p className="text-sm font-bold leading-none text-ink-900">120+</p>
                  <p className="text-xs leading-none text-ink-500">Faol ustozlar</p>
                </div>
              </div>

              <p className="pointer-events-none absolute -bottom-3 right-10 rotate-[-3deg] font-serif text-sm italic text-white/35">Bilim chegarasiz</p>
            </div>
          ) : (
            <div className="hero-depth-object" aria-hidden="true">
              <span className="hero-depth-mark">U</span>
            </div>
          )}
        </div>
      </div>

      {/* faint Registan-like silhouette at bottom edge — very subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-[0.06]"
        style={{
          background: "linear-gradient(to top, rgba(232,181,90,0.2), transparent)",
        }}
      />
    </section>
  );
}
