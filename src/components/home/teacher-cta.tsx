import { ArrowRight, Award, Coins, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { teacherCta } from "@/data/site";

export function TeacherCta() {
  return (
    <section aria-labelledby="teacher-cta-title" className="site-container pt-16 pb-16 md:pt-20 md:pb-20">
      <div
        className="relative grid overflow-hidden rounded-3xl border border-white/10 px-6 py-10 shadow-raised md:grid-cols-[1.15fr_0.85fr] md:items-center md:px-10 md:py-12 lg:px-12"
        style={{
          background:
            "radial-gradient(640px 320px at 92% 0%, rgba(232,181,90,0.16), transparent 64%), radial-gradient(560px 360px at 18% 100%, rgba(22,146,90,0.22), transparent 62%), linear-gradient(145deg, #0E4531, #0F2A20)",
        }}
      >
        {/* soft grid pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-pill border border-amber-400/20 bg-amber-500/15 px-3 py-1 text-xs font-bold tracking-[0.12em] text-amber-200 uppercase">
            USTOZLAR UCHUN
          </span>
          <h2 id="teacher-cta-title" className="max-w-[14ch] text-3xl font-black tracking-[-0.03em] text-balance leading-[0.95] text-white md:text-4xl lg:text-[2.55rem]">
            Bilimingizni ulashing, <span className="text-amber-300">o&apos;quvchilaringizni</span> toping
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-white/70 md:text-[1.05rem]">{teacherCta.text}</p>

          <div className="mt-2 flex flex-wrap gap-3">
            <ButtonLink href={teacherCta.action.href} variant="invert" size="lg" trailingIcon={<ArrowRight className="size-5" />}>
              {teacherCta.action.label}
            </ButtonLink>
            <span className="inline-flex items-center gap-2 text-sm text-white/60">
              <span className="grid size-7 place-items-center rounded-full bg-white/10 text-white">✓</span>
              Profil ochish bepul
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/60">
            <span className="inline-flex items-center gap-2">
              <Users className="size-4" /> 2,500+ faol ustoz
            </span>
            <span className="inline-flex items-center gap-2">
              <Award className="size-4" /> 4.8 o&apos;rtacha reyting
            </span>
            <span className="inline-flex items-center gap-2">
              <Coins className="size-4" /> 12 450 000 so&apos;mgacha
            </span>
          </div>
        </div>

        {/* Right: floating teacher dashboard preview */}
        <div className="relative mt-8 hidden min-h-[22rem] items-center justify-center md:flex">
          {/* card */}
          <div className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/12 bg-white shadow-raised">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-emerald-600 text-white text-sm font-bold">A</span>
                <div>
                  <p className="text-xs font-semibold text-ink-900">Azizbek Karimov</p>
                  <p className="text-xs text-ink-500">Matematika • 4.9 ★</p>
                </div>
              </div>
              <span className="rounded-pill bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Online</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2.5">
                <span className="text-xs text-ink-500">Jami daromad</span>
                <span className="text-sm font-bold text-ink-900">12 450 000 so&apos;m</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["O'quvchilar", "248"],
                  ["Kurslar", "6"],
                  ["Reyting", "4.9"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-black/5 bg-white px-2 py-2 text-center shadow-xs">
                    <p className="text-xs text-ink-500">{k}</p>
                    <p className="text-sm font-bold text-ink-900">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white">Boshqaruv paneli →</div>
            </div>
          </div>

          {/* 12M badge */}
          <div className="absolute -right-2 top-6 rounded-xl border border-amber-400/20 bg-amber-500 px-3 py-2 shadow-lg">
            <p className="text-xs font-bold text-amber-950">12 450 000 so&apos;m</p>
            <p className="text-xs text-amber-900/70">o&apos;rtacha oylik</p>
          </div>
          <div className="absolute -bottom-2 -left-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-md">
            <p className="text-xs font-semibold text-white">Hozir online</p>
            <p className="text-xs text-white/60">3 ta yangi so&apos;rov</p>
          </div>
        </div>
      </div>
    </section>
  );
}
