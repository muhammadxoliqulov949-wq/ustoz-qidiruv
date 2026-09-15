import type { Category } from "./models";

/**
 * STATIC PRODUCT TAXONOMY — the six fixed categories of the marketplace.
 *
 * This is vocabulary, not inventory. The same ids and slugs back the course
 * `categoryId` column and its validation, the /categories/[slug] routes, the
 * browse filter labels and the teacher authoring form, so the list is a product
 * decision rather than a marketplace record and is deliberately not read from
 * the database.
 *
 * It holds NO course counts. “How many published courses are in this category”
 * is inventory, counted at request time by `getCategoryCourseCounts()`
 * (src/server/public-repo.ts) and passed to `CategoryCard` as a prop — a number
 * stored here would be a statistic nothing keeps true, and the homepage used to
 * render exactly that.
 */
export const categories: Category[] = [
  { id: "english", slug: "ingliz-tili", name: "Ingliz tili", icon: "languages" },
  { id: "ielts", slug: "ielts", name: "IELTS", icon: "award" },
  { id: "math", slug: "matematika", name: "Matematika", icon: "sigma" },
  { id: "programming", slug: "dasturlash", name: "Dasturlash", icon: "code" },
  { id: "arabic", slug: "arab-tili", name: "Arab tili", icon: "scroll" },
  { id: "design", slug: "dizayn", name: "Dizayn", icon: "pen" },
];
