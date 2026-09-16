/* -------------------------------------------------------------------------- */
/* Admin workspace model — Phase 15.                                            */
/*                                                                              */
/* ONE navigation model, rendered by an admin client island in two shapes       */
/* (desktop rail + mobile tab strip), exactly like the student and teacher      */
/* navs. The admin area is a THIRD domain: it has its own layout, its own nav   */
/* and its own not-found, so no admin surface can be reached by accident while  */
/* browsing the teacher dashboard.                                             */
/* -------------------------------------------------------------------------- */

export interface AdminNavItem {
  href: string;
  label: string;
  icon: "overview" | "teachers" | "courses" | "reviews" | "refunds" | "activity";
  description: string;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin",
    label: "Umumiy",
    icon: "overview",
    description: "Navbatdagi arizalar va moderatsiya kutilayotgan kurslar.",
  },
  {
    href: "/admin/teachers",
    label: "Ustozlar",
    icon: "teachers",
    description: "Tasdiqlash arizalarini ko‘rib chiqish.",
  },
  {
    href: "/admin/courses",
    label: "Kurslar",
    icon: "courses",
    description: "Tayyor kurslarni moderatsiya qilish va e’lon qilish.",
  },
  {
    href: "/admin/reviews",
    label: "Fikrlar",
    icon: "reviews",
    description:
      "O‘quvchilar yozgan fikrlarni ko‘rib chiqish. Faqat e’lon qilingan fikrlar reytingni o‘zgartiradi.",
  },
  {
    href: "/admin/refunds",
    label: "Qaytarishlar",
    icon: "refunds",
    description:
      "O‘quvchilarning pulni qaytarish so‘rovlari. Tasdiqlash — bu qaror, to‘lovni qaytarishni esa provayder bajaradi.",
  },
  {
    href: "/admin/activity",
    label: "Jurnal",
    icon: "activity",
    description: "Administrator qarorlarining o‘zgarmas tarixi.",
  },
];

/** `/admin` is exact; every other item owns its subtree. */
export function isActiveAdminNav(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ADMIN_AREA_TITLE = "Administrator paneli";

export const ADMIN_AREA_DESCRIPTION =
  "Ustozlarni tasdiqlash va kurslarni moderatsiya qilish. Bu bo‘lim faqat administrator hisobi uchun.";

/** Shown to a signed-in student/teacher who opens an /admin URL. */
export const ADMIN_ACCESS_DENIED_TITLE = "Bu bo‘lim administrator uchun";

export const ADMIN_ACCESS_DENIED_BODY =
  "Sizning hisobingiz administrator emas, shuning uchun bu bo‘lim ko‘rsatilmaydi. O‘z panelingizga qaytishingiz mumkin.";
