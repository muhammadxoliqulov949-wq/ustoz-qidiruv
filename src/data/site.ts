/**
 * USTOZ site data — Phase 1, wired to real routes in Phase 3.
 * Navigation labels, routes and hero copy live here so pages/components
 * never hardcode strings. `prefetch: false` marks routes that are still
 * not built (project convention: unbuilt links never prefetch); omit the
 * flag once a route exists.
 */

export type NavItem = { label: string; href: string; prefetch?: boolean };

export const primaryNav: NavItem[] = [
  { label: "Kurslar", href: "/courses" },
  { label: "Ustozlar", href: "/teachers" },
  { label: "Kategoriyalar", href: "/categories" },
];

export const loginNav: NavItem = {
  label: "Kirish",
  href: "/login",
};

export const becomeTeacherNav: NavItem = {
  label: "Ustoz bo‘lish",
  // Phase 6: teacher sign-up — role pre-selected; onboarding follows.
  // There is no separate /become-teacher marketing page (spec lists only
  // /login, /register, /onboarding), so the CTA lands on the real flow.
  href: "/register?role=teacher",
};

/** Quick filter pills under the hero search — real navigational links into
 *  the /courses results engine (see lib/course-search.ts for the URL
 *  contract). Toggled in Phase 1 for demo; now they navigate. */
export type QuickFilter = {
  id: string;
  label: string;
  href: string;
};

export const quickFilters: QuickFilter[] = [
  { id: "toshkent", label: "Ingliz tili", href: "/courses?city=toshkent" },
  { id: "online", label: "Matematika", href: "/courses?format=online" },
  { id: "offline", label: "IT Kurslari", href: "/courses?format=offline" },
  { id: "bepul", label: "Arab tili", href: "/courses?price=free" },
];

export const hero = {
  eyebrow: "Onlayn va offlayn ustozlar bazasi",
  title: "Sizga mos ustozni toping.",
  subtitle:
    "Tajribali va malakali ustozlar bilan o'zingiz istagan fan yoki ko'nikmani o'rganing — onlayn va offlayn formatlarda.",
  searchLabel: "Kurs yoki ustoz qidirish",
  searchPlaceholder: "Fan, ustoz ismi yoki yo'nalishni kiriting...",
} as const;

/** Browse pages copy — /courses and /categories results (Phase 3).
 *  `{count}` is interpolated by the components, never stored here.
 *  URL contract (see lib/course-search.ts): q, format, level, city,
 *  price, pmin, pmax, schedule, rating, sort — single-select facets. */
export const coursesPage = {
  title: "Kurslar",
  intro:
    "Yo‘nalish, format va narx bo‘yicha filtrlab, o‘zingizga mos kursni toping.",
  searchLabel: "Kurs qidirish",
  searchPlaceholder: "Kurs, ustoz yoki yo‘nalish nomi…",
  resultsWord: "ta natija",
  sortLabel: "Saralash",
  sorts: {
    recommended: "Tavsiya etilgan",
    rating: "Reyting",
    "price-asc": "Narx: arzon",
    "price-desc": "Narx: qimmat",
    newest: "Eng yangi",
  } as Record<string, string>,
  sections: {
    category: "Kategoriya",
    format: "Format",
    level: "Daraja",
    city: "Shahar",
    price: "Narx",
    range: "Oylik narx oralig‘i",
    schedule: "Dars vaqti",
    rating: "Reyting",
  },
  priceOptions: { free: "Bepul", paid: "Pullik" },
  range: { from: "dan", to: "gacha", apply: "Qo‘llash", unit: "so‘m" },
  filtersWord: "Filtrlar",
  clearFilters: "Filtrlarni tozalash",
  sheet: {
    open: "Filtrlar",
    title: "Filtrlar",
    close: "Filtrlarni yopish",
    cta: "ta kursni ko‘rsatish",
  },
  empty: {
    title: "Mos kurs topilmadi",
    text: "Filtrlarni o‘zgartirib ko‘ring yoki qidiruvni tozalang.",
    clearSearch: "Qidiruvni tozalash",
  },
} as const;

/** Teacher browse copy — /teachers (Phase 5). Same conventions as
 *  coursesPage: `{count}` is interpolated by components; URL contract
 *  lives in lib/teacher-search.ts (q, subject, format, city, lang,
 *  rating, exp, verified, sort — single-select facets). */
export const teachersPage = {
  title: "Ustozlar",
  intro:
    "Yo‘nalish, shahar, til va reyting bo‘yicha filtrlab, o‘quvchilari baholagan ustozni toping.",
  searchLabel: "Ustoz qidirish",
  searchPlaceholder: "Ustoz nomi, yo‘nalishi yoki tili…",
  resultsWord: "ta ustoz",
  sortLabel: "Saralash",
  sorts: {
    recommended: "Tavsiya etilgan",
    rating: "Reyting",
    students: "O‘quvchilar soni",
    experience: "Tajriba",
  } as Record<string, string>,
  sections: {
    subject: "Yo‘nalish",
    format: "Dars formati",
    city: "Shahar",
    language: "O‘quv tili",
    rating: "Reyting",
    experience: "Tajriba",
    verified: "Profil",
  },
  verifiedOption: "Faqat tasdiqlanganlar",
  filtersWord: "Filtrlar",
  clearFilters: "Filtrlarni tozalash",
  sheet: {
    open: "Filtrlar",
    title: "Filtrlar",
    close: "Filtrlarni yopish",
    cta: "ta ustozni ko‘rsatish",
  },
  empty: {
    title: "Mos ustoz topilmadi",
    text: "Filtrlarni o‘zgartirib ko‘ring yoki qidiruvni tozalang.",
    clearSearch: "Qidiruvni tozalash",
  },
} as const;

