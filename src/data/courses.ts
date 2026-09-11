import type { Course, CourseFormat } from "./models";

/**
 * MOCK data only — the full browse catalog behind /courses and
 * /categories/[slug]. Names/ratings/prices are illustrative marketplace
 * content, not real listings. Future API responses must satisfy `Course`
 * (see models.ts); the order of this array IS the "Tavsiya etilgan"
 * (recommended) sort — keep curated picks first.
 */
export const courses: Course[] = [
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
    priceUzs: 890_000,
    image: "/media/courses/ielts.jpg",
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
    priceUzs: 450_000,
    image: "/media/courses/ielts.jpg",
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
    priceUzs: 480_000,
    image: "/media/courses/english.jpg",
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
    priceUzs: 320_000,
    image: "/media/courses/english.jpg",
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
    priceUzs: 0,
    image: "/media/courses/math.jpg",
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
    priceUzs: 720_000,
    image: "/media/courses/math.jpg",
  },
  {
    id: "c-algebra-sinav",
    slug: "algebra-nazorat-sinovlari",
    title: "Algebra: har oylik nazorat sinovlariga tayyorlov",
    categoryId: "math",
    teacher: { id: "t-rustam-alimov", name: "Rustam Alimov", verified: true },
    rating: 4.5,
    reviews: 52,
    students: 340,
    format: "online",
    location: null,
    city: null,
    priceUzs: 380_000,
    image: "/media/courses/math.jpg",
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
    priceUzs: 1_200_000,
    image: "/media/courses/programming.jpg",
  },
  {
    id: "c-python-boshlangich",
    slug: "python-boshlangich-daraja",
    title: "Python dasturlash tili: noldan birinchi loyihagacha",
    categoryId: "programming",
    teacher: { id: "t-behzod-karimov", name: "Behzod Karimov", verified: true },
    rating: 4.8,
    reviews: 187,
    students: 1150,
    format: "hybrid",
    location: "Toshkent, Mirzo Ulug‘bek",
    city: "toshkent",
    priceUzs: 990_000,
    image: "/media/courses/programming.jpg",
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
    priceUzs: 0,
    image: "/media/courses/arabic.jpg",
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
    priceUzs: 250_000,
    image: "/media/courses/arabic.jpg",
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
    priceUzs: 950_000,
    image: "/media/courses/design.jpg",
  },
];

/** Home shortcut: the first N entries act as the curated “recommended” row. */
export const recommendedCourses: Course[] = courses.slice(0, 6);

/** Display labels for the format facet — shared by cards and the filter bar. */
export const courseFormatLabels: Record<CourseFormat, string> = {
  online: "Online",
  offline: "Offline",
  hybrid: "Gibrid",
};

/**
 * Cities present in the catalog (derived — the source of truth for the
 * city facet, so a mock course in a new city appears in the UI without
 * any component change).
 */
export const courseCities: string[] = Array.from(
  new Set(courses.map((course) => course.city).filter((city): city is string => city !== null)),
).sort();

/** "toshkent" → "Toshkent" (ASCII-safe capitalize for our city slugs). */
export function cityLabel(city: string): string {
  return city.charAt(0).toUpperCase() + city.slice(1);
}
