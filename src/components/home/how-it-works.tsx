import { SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { howItWorks } from "@/data/site";

/**
 * “Ustoz qanday ishlaydi?” — three editorial steps on hairline rules.
 * No cards, no icons: number + title + one line of copy.
 */
export function HowItWorks() {
  return (
    <Section ariaLabelledby="how-it-works-title">
      <SectionHeader
        title={<span id="how-it-works-title">{howItWorks.title}</span>}
      />

      <ol className="grid gap-6 md:grid-cols-3 md:gap-6">
        {howItWorks.steps.map((step) => (
          <li key={step.id} className="depth-quiet group relative flex flex-col gap-3 rounded-2xl p-6 overflow-hidden">
            <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-accent-600/8 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-accent-400 uppercase">
              <span className="h-px w-6 bg-accent-600/40" aria-hidden="true" />
              {step.number}
            </span>
            <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">
              {step.title}
            </h3>
            <p className="max-w-xs text-base leading-relaxed text-ink-500">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
