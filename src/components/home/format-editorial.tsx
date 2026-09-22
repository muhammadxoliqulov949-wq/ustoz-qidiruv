import { ArrowRight, Building2, Monitor } from "lucide-react";
import { ButtonLink, Card, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { formatEditorial } from "@/data/site";

const formatIcons = {
  online: Monitor,
  offline: Building2,
} as const;

export function FormatEditorial() {
  return (
    <Section ariaLabelledby="format-editorial-title">
      <div className="depth-quiet mb-6 rounded-2xl p-[1px]">
        <div className="rounded-2xl bg-canvas/40 px-5 py-4 backdrop-blur-sm md:px-6">
          <SectionHeader
            eyebrow="FORMATNI TANLANG"
            title={
              <span id="format-editorial-title">
                Sizga mos <span className="text-gradient">formatda</span> o&apos;rganing
              </span>
            }
            description="Onlayn — uyingizdan, offlayn — sinfda. Ikkala format ham bir xil sifat va havas bilan."
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
        {formatEditorial.items.map((item) => {
          const Icon = formatIcons[item.id as "online" | "offline"];
          const isOnline = item.id === "online";
          return (
            <Card
              key={item.id}
              variant="quiet"
              padded={false}
              className="group relative overflow-hidden min-h-[24rem]"
            >
              {/* large ghost typography behind */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-8 left-4 select-none font-black tracking-[-0.06em] text-[4.5rem] leading-none text-white/[0.04] md:text-[5.5rem]"
              >
                {isOnline ? "ONLAYN" : "OFFLAYN"}
              </span>

              {/* glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full blur-3xl"
                style={{ background: isOnline ? "rgba(16,146,90,0.16)" : "rgba(232,181,90,0.14)" }}
              />

              {/* subtle laptop / classroom 3D simulation */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-6 hidden h-[10rem] w-[14rem] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm md:flex lg:right-6"
                style={{
                  background: isOnline
                    ? "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(16,146,90,0.08))"
                    : "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(232,181,90,0.06))",
                  transform: "rotate(-2deg)",
                }}
              >
                {/* faux window chrome */}
                <div className="flex h-[7rem] w-[10rem] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/80 shadow-raised">
                  <div className="flex items-center gap-1 border-b border-black/5 bg-white px-2 py-1.5">
                    <span className="size-2 rounded-full bg-red-400" />
                    <span className="size-2 rounded-full bg-amber-400" />
                    <span className="size-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-white to-slate-50 text-slate-400">
                    <Icon className="size-8" />
                  </div>
                </div>
              </div>

              <div className="relative flex h-full flex-col gap-4 p-7 sm:p-8 lg:p-10">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-accent-400 shadow-sm backdrop-blur-sm [&>svg]:size-6 [&>svg]:stroke-[1.75]"
                >
                  <Icon />
                </span>
                <h3 className="max-w-[14ch] text-2xl font-bold tracking-[-0.02em] text-ink-900">
                  {item.title}
                </h3>
                <p className="max-w-md text-base text-pretty leading-relaxed text-ink-500">{item.text}</p>

                <div className="mt-auto flex items-center gap-3">
                  <ButtonLink
                    href={item.action.href}
                    variant={isOnline ? "primary" : "outline"}
                    size="sm"
                    className={isOnline ? "" : "border-white/14 bg-white/6 text-ink-900 hover:bg-white/10"}
                    trailingIcon={<ArrowRight className="size-4" />}
                  >
                    {item.action.label}
                  </ButtonLink>
                  <span className="hidden text-xs italic text-white/35 sm:inline">• Masofadan, istalgan joydan</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-right font-serif text-sm italic text-white/35">&ldquo;Bilim formadan qat&apos;iy nazar qadrlidir&rdquo;</p>
    </Section>
  );
}
