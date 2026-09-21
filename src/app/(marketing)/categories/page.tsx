import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink, CategoryCard } from "@/components/ui";
import { categories } from "@/data/categories";
import { categoriesPage } from "@/data/site";
import { getCategoryCourseCounts } from "@/server/public-repo";

/* -------------------------------------------------------------------------- */
/* /categories — the browse index (Phase 3). Thin: just the canonical category  */
/* grid on its own page; every tile lands on the category results screen at     */
/* /categories/[slug].                                                          */
/*                                                                              */
/* The category LIST is static product taxonomy. The count on each tile is      */
/* marketplace inventory, so it is counted from published rows at request time  */
/* (getCategoryCourseCounts) — the same number the homepage tiles show, which   */
/* is why this route is dynamic SSR like /courses and /categories/[slug] and    */
/* why the moderation action's revalidatePath("/categories") now means          */
/* something. Nothing is read at build time.                                    */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: categoriesPage.title,
  description: categoriesPage.intro,
};

export default async function CategoriesPage() {
  const courseCounts = await getCategoryCourseCounts();

  return (
    <div className="depth-canvas site-container flex flex-col gap-10 pb-18 pt-14 md:gap-12 md:pb-26 md:pt-18">
      <div className="marketplace-header flex flex-col gap-2 p-6 sm:p-8 lg:p-10">
        <p className="text-sm font-semibold tracking-[0.08em] text-accent-600 uppercase">
          Katalog
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance text-ink-900 md:text-5xl">
          {categoriesPage.title}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-ink-500 md:text-lg">
          {categoriesPage.intro}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
        {categories.map((category) => (
          <li key={category.id} className="flex">
            <CategoryCard
              category={category}
              // Not in the GROUP BY result ⇒ no published course there yet.
              courseCount={courseCounts.get(category.id) ?? 0}
              className="w-full"
            />
          </li>
        ))}
      </ul>

      <p>
        <ButtonLink
          href="/courses"
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Barcha kurslarni ko‘rish
        </ButtonLink>
      </p>
    </div>
  );
}
