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
  { label: "Ustozlar", href: "/teachers", prefetch: false }, // teachers browse lands later
  { label: "Kategoriyalar", href: "/categories" },
];

export const loginNav: NavItem = {
  label: "Kirish",
  href: "/login",
  prefetch: false, // auth phase
};

export const becomeTeacherNav: NavItem = {
  label: "Ustoz bo‘lish",
  href: "/become-teacher",
  prefetch: false, // teacher onboarding phase
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
  { id: "toshkent", label: "Toshkent", href: "/courses?city=toshkent" },
  { id: "online", label: "Online", href: "/courses?mode=online" },
  { id: "offline", label: "Offline", href: "/courses?mode=offline" },
  { id: "bepul", label: "Bepul kurslar", href: "/courses?price=free" },
];

export const hero = {
  eyebrow: "Onlayn va offlayn ustozlar bazasi",
  title: "Sizga mos ustozni toping.",
  subtitle:
    "Minglab kurslar va ustozlar bir joyda — onlayn yoki shahringizda offlayn. " +
    "Yo‘nalish, format va byudjet bo‘yicha filtrlab, o‘zingizga mos o‘qituvchini " +
    "bir necha daqiqada toping.",
  searchLabel: "Kurs yoki ustoz qidirish",
  searchPlaceholder: "Nima o‘rganmoqchisiz?",
} as const;

/** Browse pages copy — /courses and /categories results (Phase 3).
 *  `{count}` is interpolated by the components, never stored here. */
export const coursesPage = {
  title: "Kurslar",
  intro:
    "Yo‘nalish, format va narx bo‘yicha filtrlab, o‘zingizga mos kursni toping.",
  searchLabel: "Kurs qidirish",
  searchPlaceholder: "Kurs, ustoz yoki yo‘nalish nomi…",
  anyMode: "Barchasi",
  freeOnly: "Faqat bepul",
  anyCity: "Barcha shaharlar",
  cityLabel: "Shahar",
  sortLabel: "Saralash",
  sorts: {
    recommended: "Tavsiya etilgan",
    rating: "Yuqori reyting",
    popular: "Ommabop",
    "price-asc": "Avval arzon",
    "price-desc": "Avval qimmat",
  } as Record<string, string>,
  filtersWord: "Filtrlar",
  clearFilters: "Filtrlarni tozalash",
  empty: {
    title: "Hech narsa topilmadi",
    text:
      "So‘rovingizni o‘zgartirib ko‘ring yoki filtrlarni tozalang — katalogimiz doimiy to‘ldiriladi.",
  },
} as const;

export const categoriesPage = {
  title: "Kategoriyalar",
  intro:
    "Har bir yo‘nalishni tanlab, shu bo‘yicha kurslar va ustozlarni bir joyda ko‘ring.",
  coursesWord: "kurs topildi",
} as const;

/** Footer link groups (Phase 2 homepage footer). Routes marked
 *  prefetch:false are future phases; built routes omit the flag. */
export const footerGroups: { title: string; links: NavItem[] }[] = [
  {
    title: "O‘rganish",
    links: [
      { label: "Kurslar", href: "/courses" },
      { label: "Ustozlar", href: "/teachers", prefetch: false },
      { label: "Kategoriyalar", href: "/categories" },
    ],
  },
  {
    title: "Ustozlar uchun",
    links: [
      { label: "Kurs yaratish", href: "/become-teacher", prefetch: false },
      { label: "Ustoz bo‘lish", href: "/become-teacher", prefetch: false },
    ],
  },
  {
    title: "USTOZ",
    links: [
      { label: "Biz haqimizda", href: "/about", prefetch: false },
      { label: "Yordam", href: "/help", prefetch: false },
      { label: "Aloqa", href: "/contacts", prefetch: false },
    ],
  },
  {
    title: "Huquqiy",
    links: [
      { label: "Maxfiylik siyosati", href: "/privacy", prefetch: false },
      { label: "Foydalanish shartlari", href: "/terms", prefetch: false },
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
  title: "Ustoz qanday ishlaydi?",
  steps: [
    {
      id: "find",
      number: "01",
      title: "Qidiring",
      text: "O‘rganmoqchi bo‘lgan yo‘nalishingizni toping.",
    },
    {
      id: "choose",
      number: "02",
      title: "Tanlang",
      text: "Kurslar va ustozlarni taqqoslang.",
    },
    {
      id: "start",
      number: "03",
      title: "Boshlang",
      text: "Kursga yoziling va o‘rganishni boshlang.",
    },
  ],
} as const;

/** Online/Offline editorial duet. */
export const formatEditorial = {
  title: "Qayerda bo‘lsangiz ham o‘rganing.",
  items: [
    {
      id: "online",
      title: "Online",
      text: "Uydan, sayohatda yoki dam olish kunlari — istalgan joydan turib onlayn kurslarga yozilishingiz mumkin.",
      action: { label: "Online kurslarni ko‘rish", href: "/courses?mode=online" },
    },
    {
      id: "offline",
      title: "Offline",
      text: "Shahringizdagi yaqin kurslar va ustozlarni toping: guruh bilan, yuzma-yuz, tanish muhitda o‘qing.",
      action: { label: "Offline kurslarni topish", href: "/courses?mode=offline" },
    },
  ],
} as const;

/** Teacher acquisition CTA. */
export const teacherCta = {
  title: "Bilimingizni ulashing.",
  text: "Kurs yarating, o‘quvchilaringizni toping va darslaringizni USTOZ orqali boshqaring.",
  action: { label: "Ustoz bo‘lish", href: "/become-teacher" },
} as const;
