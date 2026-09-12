import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { teacherCta } from "@/data/site";

/**
 * Teacher acquisition CTA — one large flat emerald surface, 32px radius,
 * white copy, no gradient. Closes the homepage before the footer.
 */
export function TeacherCta() {
  return (
    <section
      aria-labelledby="teacher-cta-title"
      className="site-container pt-18 pb-18 md:pt-26 md:pb-26"
    >
      <div className="flex flex-col items-start gap-8 rounded-3xl bg-accent-600 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-12 md:py-16">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2
            id="teacher-cta-title"
            className="text-3xl font-semibold tracking-[-0.02em] text-balance text-white md:text-4xl"
          >
            {teacherCta.title}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-white/75 md:text-lg">
            {teacherCta.text}
          </p>
        </div>

        <ButtonLink
          href={teacherCta.action.href}
          variant="invert"
          size="lg"
          className="shrink-0"
          trailingIcon={<ArrowRight className="size-5" />}
        >
          {teacherCta.action.label}
        </ButtonLink>
      </div>
    </section>
  );
}
