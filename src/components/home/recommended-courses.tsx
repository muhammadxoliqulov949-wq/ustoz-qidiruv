import { ArrowRight, SearchX } from "lucide-react";
import { ButtonLink, Card, CourseCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import type { Course } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* “Siz uchun tavsiya etilgan kurslar”.                                        */
/* Grid: 1 col mobile → 2 tablet → 3 desktop (lg) → 4 large desktop (xl:       */
/* 1200px content → ~282px cards, still comfortable). Six courses keep the     */
/* default 3-col view perfectly balanced (3+3).                                */
/*                                                                              */
/* DATA: the page hands this section published courses read at request time     */
/* from the public marketplace repository (src/server/public-repo.ts). There    */
/* is no fixture list and no fallback row: every card here is a record the      */
/* database returned, so every `/courses/[slug]` link it renders resolves —     */
/* the detail page reads the same repository with the same `published` filter.  */
/*                                                                              */
/* An empty catalogue renders the honest empty state below (same visual         */
/* language as the /courses results empty state) instead of invented cards.     */
/* -------------------------------------------------------------------------- */

export interface RecommendedCoursesProps {
  /** Published courses from the runtime repository, already ordered and capped. */
  courses: Course[];
}

export function RecommendedCourses({ courses }: RecommendedCoursesProps) {
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

      {courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <li key={course.id} className="flex">
              <CourseCard course={course} className="w-full" />
            </li>
          ))}
        </ul>
      ) : (
        /* Nothing published yet — say so; never pad the row with fixtures. */
        <Card
          variant="quiet"
          className="flex flex-col items-center gap-3 px-6 py-14 text-center"
        >
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-pill bg-surface text-ink-400 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]"
          >
            <SearchX />
          </span>
          <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">
            Hozircha kurslar e’lon qilinmagan
          </h3>
          <p className="max-w-md text-base text-pretty text-ink-500">
            Yangi kurslar joylashtirilishi bilan ular shu yerda ko‘rinadi.
          </p>
        </Card>
      )}
    </Section>
  );
}
