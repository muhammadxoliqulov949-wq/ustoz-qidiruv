import type { Metadata } from "next";
import { InfoLink, InfoPage, InfoSection } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Yordam",
  description:
    "USTOZ yordam markazi: hisob, kurs qidirish, yozilish, to‘lovlar, fikrlar, tekshiruv va pulni qaytarish.",
  alternates: { canonical: "/help" },
};

/* /help — a concise help center. Every answer describes behaviour the product
 * actually has, with links into the real routes. */
export default function HelpPage() {
  return (
    <InfoPage
      eyebrow="Yordam markazi"
      title="Yordam"
      intro="Hisob, kurs qidirish, yozilish, to‘lovlar va boshqa masalalar bo‘yicha qisqa javoblar."
    >
      <InfoSection id="hisob" title="Hisob">
        <p>
          <InfoLink href="/register">Ro‘yxatdan o‘tish</InfoLink> telefon raqami
          va parol orqali amalga oshadi — o‘quvchi yoki ustoz rolini
          tanlaysiz. Keyin <InfoLink href="/login">tizimga kirish</InfoLink>{" "}
          sahifasidan hisobingizga kirasiz.
        </p>
        <p>
          Ro‘yxatdan so‘ng <InfoLink href="/onboarding">onboarding</InfoLink>{" "}
          so‘rovnomasini to‘ldiring: o‘quvchilar o‘qish afzalliklarini, ustozlar
          esa ommaviy profil ma’lumotlarini kiritadi. Ma’lumotlar saqlangach,
          ularni kabinetingizdagi profil bo‘limidan o‘zgartirishingiz mumkin.
        </p>
      </InfoSection>

      <InfoSection id="qidirish" title="Kurslarni topish">
        <p>
          <InfoLink href="/courses">Kurslar</InfoLink> sahifasida qidiruv va
          filtrlar bor: yo‘nalish, format, shahar, daraja, narx, dars vaqti va
          reyting. <InfoLink href="/teachers">Ustozlar</InfoLink> sahifasida
          esa yo‘nalish, shahar, til, tajriba va tasdiqlanganlik bo‘yicha
          filtrlash mumkin.
        </p>
        <p>
          Katalogda faqat e’lon qilingan kurslar ko‘rinadi. Filtr hech narsa
          topmasa, “Mos kurs topilmadi” oynasi chiqadi — filtrlarni
          o‘zgartirib ko‘ring.
        </p>
      </InfoSection>

      <InfoSection id="yozilish" title="Yozilish">
        <p>
          Kurs sahifasidagi “Kursga yozilish” tugmasi yozilish shaklini ochadi:
          guruhni tanlaysiz, ism, telefon va ixtiyoriy izohni kiritasiz.
          So‘rov hisobingizga saqlanadi va ustozga yuboriladi.
        </p>
        <p>
          So‘rov holatlarini kabinetingizdagi “So‘rovlarim” bo‘limida
          kuzatasiz: ustoz so‘rovni qabul qilishi yoki rad etishi mumkin.
          Ko‘rib chiqilmagan so‘rovni o‘zingiz bekor qilishingiz mumkin.
          Guruhdagi bo‘sh joylar qabul qilingan so‘rovlardan kelib chiqib
          hisoblanadi.
        </p>
      </InfoSection>

      <InfoSection id="tolovlar" title="To‘lovlar">
        <p>
          Pullik kurslarda to‘lov so‘rovingiz ustoz tomonidan qabul qilingandan
          so‘ng ochiladi — to‘lov tugmasi “So‘rovlarim” bo‘limidagi qabul
          qilingan so‘rov kartasida paydo bo‘ladi. To‘lov Payme orqali amalga
          oshiriladi. Bepul kurslarda to‘lov talab qilinmaydi.
        </p>
        <p>
          Har bir to‘lovning holati va tafsilotlari kabinetingizda saqlanadi.
          To‘lov tizimi vaqtincha o‘chiq bo‘lsa, sahifada bu haqda ochiq
          xabar ko‘rsatiladi — bunday vaqtda to‘lovni boshlab bo‘lmaydi.
        </p>
      </InfoSection>

      <InfoSection id="fikrlar" title="Fikrlar">
        <p>
          Fikrni faqat kursda o‘qigan o‘quvchi qoldirishi mumkin: yoziluvingiz
          qabul qilingan va guruh darslari boshlangan bo‘lishi kerak. Har bir
          yozilish bo‘yicha bitta fikr yoziladi.
        </p>
        <p>
          Fikrlar e’lon qilinishidan oldin administrator tomonidan ko‘rib
          chiqiladi: kutilayotgan yoki rad etilgan fikr kurs sahifasida
          ko‘rinmaydi va reytingga ta’sir qilmaydi. Reyting faqat e’lon
          qilingan fikrlardan hisoblanadi.
        </p>
      </InfoSection>

      <InfoSection id="tekshiruv" title="Ustoz tekshiruvi">
        <p>
          Ustoz profilidagi “Tasdiqlangan” belgisi administrator tekshiruvidan
          o‘tgani bildiradi. Arizani ustoz panelidagi “Profil tasdig‘i”
          bo‘limidan yuborasiz: profil to‘liq bo‘lishi va kerakli hujjatlar
          yuklanishi shart.
        </p>
        <p>
          Faqat tasdiqlangan ustozlar kursini e’lon qilish uchun moderatsiyaga
          yuborishi mumkin. Ariza rad etilsa, sababi ko‘rsatiladi va arizani
          qayta yuborish mumkin.
        </p>
      </InfoSection>

      <InfoSection id="qaytarish" title="Pulni qaytarish">
        <p>
          To‘lov qilingan yozilish bo‘yicha pulni qaytarish so‘rovini
          kabinetingizdagi so‘rov kartasidan yuborasiz. Qaytarish faqat to‘liq
          summa uchun — qisman qaytarish yo‘q.
        </p>
        <p>
          So‘rovni administrator ko‘rib chiqadi: tasdiqlansa, pul to‘lov
          provayderi orqali qaytariladi. Qaytarish yakunlangach, yozilish bekor
          qilinadi va bu karta tarixida ko‘rinib turadi.
        </p>
      </InfoSection>

      <InfoSection id="aloqa" title="Yana yordam kerakmi?">
        <p>
          Javobini topa olmagan savolingiz bo‘lsa, hisobingizga kirgach{" "}
          <InfoLink href="/support">ilova ichidagi murojaat shakli</InfoLink>{" "}
          orqali operator navbatiga yozing. Umumiy savollar uchun{" "}
          <InfoLink href="/contacts">aloqa sahifasi</InfoLink> ham mavjud.
          Yozilish bo‘yicha savollar uchun qabul qilingan so‘rov kartasidagi
          “Ustozga yozish” tugmasidan foydalaning.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
