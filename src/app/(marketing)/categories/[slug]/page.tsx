import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CoursesBrowser } from "@/components/courses/courses-browser";
import { categories } from "@/data/categories";
import { listPublicCourses } from "@/server/public-repo";
import { parseCourseBrowseParams } from "@/lib/course-search";

/* -------------------------------------------------------------------------- */
/* /categories/[slug] — a category-scoped view of the SAME results engine         */
/* as /courses (CoursesBrowser), with the category locked in the path rather      */
/* than in the query string. Phase 12: the category filter is pushed into SQL      */
/* (categoryId + published), so the page never loads the full catalogue.           */
/* RENDERING: dynamic SSR, same reasoning as /courses.                             */
/* than duplicated as a query param. Facets (mode/price/city/sort/q) live on      */
/* the query string of this route — links are rewritten against the basePath.     */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function findCategory(slug: string) {
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) return { title: "Kategoriya topilmadi" };
  return {
    title: `${category.name} kurslari`,
    description: `${category.name} yo‘nalishidagi onlayn va offlayn kurslar — format, narx va shahar bo‘yicha filtrlab tanlang.`,
  };
}

export default async function CategoryResultsPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();

  const browseParams = parseCourseBrowseParams(await searchParams);
  const source = await listPublicCourses(browseParams, { categoryId: category.id });

  return (
    <CoursesBrowser
      basePath={`/categories/${category.slug}`}
      eyebrow="Kategoriya"
      title={`${category.name} kurslari`}
      description={`${category.name} bo‘yicha kurslar: onlayn va offlayn formatlar, ochiq narxlar va shahar bo‘yicha filtr — bir joyda.`}
      source={source}
      params={browseParams}
      activeCategorySlug={category.slug}
      breadcrumb={
        <nav
          aria-label="Sahifalar yo‘li"
          className="flex items-center gap-1.5 text-sm text-ink-500"
        >
          <Link
            href="/categories"
            className="rounded-md transition-colors duration-fast hover:text-ink-900 focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35 focus-visible:outline-none"
          >
            Kategoriyalar
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5 text-ink-400" />
          <span aria-current="page" className="font-medium text-ink-900">
            {category.name}
          </span>
        </nav>
      }
    />
  );
}
