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

      <ol className="grid gap-8 md:grid-cols-3 md:gap-12">
        {howItWorks.steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="text-sm font-semibold tracking-[0.08em] text-accent-600">
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
