import { ArrowRight } from "lucide-react";
import { ButtonLink, CourseCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { recommendedCourses } from "@/data/courses";

/**
 * “Siz uchun tavsiya etilgan kurslar”.
 * Grid: 1 col mobile → 2 tablet → 3 desktop (lg) → 4 large desktop (xl:
 * 1200px content → ~282px cards, still comfortable). Six courses keep the
 * default 3-col view perfectly balanced (3+3).
 */
export function RecommendedCourses() {
  return (
    <Section ariaLabelledby="recommended-courses-title">
      <SectionHeader
        title={
          <span id="recommended-courses-title">
            Siz uchun tavsiya etilgan kurslar
          </span>
        }
        description="O‘quvchilar orasida mashhur kurslar."
        action={
          <ButtonLink
            href="/courses"
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Barcha kurslar
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recommendedCourses.map((course) => (
          <li key={course.id} className="flex">
            <CourseCard course={course} className="w-full" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
