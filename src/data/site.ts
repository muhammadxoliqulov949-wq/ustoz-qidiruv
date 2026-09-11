/**
 * USTOZ site data — Phase 1.
 * Navigation labels, routes and hero copy live here so pages/components
 * never hardcode strings. Route targets marked `#` are Phase 2 placeholders;
 * the navbar renders them inertly (no fake pages).
 */

export type NavItem = { label: string; href: string };

export const primaryNav: NavItem[] = [
  { label: "Kurslar", href: "/courses" },
  { label: "Ustozlar", href: "/teachers" },
  { label: "Kategoriyalar", href: "/categories" },
];

export const loginNav: NavItem = { label: "Kirish", href: "/login" };

export const becomeTeacherNav: NavItem = {
  label: "Ustoz bo‘lish",
  href: "/become-teacher",
};

/** Quick filters shown under the hero search. `toggle` pills are client-side
 *  filters later wired to /courses query params in Phase 2. */
export type QuickFilter = {
  id: string;
  label: string;
  href?: string;
};

export const quickFilters: QuickFilter[] = [
  { id: "toshkent", label: "Toshkent", href: "#locations" },
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

/** Footer link groups (Phase 2 homepage footer). Routes marked as future
 *  phases carry prefetch={false} until their pages exist. */
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
      { label: "Kurs yaratish", href: "/become-teacher" },
      { label: "Ustoz bo‘lish", href: "/become-teacher" },
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

