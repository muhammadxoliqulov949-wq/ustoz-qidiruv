import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Foydalanish shartlari",
  description:
    "USTOZ foydalanish shartlari: rollar, e’lonlar, yozilish, to‘lovlar, qaytarish, fikrlar va moderatsiya.",
  alternates: { canonical: "/terms" },
};

/* /terms — marketplace terms aligned with REAL product behaviour. No legal
 * entity, address or registration data is stated, because none is established
 * for this project. */
export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Huquqiy"
      title="Foydalanish shartlari"
      intro="USTOZ marketidan foydalanish qoidalari — rollar, e’lonlar, yozilish, to‘lovlar va moderatsiya."
    >
      <InfoSection title="Rollar">
        <p>
          <strong className="font-semibold text-ink-900">O‘quvchi:</strong>{" "}
          kurslarni qidiradi, yozilish so‘rovlarini yuboradi, to‘lovlarni
          amalga oshiradi va fikr qoldiradi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Ustoz:</strong>{" "}
          kurslar yaratadi, yozilish so‘rovlarini qabul qiladi yoki rad etadi,
          guruhlarini boshqaradi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Administrator:</strong>{" "}
          ustoz tekshiruvi, kurs moderatsiyasi, fikrlar moderatsiyasi va pulni
          qaytarish bo‘yicha qarorlar qabul qiladi.
        </p>
      </InfoSection>

      <InfoSection title="Kurs e’lonlari">
        <p>
          Ustoz kursni qoralama sifatida yaratadi va e’lon qilish uchun
          moderatsiyaga yuboradi. Faqat tasdiqlangan ustozlar kursini
          moderatsiyaga yuborishi mumkin. Administrator tasdiqlagan kurs
          katalogda e’lon qilinadi; rad etilsa, sababi ko‘rsatiladi.
        </p>
        <p>
          E’lon qilingan kursdagi ma’lumot — nom, dastur, guruhlar, narx —
          haqiqatga mos bo‘lishi shart. Kurs sahifasida ko‘rsatilgan narx
          yozilish vaqtidagi narx hisoblanadi.
        </p>
      </InfoSection>

      <InfoSection title="Yozilish">
        <p>
          Yozilish so‘rovi — darsga yozilish istagi; u joyni band qilmaydi.
          Joy faqat ustoz so‘rovni qabul qilganda band hisoblanadi.
          Guruhdagi bo‘sh joylar qabul qilingan so‘rovlardan kelib chiqib
          hisoblanadi.
        </p>
        <p>
          O‘quvchi ko‘rib chiqilmagan so‘rovni bekor qilishi mumkin. Ustoz
          so‘rovni qabul qilishi yoki rad etishi mumkin; rad etilganda sabab
          ko‘rsatilishi mumkin.
        </p>
      </InfoSection>

      <InfoSection title="To‘lovlar">
        <p>
          Pullik kurslarda to‘lov so‘rov qabul qilingandan so‘ng o‘quvchi
          kabineti orqali, Payme yordamida amalga oshiriladi. Bepul kurslarda
          to‘lov talab qilinmaydi.
        </p>
        <p>
          To‘lov summasi yozilish vaqtidagi kurs narxiga teng — keyingi narx
          o‘zgarishlari unga ta’sir qilmaydi. To‘lov holati va tarixi
          kabinetingizda saqlanadi.
        </p>
      </InfoSection>

      <InfoSection title="Pulni qaytarish">
        <p>
          To‘lov qilingan yozilish bo‘yicha pulni qaytarish so‘rovini o‘quvchi
          kabinetidan yuboradi. Qaytarish faqat to‘liq summa uchun amalga
          oshiriladi — qisman qaytarish yo‘q.
        </p>
        <p>
          So‘rovni administrator ko‘rib chiqadi; tasdiqlansa, pul to‘lov
          provayderi orqali qaytariladi va yozilish bekor qilinadi.
        </p>
      </InfoSection>

      <InfoSection title="Fikrlar">
        <p>
          Fikrni faqat qabul qilingan yozilishi bo‘lgan va guruh darslari
          boshlangan o‘quvchi qoldirishi mumkin — har bir yozilish bo‘yicha
          bitta fikr. Fikrlar e’lon qilinishidan oldin moderatsiyadan o‘tadi.
        </p>
        <p>
          Soxta, haqoratli yoki mavzuga aloqasi yo‘q fikrlar e’lon qilinmaydi.
          Reytinglar faqat e’lon qilingan fikrlardan hisoblanadi.
        </p>
      </InfoSection>

      <InfoSection title="Moderatsiya">
        <p>
          Administrator ustoz tekshiruvi arizalarini, kurslarni va fikrlarni
          ko‘rib chiqadi. Qoidalarni buzgan e’lonlar rad etiladi; takroriy yoki
          jiddiy buzilishlarda hisob cheklanishi mumkin.
        </p>
        <p>
          Ustoz tekshiruvi — platforma ishonch belgisi; u davlat organi
          tomonidan shaxsni tasdiqlash emas.
        </p>
      </InfoSection>

      <InfoSection title="Hisob uchun javobgarlik">
        <p>
          Hisobingizdagi ma’lumotlar to‘g‘ri bo‘lishi va parolingiz maxfiy
          qolishi uchun siz javobgarsiz. Hisobingizdan qilingan harakatlar
          sizniki hisoblanadi — shuning uchun umumiy qurilmalarda hisobingizdan
          chiqishni unutmang.
        </p>
        <p className="!text-base text-ink-500">
          Ushbu shartlar mahsulotning haqiqiy ishlashiga mos yozilgan dastlabki
          tahrir — yuridik maslahat emas. Shartlar o‘zgarganda yangi tahrir shu
          sahifada e’lon qilinadi.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
