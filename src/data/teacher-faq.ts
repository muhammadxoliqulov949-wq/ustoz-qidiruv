import type { FaqItem } from "./models";
import type { TeacherRow } from "./teacher-rows";
import { cityLabel } from "./courses";
import { formatPrice } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* FAQ builder for /teachers/[slug]. Mirrors course-faq.ts: every answer is       */
/* DERIVED from data the page already shows (formats, cities, pricing, group     */
/* caps, languages) — so it cannot contradict the cards, and unsupported items   */
/* are simply omitted rather than answered vaguely.                              */
/*                                                                              */
/* Phase 20: the teacher's courses arrive as a parameter (DB-projected rows      */
/* from getPublicTeacherBySlug), so this pure builder holds no fixture import    */
/* and cannot describe inventory the database does not have. Payment and         */
/* messaging answers describe the REAL flows: requests are reviewed by the       */
/* teacher, paid courses are settled in the student cabinet, and messaging       */
/* opens on an accepted enrollment.                                              */
/* -------------------------------------------------------------------------- */

interface FaqCourseGroups {
  detail: { groups: { capacity: number }[] };
}

export function buildTeacherFaq(row: TeacherRow, ownCourses: FaqCourseGroups[]): FaqItem[] {
  const { teacher, formats, cities, minPriceUzs } = row;
  const items: FaqItem[] = [];

  const where = formats
    .map((format) => {
      if (format === "online") return "onlayn darslar";
      if (format === "hybrid")
        return `sinf darslari + onlayn qatnashish${cities[0] ? ` (${cityLabel(cities[0])})` : ""}`;
      return cities[0] ? `sinf darslari (${cityLabel(cities[0])})` : "sinf darslari";
    })
    .join(" va ");
  if (where) {
    items.push({
      q: "Darslarni qayerda o‘tkazadi?",
      a: `Ushbu ustoz ${where} formatida ishlaydi — aniq joylashuv kurs kartochkalarida ko‘rsatilgan.`,
    });
  }

  items.push({
    q: "Qaysi tillarda dars beradi?",
    a: `Dars tillari: ${teacher.languages.join(", ")}.`,
  });

  if (minPriceUzs !== null) {
    items.push({
      q: "Dars narxlari qanday?",
      a:
        minPriceUzs === 0
          ? "Bu ustozning bepul kurslari ham, to‘lovli kurslari ham bor — aniq narx kurs sahifasida ko‘rsatilgan. Pullik kurslarda to‘lov so‘rovingiz qabul qilingandan so‘ng kabinetingiz orqali amalga oshiriladi."
          : `Kurslari ${formatPrice(minPriceUzs)}dan boshlanadi (oylik) — aniq narx kurs sahifasida. To‘lov so‘rovingiz ustoz tomonidan qabul qilingandan so‘ng kabinetingiz orqali amalga oshiriladi.`,
    });
  }

  const caps = ownCourses
    .flatMap((course) => course.detail.groups.map((group) => group.capacity));
  if (caps.length > 0) {
    items.push({
      q: "Guruhlar qanchalik katta?",
      a: `Kurslaridagi guruhlarning eng kattasi ${Math.max(...caps)} kishi — dasturlar kichik guruhlarni afzal ko‘radi.`,
    });
  }

  items.push({
    q: "Ustoz bilan qanday bog‘lanish mumkin?",
    a: "O‘zingizga mos kursni ustozning kurs ro‘yxatidan tanlab, kurs sahifasidagi yozilish shaklini to‘ldiring. So‘rovingiz qabul qilingach, ustoz bilan xabarlashish kabinetingizda ochiladi.",
  });

  return items;
}
