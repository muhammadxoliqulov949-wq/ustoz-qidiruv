import { ArrowRight } from "lucide-react";
import { ButtonLink, CategoryCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { categories } from "@/data/categories";

export interface PopularCategoriesProps {
  courseCounts: Map<string, number>;
}

export function PopularCategories({ courseCounts }: PopularCategoriesProps) {
  return (
    <Section ariaLabelledby="popular-categories-title" className="pt-10">
      <div className="depth-quiet mb-6 rounded-2xl p-[1px] md:mb-8">
        <div className="rounded-2xl bg-canvas/40 px-5 py-4 backdrop-blur-sm md:px-6">
          <SectionHeader
            eyebrow="YO'NALISHLAR"
            title={
              <span id="popular-categories-title">
                Mashhur <span className="text-gradient">yo&apos;nalishlar</span>
              </span>
            }
            description="Eng talabgir yo'nalishlar bo'yicha eng yaxshi ustozlar va sifatli kurslarni bir joyda toping."
            action={
              <ButtonLink
                href="/categories"
                variant="outline"
                size="sm"
                className="rounded-pill border-amber-400/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 hover:border-amber-400/30"
                trailingIcon={<ArrowRight className="size-4" />}
              >
                Barcha yo&apos;nalishlar
              </ButtonLink>
            }
          />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-6">
        {categories.map((category, idx) => (
          <li key={category.id} className="flex">
            <CategoryCard
              category={category}
              courseCount={courseCounts.get(category.id) ?? 0}
              featured={idx === 0}
              className="w-full min-h-[12rem]"
            />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-right font-serif text-sm italic text-white/35">
        &ldquo;Yangi bilim — yangi imkoniyatlar&rdquo;
      </p>
    </Section>
  );
}
