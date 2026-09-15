import { ArrowRight } from "lucide-react";
import { ButtonLink, CategoryCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { categories } from "@/data/categories";

/* -------------------------------------------------------------------------- */
/* “Mashhur yo‘nalishlar” — six restrained category tiles.                     */
/* Grid: 2 cols mobile → 3 tablet/lg → 6 on xl (1280 content → ~186px          */
/* each; vertically-centered content keeps them clean, never crowded).         */
/*                                                                              */
/* WHICH categories exist is static product taxonomy (`@/data/categories`) —    */
/* the same fixed vocabulary behind the /categories/[slug] routes, the browse   */
/* filters and the teacher authoring form, so it is not a marketplace record    */
/* and it is not read from the database.                                        */
/*                                                                              */
/* HOW MANY courses each one holds IS marketplace inventory: the page passes    */
/* the live published count per category (getCategoryCourseCounts()), so a tile */
/* can never promise “212 ta kurs” to a catalogue that has none.                */
/* -------------------------------------------------------------------------- */

export interface PopularCategoriesProps {
  /** Published-course count per category id, read at request time. */
  courseCounts: Map<string, number>;
}

export function PopularCategories({ courseCounts }: PopularCategoriesProps) {
  return (
    <Section ariaLabelledby="popular-categories-title">
      <SectionHeader
        title={
          <span id="popular-categories-title">Mashhur yo‘nalishlar</span>
        }
        action={
          <ButtonLink
            href="/categories"
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Barcha kategoriyalar
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-6">
        {categories.map((category) => (
          <li key={category.id} className="flex">
            <CategoryCard
              category={category}
              // Absent from the GROUP BY result ⇒ nothing published there yet.
              courseCount={courseCounts.get(category.id) ?? 0}
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
