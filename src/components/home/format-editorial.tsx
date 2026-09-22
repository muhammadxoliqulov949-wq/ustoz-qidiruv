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

      <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
        {formatEditorial.items.map((item) => {
          const Icon = formatIcons[item.id as "online" | "offline"];
          return (
            <Card key={item.id} variant="quiet" padded={false} className="overflow-hidden relative">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute -right-16 -top-16 size-48 rounded-full bg-accent-600/10 blur-3xl" aria-hidden="true" />
              <div className="flex h-full flex-col gap-4 p-8 sm:p-10 lg:p-12 relative">
                <span
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.07] text-accent-400 shadow-sm backdrop-blur-sm [&>svg]:size-6 [&>svg]:stroke-[1.75]"
                >
                  <Icon />
                </span>
                <h3 className="text-2xl font-bold tracking-[-0.02em] text-ink-900">
                  {item.title}
                </h3>
                <p className="max-w-md text-base text-pretty leading-relaxed text-ink-500">
                  {item.text}
                </p>
                <ButtonLink
                  href={item.action.href}
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
