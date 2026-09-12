import type { CourseReview } from "./models";

/**
 * MOCK review store (Phase 4) — a small, deliberately LIMITED sample of
 * fictional reviews for a subset of courses. Listing-level `rating` and
 * `reviews` counts on a course are the marketplace aggregates; this file
 * holds only the written testimonials actually shown. A course without
 * entries renders the section’s honest empty state — never fabricated text.
 */
export const courseReviews: CourseReview[] = [
  {
    id: "r-ielts-1",
    courseId: "c-ielts-intensive",
    author: "Sevara T.",
    rating: 5,
    text: "Ikki marta 6.0 olgach kelgan edim. Mock imtihonlar va xatolar jurnali hammasini joyiga qo‘ydi — dekabrda 7.0. Writing endi qolip emas, mantig‘ini tushunib yozaman.",
    date: "2026-01-18",
  },
  {
    id: "r-ielts-2",
    courseId: "c-ielts-intensive",
    author: "Jasur A.",
    rating: 5,
    text: "Guruh kichikligi — asosiy farq. Har darsda menga alohida fikr qaytadi. Speaking progonkalari ayniqsa foydali bo‘ldi.",
    date: "2025-12-03",
  },
  {
    id: "r-ielts-3",
    courseId: "c-ielts-intensive",
    author: "Dilnoza K.",
    rating: 4,
    text: "Yuklama haqiqiy: ikki haftada bir mock — o‘rganasiz, lekin charchaysiz ham. Natija buni oqlaydi. Reading tezligi sezilarli oshdi.",
    date: "2026-02-21",
  },
  {
    id: "r-ielts-4",
    courseId: "c-ielts-intensive",
    author: "Bekzod M.",
    rating: 5,
    text: "Band 7.5 chiqardim. Eng qadrdoni — ustoz har javobni nega shu bahoni olganini ko‘rsatib berdi. Ko‘chman bilan ketdik.",
    date: "2026-03-09",
  },
  {
    id: "r-fe-1",
    courseId: "c-frontend",
    author: "Munisa R.",
    rating: 5,
    text: "Nol boshlagan edim. Uch oyda portfolio sayt qo‘ydym, ikkinchi oyda internship’tan qaytdim. Kod-reviewlar — darsning o‘zidan qimmatroq.",
    date: "2026-05-14",
  },
  {
    id: "r-fe-2",
    courseId: "c-frontend",
    author: "Suhrob J.",
    rating: 5,
    text: "‘30 daqiqa nazariya, qolgani kod’ — aynan shu kerak edi. JavaScript bo‘limi sekinroq yurildi, lekin tushunmaslik qoldirishmadi.",
    date: "2026-06-02",
  },
  {
    id: "r-fe-3",
    courseId: "c-frontend",
    author: "Nilufar S.",
    rating: 4,
    text: "Zo‘r kurs, faqat topshiriq tekshiruvi ba’zanda 2-3 kunga cho‘zildi. Shunga qaramay, himoyaga tayyor uch loyiha — aniq natija.",
    date: "2026-04-27",
  },
  {
    id: "r-dtm-1",
    courseId: "c-math-dtm",
    author: "Azizbek N.",
    rating: 5,
    text: "Yakshanba testlari DTM bosimini oldindan yashatdi. Progress kartasi nimani qoldirayotganimni aniq ko‘rsatdi — natijada grant.",
    date: "2026-07-15",
  },
  {
    id: "r-dtm-2",
    courseId: "c-math-dtm",
    author: "Malika Y.",
    rating: 5,
    text: "Nodira o‘qituvchi ‘tizimli tushunish’ni yo‘qotishga alohida kuch berdi. Testda endi xato kamaydi, tezlik ikki baravar oshdi.",
    date: "2026-06-20",
  },
  {
    id: "r-dtm-3",
    courseId: "c-math-dtm",
    author: " Farrux O.",
    rating: 4,
    text: "Sinf guruhida temp juda tez edi, qatnasholmagan kunlarimda cho‘chib qoldim. Onlayn guruhdoshlar uchun yozuv saqlansa yanada yaxshi bo‘lardi.",
    date: "2026-05-30",
  },
  {
    id: "r-uiux-1",
    courseId: "c-uiux",
    author: "Robiya F.",
    rating: 5,
    text: "Usability test bo‘limi kutilmaganda qimmat bo‘ldi — o‘z kaysimga qaytib 7 joyini buzib qayta qildim. Aynan shu farq qiladi.",
    date: "2026-03-12",
  },
  {
    id: "r-uiux-2",
    courseId: "c-uiux",
    author: "Kamron B.",
    rating: 5,
    text: "Brief’lar haqiqiy, review’lar jamoaviy. Figma Auto Layout endi avtomatik. Portfolio saytim orqali birinchi taklif keldi.",
    date: "2026-02-25",
  },
  {
    id: "r-uiux-3",
    courseId: "c-uiux",
    author: "Shahzoda T.",
    rating: 4,
    text: "Darslar kechki — ishlaydigan odamga mos. Semestr oxiri biroz tig‘iz; himoyaga tayyorlanishga yana bitta hafta bo‘lsa zo‘r edi.",
    date: "2026-04-08",
  },
  {
    id: "r-py-1",
    courseId: "c-python-boshlangich",
    author: "Ulug‘bek A.",
    rating: 5,
    text: "Slayd yo‘q, kod bor — boshlovchi uchun eng to‘g‘ri usul. Mini-loyihani o‘zim tanladim (ish vaqti hisoblagichi), ishda ham qo‘l keldi.",
    date: "2026-06-11",
  },
  {
    id: "r-py-2",
    courseId: "c-python-boshlangich",
    author: "Zarina H.",
    rating: 4,
    text: "Sinfda ham, onlayn ham bir xil olib borildi — uydan qatnashdim. Xatoni o‘zim o‘qib tushunishga o‘rgatishganidan minnatman.",
    date: "2026-07-01",
  },
  {
    id: "r-gen-1",
    courseId: "c-general-english",
    author: "Diyor S.",
    rating: 5,
    text: "A2’da kirib B1 chiqardim. Loyihalarga uynalash yoqdi — sinfda prezentatsiya qilish endi qo‘rquv emas.",
    date: "2026-02-14",
  },
  {
    id: "r-gen-2",
    courseId: "c-general-english",
    author: "Marjona Q.",
    rating: 4,
    text: "Yunusobod sinfi qulay, jadval moslashuvchan. Grammatika bloki yanada ko‘proq mashq so‘raydi deb o‘yladim.",
    date: "2026-01-29",
  },
];

/** Reviews for one course, newest first — deterministic ordering. */
export function reviewsForCourse(courseId: string): CourseReview[] {
  return courseReviews
    .filter((review) => review.courseId === courseId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
