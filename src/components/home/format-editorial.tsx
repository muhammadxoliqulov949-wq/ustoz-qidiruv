import { ArrowRight, Building2, Monitor } from "lucide-react";
import { ButtonLink, Card, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { formatEditorial } from "@/data/site";

const formatIcons = {
  online: Monitor,
  offline: Building2,
} as const;

/**
 * Online / Offline editorial duet — two large calm surfaces, flat fills,
 * hairline borders. No imagery, no 3D objects.
 */
export function FormatEditorial() {
  return (
    <Section ariaLabelledby="format-editorial-title">
      <SectionHeader
        title={
          <span id="format-editorial-title">{formatEditorial.title}</span>
        }
      />

      <div className="grid gap-md md:grid-cols-2 lg:gap-lg">
        {formatEditorial.items.map((item) => {
          const Icon = formatIcons[item.id as "online" | "offline"];
          return (
            <Card key={item.id} variant="quiet" padded={false}>
              <div className="flex h-full flex-col gap-4 p-2xl">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-xl bg-surface text-accent-700 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]"
                >
                  <Icon />
                </span>
                <h3 className="text-2xl font-semibold tracking-[-0.01em] text-ink-900">
                  {item.title}
                </h3>
                <p className="max-w-md text-base text-pretty leading-relaxed text-ink-500">
                  {item.text}
                </p>
                <ButtonLink
                  href={item.action.href}
                  prefetch={false} // Phase 2.1: filtered course results
                  variant="ghost"
                  size="sm"
                  className="-ml-3.5 mt-auto w-fit"
                  trailingIcon={<ArrowRight className="size-4" />}
                >
                  {item.action.label}
                </ButtonLink>
              </div>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
