import type { Course, FaqItem } from "./models";
import { formatPrice } from "@/lib/format";

/**
 * FAQ builder for the Phase 4 detail page.
 *
 * Answers that can be TRUE for a given course (venue, price behavior, seat
 * sizes) are derived from its typed data — the same fields the UI shows —
 * so the FAQ can never contradict the listing. Only the neutral items are
 * shared. A future API will return precomputed FaqItem[] per course; the
 * output shape is already that contract.
 *
 * Honesty rules honored here: no payment promises (on-page checkout does
 * not exist) and no certificate promises.
 */
export function buildCourseFaq(course: Course): FaqItem[] {
  const { detail } = course;
  const venue =
    course.format === "online"
      ? "Barcha darslar onlayn o‘tadi — havola va materiallar ro‘yxati darsdan oldin yuboriladi."
      : course.format === "offline"
        ? `Darslar ${course.location ?? "belgilangan manzilda"} o‘tadi.`
        : `Sinf darslari ${course.location ?? "belgilangan manzil"}da bo‘lib, onlayn qatnashuvchilar shu darsning jonli efirini oladi.`;

  const scheduleSwap = detail.groups.every((group) => group.format === "online")
    ? "Ha — guruh jadvali ichida joy bo‘lsa, boshqa guruhga o‘tish mumkin. O‘tish bir o‘quv sikli boshida amalga oshadi."
    : "Ha — guruhlar orasida joy bo‘lsa, o‘tish mumkin. Manil tufayli (masalan, tashqarida bo‘lish) ham onlayn guruhga vaqtincha qo‘shilish imkoniyati ko‘rib chiqiladi.";

  const items: FaqItem[] = [
    {
      q: "Darslar qayerda va qachon o‘tadi?",
      a: `${venue} Tanlangan guruhning kun va boshlanish vaqti sahifadagi “Jadval va guruhlar” bo‘limida ko‘rsatilgan.`,
    },
    {
      q: "Kurs narxi qancha va to‘lov qanday bo‘ladi?",
      a: `Ko‘rsatilgan narx — ${course.priceUzs > 0 ? `${formatPrice(course.priceUzs)} (${detail.pricePeriod === "month" ? "oylik" : "kurs uchun bir marta"}).` : "Bepul kurs.”"} To‘lov shartlari yozilishda bevosita ustoz bilan kelishiladi — USTOZ’da hozircha onlayn to‘lov oqimi ishga tushmagan.`,
    },
    {
      q: "Guruh vaqtini o‘zgartirsa bo‘ladimi?",
      a: scheduleSwap,
    },
    {
      q: "Guruhda nechta o‘quvchi bo‘ladi?",
      a: `Guruhlar maksimum ${Math.max(...detail.groups.map((g) => g.capacity))} kishidan oshmaydi; joylar soni har guruh uchun alohida ko‘rsatilgan.`,
    },
    {
      q: "Darsga nima kerak bo‘ladi?",
      a:
        course.format === "offline"
          ? "Daftar, ruchka va darslik — bosma materiallar sinfda tarqatiladi."
          : "Tinch muhit, quloqchin, laptop (yoki telefon) va barqaror internet — asboblar ro‘yxati ro‘yxatdan so‘ng yuboriladi.",
    },
  ];
  return items;
}
