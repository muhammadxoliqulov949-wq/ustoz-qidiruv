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
      <div className="relative flex flex-col items-start gap-8 overflow-hidden rounded-3xl border border-white/10 px-6 py-12 shadow-raised md:flex-row md:items-center md:justify-between md:px-12 md:py-16" style={{background:"radial-gradient(640px 320px at 92% 0%, rgba(232,181,90,0.16), transparent 64%), radial-gradient(560px 360px at 18% 100%, rgba(22,146,90,0.22), transparent 62%), linear-gradient(145deg, #0E4531, #0F2A20)"}}>
        <div className="flex max-w-2xl flex-col gap-3">
          <h2
            id="teacher-cta-title"
            className="text-3xl font-bold tracking-[-0.03em] text-balance text-white md:text-4xl lg:text-[2.45rem] leading-[1.05]"
          >
            {teacherCta.title}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-white/70 md:text-lg">
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
