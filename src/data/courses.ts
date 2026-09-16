import type {
  Course,
  CourseFormat,
  CourseLevel,
  CourseSchedule,
} from "./models";

/**
 * SEED FIXTURE — 15 illustrative listings with fictional instructors.
 *
 * Since Phase 12 this array is NOT the browse catalogue: /courses,
 * /categories/[slug] and the detail routes read PostgreSQL through
 * src/server/public-repo.ts, and `npm run db:seed` (development only — it
 * refuses to run in production) projects these rows into the database. No
 * public page renders this array, so nothing here is a real listing or
 * statistic.
 *
 * RUNTIME-SAFE EXPORTS IN THIS FILE (static vocabulary, not inventory):
 * `courseFormatLabels`, `courseLevelLabels`, `courseScheduleLabels`,
 * `courseRatingFilters`, `cityLabel`. SEED-ONLY: the `courses` array.
 *
 * Seed-data rules:
 *  • array order IS the “Tavsiya etilgan” (recommended) sort — curated
 *    picks first; keep it stable;
 *  • every field used by a URL filter must be present on every entry
 *    (level, schedule, publishedAt) — filters never special-case absence;
 *  • publishedAt is the lexicographically sortable source for “Eng yangi”;
 *  • ratings deliberately straddle the 4.0 and 4.5 facets so filtering
 *    visibly does something;
 *  • free courses (priceUzs 0) are all online — coherent product logic.
 */
import { courseDetailsById } from "./course-details";

