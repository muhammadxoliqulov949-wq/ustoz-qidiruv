import { ArrowRight } from "lucide-react";
import { ButtonLink, CategoryCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { categories } from "@/data/categories";

/**
 * “Mashhur yo‘nalishlar” — six restrained category tiles.
 * Grid: 2 cols mobile → 3 tablet/lg → 6 on xl (1280 content → ~186px
 * each; vertically-centered content keeps them clean, never crowded).
 */
export function PopularCategories() {
  return (
    <Section ariaLabelledby="popular-categories-title">
      <SectionHeader
        title={
          <span id="popular-categories-title">Mashhur yo‘nalishlar</span>
        }
        action={
          <ButtonLink
            href="/categories"
            prefetch={false} // Phase 2.1: categories listing
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Barcha kategoriyalar
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-2 gap-md md:grid-cols-3 md:gap-lg xl:grid-cols-6">
        {categories.map((category) => (
          <li key={category.id} className="flex">
            <CategoryCard category={category} className="w-full" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
