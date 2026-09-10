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