/** List-shape fields only; `detail` is merged below from course-details.ts. */
const courseSeeds: Omit<Course, "detail">[] = [
  {
    id: "c-ielts-intensive",
    slug: "ielts-intensive-band-7",
    title: "IELTS: Band 7.0+ uchun intensiv tayyorlov",
    categoryId: "ielts",
    teacher: { id: "t-dilshod-rahimov", name: "Dilshod Rahimov", verified: true },
    rating: 4.9,
    reviews: 214,
    students: 1260,
    format: "online",
    location: null,
    city: null,
    level: "yuqori",
    schedule: "evening",
    publishedAt: "2026-07-02",
    priceUzs: 890_000,
    image: "/media/courses/ielts.jpg",
    keywords: ["immigratsiya", "exam", "speaking", "band"],
  },
  {
    id: "c-ielts-speaking",
    slug: "ielts-speaking-klub",
    title: "IELTS Speaking: haftalik amaliyot klubi",
    categoryId: "ielts",
    teacher: { id: "t-dilshod-rahimov", name: "Dilshod Rahimov", verified: true },
    rating: 4.8,
    reviews: 89,
    students: 540,
    format: "online",
    location: null,
    city: null,
    level: "orta",
    schedule: "morning",
    publishedAt: "2026-03-14",
    priceUzs: 450_000,
    image: "/media/courses/ielts.jpg",
    keywords: ["speaking", "muloqot", "klub"],
  },
  {
    id: "c-general-english",
    slug: "umumiy-ingliz-tili-a2-b1",
    title: "Umumiy ingliz tili: A2 darajadan B1 ga",
    categoryId: "english",
    teacher: { id: "t-kamola-yuldosheva", name: "Kamola Yuldosheva", verified: false },
    rating: 4.7,
    reviews: 96,
    students: 430,
    format: "hybrid",
    location: "Toshkent, Yunusobod",
    city: "toshkent",
    level: "boshlangich",
    schedule: "day",
    publishedAt: "2026-05-20",
    priceUzs: 480_000,
    image: "/media/courses/english.jpg",
    keywords: ["grammatika", "a2", "b1"],
  },
  {
    id: "c-english-kichik",
    slug: "ingliz-tili-boshlangich-maktab",
    title: "Ingliz tili: 3–5-sinf uchun boshlang‘ich guruh",
    categoryId: "english",
    teacher: { id: "t-zilola-akbarova", name: "Zilola Akbarova", verified: true },
    rating: 4.9,
    reviews: 64,
    students: 310,
    format: "offline",
    location: "Samarqand, Registon",
    city: "samarqand",
    level: "boshlangich",
    schedule: "morning",
    publishedAt: "2026-06-01",
    priceUzs: 320_000,
    image: "/media/courses/english.jpg",
    keywords: ["maktab", "bolalar", "sinf"],
  },
  {
    id: "c-english-conversation",
    slug: "ingliz-tili-muloqot-klubi",
    title: "Ingliz tili muloqot klubi: erkin gapirish ko‘nikmasi",
    categoryId: "english",
    teacher: { id: "t-malika-sattorova", name: "Malika Sattorova", verified: false },
    rating: 4.4,
    reviews: 88,
    students: 610,
    format: "online",
    location: null,
    city: null,
    level: "orta",
    schedule: "evening",
    publishedAt: "2026-08-11",
    priceUzs: 0,
    image: "/media/courses/english.jpg",
    keywords: ["speaking club", "muloqot", "bepul"],
  },
  {
    id: "c-math-children",
    slug: "matematika-maktabgacha-mantiq",
    title: "Matematika va mantiq: maktabgacha ta’lim guruhlariga tayyorlov",
    categoryId: "math",
    teacher: { id: "t-shahnoza-tursunova", name: "Shahnoza Tursunova", verified: false },
    rating: 4.6,
    reviews: 41,
    students: 205,
    format: "offline",
    location: "Farg‘ona, Markaziy",
    city: "fargona",
    level: "boshlangich",
    schedule: "day",
    publishedAt: "2026-01-18",
    priceUzs: 0,
    image: "/media/courses/math.jpg",
    keywords: ["maktabgacha", "mantiq", "bepul"],
  },
  {
    id: "c-math-dtm",
    slug: "matematika-9-11-sinf-dtm",
    title: "Matematika: 9–11-sinf chuqurlashtirilgan kurs va DTM tayyorlov",
    categoryId: "math",
    teacher: { id: "t-nodira-yusupova", name: "Nodira Yusupova", verified: true },
    rating: 4.8,
    reviews: 156,
    students: 890,
    format: "offline",
    location: "Toshkent, Chilonzor",
    city: "toshkent",
    level: "orta",
    schedule: "evening",
    publishedAt: "2025-12-05",
    priceUzs: 720_000,
    image: "/media/courses/math.jpg",
    keywords: ["dtm", "sirtmoq", "universitet", "test"],
  },
  {
    id: "c-algebra-sinav",
    slug: "algebra-nazorat-sinovlari",
    title: "Algebra: har oylik nazorat sinovlariga tayyorlov",
    categoryId: "math",
    teacher: { id: "t-rustam-alimov", name: "Rustam Alimov", verified: true },
    rating: 4.3,
    reviews: 52,
    students: 340,
    format: "online",
    location: null,
    city: null,
    level: "orta",
    schedule: "morning",
    publishedAt: "2026-02-27",
    priceUzs: 380_000,
    image: "/media/courses/math.jpg",
    keywords: ["algebra", "sinov", "maktab"],
  },
  {
    id: "c-frontend",
    slug: "frontend-dasturlash-noldan",
    title: "Frontend dasturlash: HTML, CSS va JavaScript noldan",
    categoryId: "programming",
    teacher: { id: "t-sardor-qodirov", name: "Sardor Qodirov", verified: true },
    rating: 4.9,
    reviews: 342,
    students: 2100,
    format: "online",
    location: null,
    city: null,
    level: "boshlangich",
    schedule: "evening",
    publishedAt: "2026-09-01",
    priceUzs: 1_200_000,
    image: "/media/courses/programming.jpg",
    keywords: ["html", "css", "javascript", "it"],
  },
  {
    id: "c-python-boshlangich",
    slug: "python-boshlangich-daraja",
    title: "Python dasturlash tili: noldan birinchi loyihagacha",
    categoryId: "programming",
    teacher: { id: "t-behzod-karimov", name: "Behzod Karimov", verified: true },
    rating: 4.6,
    reviews: 187,
    students: 1150,
    format: "hybrid",
    location: "Toshkent, Mirzo Ulug‘bek",
    city: "toshkent",
    level: "boshlangich",
    schedule: "day",
    publishedAt: "2026-04-09",
    priceUzs: 990_000,
    image: "/media/courses/programming.jpg",
    keywords: ["python", "dasturlash", "loyiha"],
  },
  {
    id: "c-frontend-react",
    slug: "react-professional",
    title: "React va TypeScript: professional darajadagi ilovalar",
    categoryId: "programming",
    teacher: { id: "t-sardor-qodirov", name: "Sardor Qodirov", verified: true },
    rating: 4.7,
    reviews: 163,
    students: 940,
    format: "online",
    location: null,
    city: null,
    level: "yuqori",
    schedule: "evening",
    publishedAt: "2026-08-25",
    priceUzs: 1_500_000,
    image: "/media/courses/programming.jpg",
    keywords: ["react", "typescript", "it", "frontend"],
  },
  {
    id: "c-arabic-boshlangich",
    slug: "arab-tili-boshlangich",
    title: "Arab tili boshlang‘ich: o‘qish va kundalik muloqot",
    categoryId: "arabic",
    teacher: { id: "t-malika-ergasheva", name: "Malika Ergasheva", verified: false },
    rating: 4.6,
    reviews: 58,
    students: 190,
    format: "online",
    location: null,
    city: null,
    level: "boshlangich",
    schedule: "morning",
    publishedAt: "2025-11-30",
    priceUzs: 0,
    image: "/media/courses/arabic.jpg",
    keywords: ["o‘qish", "bepul", "muloqot"],
  },
  {
    id: "c-arabic-quran",
    slug: "arab-tili-quron-matnlarini-tushunish",
    title: "Arab tili: Qur’on matnlarini tushunish kursi",
    categoryId: "arabic",
    teacher: { id: "t-ubaydullo-nasriddinov", name: "Ubaydullo Nasriddinov", verified: true },
    rating: 4.7,
    reviews: 73,
    students: 420,
    format: "offline",
    location: "Buxoro, Markaziy",
    city: "buxoro",
    level: "orta",
    schedule: "day",
    publishedAt: "2026-06-15",
    priceUzs: 250_000,
    image: "/media/courses/arabic.jpg",
    keywords: ["quron", "grammatika", "matn"],
  },
  {
    id: "c-uiux",
    slug: "ui-ux-dizayn-noldan",
    title: "UI/UX dizayn: wireframe’dan Figma gacha",
    categoryId: "design",
    teacher: { id: "t-aziza-nazarova", name: "Aziza Nazarova", verified: true },
    rating: 4.8,
    reviews: 121,
    students: 640,
    format: "offline",
    location: "Toshkent, Mirzo Ulug‘bek",
    city: "toshkent",
    level: "boshlangich",
    schedule: "evening",
    publishedAt: "2026-07-28",
    priceUzs: 950_000,
    image: "/media/courses/design.jpg",
    keywords: ["figma", "wireframe", "dizayn"],
  },
  {
    id: "c-graphic-design",
    slug: "grafik-dizayn-ps",
    title: "Grafik dizayn: Photoshop va Illustrator bilan amaliy kurs",
    categoryId: "design",
    teacher: { id: "t-javohir-xolliyev", name: "Javohir Xolliyev", verified: false },
    rating: 3.9,
    reviews: 26,
    students: 150,
    format: "hybrid",
    location: "Andijon, Markaziy",
    city: "andijon",
    level: "orta",
    schedule: "day",
    publishedAt: "2026-05-06",
    priceUzs: 600_000,
    image: "/media/courses/design.jpg",
    keywords: ["photoshop", "illustrator", "grafik"],
  },
];

