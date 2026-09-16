import type { Course, FaqItem } from "./models";
import { formatPrice } from "@/lib/format";

/**
 * FAQ builder for the course detail page.
 *
 * Answers that can be TRUE for a given course (venue, price behavior, seat
 * sizes) are derived from its typed data — the same fields the UI shows —
 * so the FAQ can never contradict the listing. Only the neutral items are
 * shared. The course arrives DB-projected (getPublicCourseBySlug), so this
 * pure builder holds no records of its own.
 *
 * Honesty rules honored here: payment wording describes the real flow (the
 * teacher reviews the request; paid courses settle in the student cabinet),
 * and no certificate promises are made.
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
      a: `Ko‘rsatilgan narx — ${course.priceUzs > 0 ? `${formatPrice(course.priceUzs)} (${detail.pricePeriod === "month" ? "oylik" : "kurs uchun bir marta"}). So‘rovingiz ustoz tomonidan qabul qilingandan so‘ng to‘lov kabinetingiz orqali amalga oshiriladi.` : "Bepul kurs — to‘lov talab qilinmaydi.”"}`,
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
