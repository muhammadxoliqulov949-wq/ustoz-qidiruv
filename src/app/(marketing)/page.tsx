import { Hero } from "@/components/home/hero";
import { PopularCategories } from "@/components/home/popular-categories";
import { RecommendedCourses } from "@/components/home/recommended-courses";
import { FormatEditorial } from "@/components/home/format-editorial";
import { TopTeachers } from "@/components/home/top-teachers";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustPromises } from "@/components/home/trust-promises";
import { TeacherCta } from "@/components/home/teacher-cta";
import { HomeStory, StoryChapter } from "@/components/home/storytelling";
import { defaultBrowseParams } from "@/lib/course-search";
import { applyTeacherBrowse, defaultTeacherParams } from "@/lib/teacher-search";
import {
  getCategoryCourseCounts,
  listPublicCourses,
  listPublicTeachers,
} from "@/server/public-repo";

/* -------------------------------------------------------------------------- */
/* USTOZ homepage.                                                             */
/*                                                                              */
/* DATA SOURCE — ONE, AND IT IS THE DATABASE.                                   */
/* The two marketplace rows (recommended courses, top teachers) and the course  */
/* counts beside the category tiles are read at REQUEST TIME from the public    */
/* marketplace repository, the same module /courses, /teachers and the detail   */
/* pages already read. The homepage therefore cannot show a card that its own   */
/* detail route would 404 on: both sides apply the identical                    */
/* `status = 'published'` / `is_public` predicates.                             */
/*                                                                              */
/* What stays static is static on purpose: hero copy, the quick-filter links,   */
/* the format duet, the how-it-works steps, the trust promises, the teacher     */
/* CTA (all `@/data/site`) and the six-category taxonomy (`@/data/categories`)  */
/* — product vocabulary, not marketplace records. No section keeps a fixture    */
/* list of courses or teachers, and nothing here fabricates a card, a portrait  */
/* or a count when the catalogue is empty: those sections render an honest      */
/* empty state instead.                                                         */
/*                                                                              */
/* RENDERING — dynamic SSR, never build time. `force-dynamic` is what keeps     */
/* `next build` free of database access (no query runs during prerender) while  */
/* still showing a course the moment an admin or teacher publishes it, with no  */
/* redeploy and no revalidatePath needed for this route.                        */
/*                                                                              */
/* Client islands remain exactly the Phase 1 pair: the header and the hero      */
/* search field.                                                                */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

/** Row sizes the homepage editorial composition is balanced for. */
const COURSE_PICKS = 6;
const TEACHER_PICKS = 4;

export default async function HomePage() {
  const [courses, teacherRows, courseCounts] = await Promise.all([
    // Highest-rated published courses first (rating → reviews → id), capped in
    // SQL. “Recommended/popular” is read off real stored signals rather than
    // insertion order, and with no ratings yet it degenerates to catalogue
    // order — the same rows /courses opens with.
    listPublicCourses({ ...defaultBrowseParams, sort: "rating" }, { limit: COURSE_PICKS }),
    // Public profiles that own at least one published course.
    listPublicTeachers(),
    getCategoryCourseCounts(),
  ]);

  // “Eng yaxshi ustozlar” uses the SAME pure sorter as /teachers?sort=rating,
  // so the homepage and the directory can never disagree about who ranks first.
  const rankedTeachers = applyTeacherBrowse(teacherRows, {
    ...defaultTeacherParams,
    sort: "rating",
  }).map((row) => row.teacher);
  const teachers = rankedTeachers.slice(0, TEACHER_PICKS);

  return (
    <div className="home-shell">
      <HomeStory>
        <StoryChapter index="01" kind="hero" name="Kirish">
          <Hero teachers={teachers} totalTeachers={rankedTeachers.length} />
        </StoryChapter>
        <StoryChapter index="02" kind="categories" name="Yo‘nalishlar">
          <PopularCategories courseCounts={courseCounts} />
        </StoryChapter>
        <StoryChapter index="03" kind="courses" name="Kurslar">
          <RecommendedCourses courses={courses} />
        </StoryChapter>
        <StoryChapter index="04" kind="formats" name="Formatlar">
          <FormatEditorial courses={courses} />
        </StoryChapter>
        <StoryChapter index="05" kind="teachers" name="Ustozlar">
          <TopTeachers teachers={teachers} />
        </StoryChapter>
        <StoryChapter index="06" kind="process" name="Jarayon" sticky>
          <HowItWorks />
        </StoryChapter>
        <StoryChapter index="07" kind="trust" name="Ishonch" sticky>
          <TrustPromises />
        </StoryChapter>
        <StoryChapter index="08" kind="teacher-cta" name="Ustoz bo‘ling">
          <TeacherCta teacher={teachers[0] ?? null} />
        </StoryChapter>
      </HomeStory>
    </div>
  );
}
