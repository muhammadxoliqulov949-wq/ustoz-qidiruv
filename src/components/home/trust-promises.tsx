import { SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { trustIcons, type TrustIconKey } from "@/components/icons";
import { trustPromises } from "@/data/site";

/**
 * Trust band — real product promises only. Deliberately NO invented
 * platform statistics (per Master Spec). Flat rows, one icon each,
 * restrained tinted square, no cards.
 */
export function TrustPromises() {
  return (
    <Section ariaLabelledby="trust-title">
      <SectionHeader
        title={<span id="trust-title">{trustPromises.title}</span>}
        compact
      />

      <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {trustPromises.items.map((item) => {
          const Icon = trustIcons[item.icon as TrustIconKey];
          return (
            <li key={item.id} className="depth-quiet flex flex-col gap-3 rounded-2xl p-5 hover:border-white/12 transition-colors duration-300">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-accent-400 shadow-sm backdrop-blur-sm [&>svg]:size-5 [&>svg]:stroke-[1.75]"
              >
                <Icon />
              </span>
              <h3 className="text-base font-semibold text-ink-900">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-500">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
