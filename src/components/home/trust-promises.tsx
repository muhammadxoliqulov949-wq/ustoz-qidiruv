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
            <li key={item.id} className="depth-quiet flex flex-col gap-3 rounded-2xl p-5">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-xl bg-accent-50 text-accent-700 shadow-sm [&>svg]:size-5 [&>svg]:stroke-[1.75]"
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