export const categoriesPage = {
  title: "Kategoriyalar",
  intro:
    "Har bir yo‘nalishni tanlab, shu bo‘yicha kurslar va ustozlarni bir joyda ko‘ring.",
  coursesWord: "kurs topildi",
} as const;

/** Footer link groups (Phase 2 homepage footer). Every link resolves to a built
 *  route — the informational pages landed in Phase 20, so no prefetch:false
 *  flags remain. (Convention, kept for the future: unbuilt links must never
 *  prefetch — set prefetch:false until the route exists.) */
export const footerGroups: { title: string; links: NavItem[] }[] = [
  {
    title: "O‘rganish",
    links: [
      { label: "Kurslar", href: "/courses" },
      { label: "Ustozlar", href: "/teachers" },
      { label: "Kategoriyalar", href: "/categories" },
    ],
  },
  {
    title: "Ustozlar uchun",
    links: [
      { label: "Kurs yaratish", href: "/register?role=teacher" },
      { label: "Ustoz bo‘lish", href: "/register?role=teacher" },
    ],
  },
  {
    title: "USTOZ",
    links: [
      { label: "Biz haqimizda", href: "/about" },
      { label: "Yordam", href: "/help" },
      { label: "Aloqa", href: "/contacts" },
    ],
  },
  {
    title: "Huquqiy",
    links: [
      { label: "Maxfiylik siyosati", href: "/privacy" },
      { label: "Foydalanish shartlari", href: "/terms" },
    ],
  },
];

/** Trust promises — product capabilities only, never invented statistics. */
export const trustPromises = {
  title: "Nega USTOZ?",
  items: [
    {
      id: "profile",
      icon: "file",
      title: "Ustoz haqida to‘liq ma’lumot",
      text: "Har bir ustozning yo‘nalishi, tajribasi, tillari va o‘quvchilar fikrlari bir joyda.",
    },
    {
      id: "formats",
      icon: "layers",
      title: "Online va offline kurslar",
      text: "Masofadan yoki shahringizda — formatni qidiruv va filtrlardan tanlaysiz.",
    },
    {
      id: "pricing",
      icon: "wallet",
      title: "Ochiq narxlar",
      text: "Kurs narxi kartochkada ko‘rsatiladi; yashirin to‘lovlar yo‘q.",
    },
    {
      id: "reviews",
      icon: "messages",
      title: "O‘quvchi fikrlari",
      text: "Kurslarni o‘qigan o‘quvchilarning baholari va izohlarini ko‘rasiz.",
    },
  ],
} as const;

/** “How USTOZ works” — three editorial steps. */
export const howItWorks = {
  title: "Qanday ishlaydi",
  steps: [
    {
      id: "find",
      number: "01",
      title: "Qidiring",
      text: "Fan, yo'nalish yoki ustoz ismini kiriting va qidiruvni boshlang.",
    },
    {
      id: "choose",
      number: "02",
      title: "Taqqoslang",
      text: "Ustozlarning reytingi, tajribasi, narxi va joylashuvini solishtiring.",
    },
    {
      id: "start",
      number: "03",
      title: "Bog'laning",
      text: "Tanlagan ustozingiz bilan bog'laning va birinchi darsni boshlang.",
    },
  ],
} as const;

/** Online/Offline editorial duet. */
export const formatEditorial = {
  title: "Sizga mos formatda o'rganing",
  items: [
    {
      id: "online",
      title: "Onlayn ta'lim",
      text: "Uyda, ishda yoki yo'lda — istalgan joydan onlayn darslarga qo'shiling. Video darslar, jonli uchrashuvlar va amaliy topshiriqlar.",
      action: { label: "Onlayn darslarni ko'rish", href: "/courses?format=online" },
    },
    {
      id: "offline",
      title: "Oflayn ta'lim",
      text: "Shahringizdagi sinfda, guruh bilan, ustoz yonida — an'anaviy muhitda, yuzma-yuz o'rganing.",
      action: { label: "Oflayn darslarni topish", href: "/courses?format=offline" },
    },
  ],
} as const;

/** Teacher acquisition CTA. */
export const teacherCta = {
  title: "Bilimingizni ulashing, o'quvchilaringizni toping",
  text: "O'z bilimingizni minglab o'quvchilar bilan ulashing. Kurs yarating, jadvalingizni boshqaring va daromad qiling — barchasi USTOZ platformasida.",
  action: { label: "Ustoz bo'lish", href: "/register?role=teacher" },
} as const;
