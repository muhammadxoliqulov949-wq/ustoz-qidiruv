import { ArrowRight, Award, MessageCircle, Search, Send } from "lucide-react";
import { ButtonLink, Card, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { howItWorks } from "@/data/site";

const illustrations = [
  {
    Icon: Search,
    bg: "from-cyan-500/14 via-blue-500/10 to-transparent",
    badge: "Qidiring",
    meta: "Fan yoki ismni yozing",
  },
  {
    Icon: MessageCircle,
    bg: "from-violet-500/14 via-fuchsia-500/10 to-transparent",
    badge: "Taqqoslang",
    meta: "Reyting • Narx • Joylashuv",
  },
  {
    Icon: Send,
    bg: "from-emerald-500/14 via-teal-500/10 to-transparent",
    badge: "Bog'laning",
    meta: "To'g'ridan-to'g'ri yozing",
  },
] as const;

export function HowItWorks() {
  return (
    <Section ariaLabelledby="how-it-works-title">
      <div className="depth-quiet mb-6 rounded-2xl p-[1px]">
        <div className="rounded-2xl bg-canvas/40 px-5 py-4 backdrop-blur-sm md:px-6">
          <SectionHeader
            eyebrow="JARAYON"
            title={
              <span id="how-it-works-title">
                Qanday <span className="text-gradient">ishlaydi</span>
              </span>
            }
            description="Uch oddiy qadamda — izlang, taqqoslang, birinchi darsingizni boshlang."
          />
        </div>
      </div>

      <ol className="grid gap-5 md:grid-cols-3 md:gap-5">
        {howItWorks.steps.map((step, idx) => {
          const ill = illustrations[idx] ?? illustrations[0];
          return (
            <li key={step.id} className="flex">
              <Card variant="quiet" padded={false} className="group relative flex w-full flex-col overflow-hidden">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ill.bg}`} aria-hidden="true" />
                {/* 3D object zone */}
                <div className="relative flex h-[12rem] items-center justify-center overflow-hidden">
                  <div className="relative grid size-28 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-raised backdrop-blur-sm transition-transform duration-500 group-hover:scale-[1.03] group-hover:rotate-[-1deg]">
                    <ill.Icon className="size-10 text-ink-900 opacity-90" />
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-pill border border-white/12 bg-white px-2.5 py-1 text-xs font-semibold text-ink-900 shadow-sm">
                      {ill.badge}
                    </span>
                  </div>
                  {/* floating chips */}
                  <span className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-amber-400/20 bg-amber-500/15 text-amber-300 backdrop-blur-sm [&>svg]:size-4">
                    <Award />
                  </span>
                  <span className="absolute bottom-4 left-4 hidden rounded-pill border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-ink-500 md:inline">
                    {ill.meta}
                  </span>
                </div>

                <div className="relative flex flex-1 flex-col gap-2 p-6 pt-2">
                  <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-accent-400 uppercase">
                    <span className="h-px w-6 bg-accent-600/40" aria-hidden="true" />
                    {step.number}
                  </span>
                  <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-500">{step.text}</p>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      {/* comparison table as in reference */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-4 border-b border-white/8 bg-white/[0.04] px-5 py-3 text-xs font-bold tracking-wide text-ink-500 uppercase md:px-6">
          <span>Xususiyat</span>
          <span className="text-center text-ink-900">USTOZ</span>
          <span className="text-center">Boshqalar</span>
        </div>
        {[
          ["Onlayn & Oflayn ustozlar", true, false],
          ["Tekshirilgan profil va reyting", true, false],
          ["To'g'ridan-to'g'ri bog'lanish", true, false],
        ].map(([label, a, b]) => (
          <div key={String(label)} className="grid grid-cols-3 gap-4 border-b border-white/6 px-5 py-3 text-sm last:border-0 md:px-6">
            <span className="text-ink-700">{String(label)}</span>
            <span className="place-self-center grid size-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">{Boolean(a) ? "✓" : "—"}</span>
            <span className="place-self-center grid size-6 place-items-center rounded-full bg-white/6 text-ink-500">{Boolean(b) ? "✓" : "—"}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <ButtonLink href="/courses" variant="primary" size="md" trailingIcon={<ArrowRight className="size-4" />}>
          Kurslarni ko&apos;rish
        </ButtonLink>
      </div>

      <p className="mt-4 text-center font-serif text-sm italic text-white/35">&ldquo;Bitta tanlov — ming imkoniyat&rdquo;</p>
    </Section>
  );
}
