import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/section";
import { categoryIcons } from "@/components/icons";
import { categories } from "@/data/categories";
import { formatCount } from "@/lib/format";
import { HomeSectionHeading } from "./home-section-heading";

export interface PopularCategoriesProps {
  courseCounts: Map<string, number>;
}

export function PopularCategories({ courseCounts }: PopularCategoriesProps) {
  return (
    <Section ariaLabelledby="popular-categories-title" className="home-section">
      <HomeSectionHeading
        id="popular-categories-title"
        eyebrow="Yo‘nalishlar"
        title={<>Mashhur <span className="home-title-accent">yo‘nalishlar</span></>}
        description="Talab yuqori bo‘lgan yo‘nalishlardan boshlang va real kurslar ichidan tanlang."
        action={
          <Link href="/categories" className="home-outline-link">
            Barcha yo‘nalishlar <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      <ul className="home-category-grid">
        {categories.map((category, index) => {
          const Icon = categoryIcons[category.icon];
          const count = courseCounts.get(category.id) ?? 0;
          return (
            <li key={category.id} className={`home-category-slot home-category-slot-${index + 1}`}>
              <Link href={`/categories/${category.slug}`} className="home-category-card">
                <span className="home-category-icon" aria-hidden="true"><Icon /></span>
                <span className="home-category-copy">
                  {index === 0 ? <small>Tanlangan yo‘nalish</small> : null}
                  <strong>{category.name}</strong>
                  <span>{formatCount(count)} ta e’lon qilingan kurs</span>
                </span>
                <span className="home-card-arrow" aria-hidden="true"><ArrowUpRight /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
