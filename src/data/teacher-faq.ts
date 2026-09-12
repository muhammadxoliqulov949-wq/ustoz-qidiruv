import type { FaqItem } from "./models";
import type { TeacherRow } from "./teacher-rows";
import { cityLabel, courses } from "./courses";
import { formatPrice } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* FAQ builder for /teachers/[slug] (Phase 5). Mirrors course-faq.ts: every       */
/* answer is DERIVED from data the page already shows (formats, cities, pricing, */
/* group caps, languages) — so it cannot contradict the cards, and unsupported    */
/* items are simply omitted rather than answered vaguely. No payment promises.    */
/* -------------------------------------------------------------------------- */

export function buildTeacherFaq(row: TeacherRow): FaqItem[] {
  const { teacher, formats, cities, minPriceUzs, courseIds } = row;
  const ownCourses = courses.filter((course) => courseIds.includes(course.id));
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
          ? "Bu ustozning bepul kurslari ham, to‘lovli kurslari ham bor — aniq narx kurs sahifasida ko‘rsatilgan. To‘lov shartlarini ustoz bilan bevosita kelishasiz."
          : `Kurslari ${formatPrice(minPriceUzs)}dan boshlanadi (oylik) — aniq narx kurs sahifasida. USTOZ onlayn to‘lovni hozircha taklif qilmaydi, shartlar ustoz bilan kelishiladi.`,
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
    a: "Hozircha USTOZ’da shaxsiy xabar almashinuvi yo‘q. O‘zingizga mos kursni ustozning kurs ro‘yxatidan tanlab, kurs sahifasidagi yozilish bo‘limidan davom eting.",
  });

  return items;
}