/**
 * The browse/home-facing catalog: seed row + its detail payload in one
 * object. A missing CourseDetail is a build-time data error — fail loudly
 * so a course can never ship without its detail fields.
 */
export const courses: Course[] = courseSeeds.map((seed) => {
  const detail = courseDetailsById[seed.id];
  if (!detail) {
    throw new Error(
      `Missing CourseDetail for "${seed.id}" — add it to src/data/course-details.ts`,
    );
  }
  return { ...seed, detail };
});

/* There is deliberately no `recommendedCourses` export here any more. The     */
/* homepage recommendation row is read from PostgreSQL at request time          */
/* (listPublicCourses in src/server/public-repo.ts); a curated slice of this    */
/* fixture array would render cards whose /courses/[slug] route 404s, because   */
/* that route resolves against the database. This file is seed input + static   */
/* label vocabulary only.                                                       */

/** Display labels for the format facet — shared by cards and filters. */
export const courseFormatLabels: Record<CourseFormat, string> = {
  online: "Online",
  offline: "Offline",
  hybrid: "Gibrid",
};

export const courseLevelLabels: Record<CourseLevel, string> = {
  boshlangich: "Boshlang‘ich",
  orta: "O‘rta",
  yuqori: "Yuqori",
};

export const courseScheduleLabels: Record<CourseSchedule, string> = {
  morning: "Ertalab",
  day: "Kunduzi",
  evening: "Kechqurun",
};

/** Rating facet thresholds (URL value → display label). */
export const courseRatingFilters = [
  { value: "4.0", label: "4.0 va yuqori", min: 4.0 },
  { value: "4.5", label: "4.5 va yuqori", min: 4.5 },
] as const;

/* Phase 20: the fixture-derived `courseCities` list is DELETED. Form vocabularies
 * read the static taxonomy (src/data/taxonomy.ts); browse filter OPTIONS and
 * the URL whitelist come from live database rows (getPublicFacets +
 * parseCourseBrowseParams with a runtime allow-list). A city facet derived
 * from seed inventory would bless fixture-only cities and reject real ones. */

/** "toshkent" → "Toshkent" (ASCII-safe capitalize for our city slugs). */
export function cityLabel(city: string): string {
  return city.charAt(0).toUpperCase() + city.slice(1);
}
