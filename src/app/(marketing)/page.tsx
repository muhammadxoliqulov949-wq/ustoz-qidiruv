import { Hero } from "@/components/home/hero";
import { PopularCategories } from "@/components/home/popular-categories";
import { RecommendedCourses } from "@/components/home/recommended-courses";
import { FormatEditorial } from "@/components/home/format-editorial";
import { TopTeachers } from "@/components/home/top-teachers";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustPromises } from "@/components/home/trust-promises";
import { TeacherCta } from "@/components/home/teacher-cta";

/**
 * USTOZ homepage — Phase 2 full content stack.
 * Everything below the hero is server-rendered from the mock data layer;
 * the only client islands are the header and the hero search (Phase 1).
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <PopularCategories />
      <RecommendedCourses />
      <FormatEditorial />
      <TopTeachers />
      <HowItWorks />
      <TrustPromises />
      <TeacherCta />
    </>
  );
}
