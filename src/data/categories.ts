import type { Category } from "./models";

/**
 * MOCK data only — Phase 2 homepage. Replace with the real API in a later
 * phase; do not present these numbers as production statistics.
 */
export const categories: Category[] = [
  { id: "english", slug: "ingliz-tili", name: "Ingliz tili", icon: "languages", courseCount: 128 },
  { id: "ielts", slug: "ielts", name: "IELTS", icon: "award", courseCount: 86 },
  { id: "math", slug: "matematika", name: "Matematika", icon: "sigma", courseCount: 154 },
  { id: "programming", slug: "dasturlash", name: "Dasturlash", icon: "code", courseCount: 212 },
  { id: "arabic", slug: "arab-tili", name: "Arab tili", icon: "scroll", courseCount: 47 },
  { id: "design", slug: "dizayn", name: "Dizayn", icon: "pen", courseCount: 63 },
];
