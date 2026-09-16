import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description:
    "USTOZ maxfiylik siyosati: qanday ma’lumotlar saqlanadi, kim ko‘radi va qanday himoyalanadi.",
  alternates: { canonical: "/privacy" },
};

/* /privacy — a practical draft describing ACTUAL system behaviour. No legal or
 * compliance claims the implementation cannot prove. */
export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Huquqiy"
      title="Maxfiylik siyosati"
      intro="Qanday ma’lumotlar saqlanishi, ularni kim ko‘rishi va qanday himoyalanishi haqida — mahsulotning haqiqiy ishlashiga mos yozilgan."
    >
      <InfoSection title="Qanday ma’lumotlar saqlanadi?">
        <p>
          <strong className="font-semibold text-ink-900">Hisob:</strong> ismingiz,
          telefon raqamingiz va parolingizning xeshlangan ko‘rinishi. Parolning
          o‘zi hech qayerda ochiq saqlanmaydi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Profil:</strong>{" "}
          onboarding va kabinetda kiritgan ma’lumotlaringiz — shahar, dars
          formati, tillar, yo‘nalishlar (o‘quvchilar); mutaxassislik, tajriba,
          bio va o‘qitish uslubi (ustozlar).
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Yozilishlar:</strong>{" "}
          qaysi kurs va guruhga yozilganingiz, so‘rov holati va qaror tarixi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">To‘lovlar:</strong>{" "}
          to‘lov summasi, holati va tarixi. Karta ma’lumotlari USTOZ’da
          saqlanmaydi — to‘lov Payme orqali amalga oshiriladi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Fayllar:</strong>{" "}
          yuklagan hujjatlaringiz va rasmlaringiz (masalan, tekshiruv
          hujjatlari, profil rasmi, kurs muqovasi).
        </p>
        <p>
          <strong className="font-semibold text-ink-900">
            Fikrlar va xabarlar:
          </strong>{" "}
          yozgan fikrlaringiz va suhbatlardagi xabarlaringiz matni.
        </p>
      </InfoSection>

      <InfoSection title="Ma’lumotlarimni kim ko‘radi?">
        <p>
          <strong className="font-semibold text-ink-900">Hamma ko‘radi:</strong>{" "}
          e’lon qilingan kurslar, ommaviy ustoz profillari va e’lon qilingan
          fikrlar — katalog ochiq.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">
            Faqat tegishli tomonlar:
          </strong>{" "}
          yozilish so‘rovini faqat siz va kurs ustozi ko‘radi; suhbatni faqat
          uning ikki ishtirokchisi o‘qiydi; tekshiruv hujjatlarini faqat siz va
          tekshiruvni ko‘rib chiquvchi administrator ko‘radi.
        </p>
        <p>
          <strong className="font-semibold text-ink-900">Hech kim:</strong>{" "}
          parolingizni hech kim — shu jumladan administrator ham — ko‘ra
          olmaydi.
        </p>
      </InfoSection>

      <InfoSection title="Kukilar va sessiya">
        <p>
          Tizimga kirganingizda brauzeringizda sessiya kukisi saqlanadi — u
          faqat sizni tanish uchun ishlatiladi va undan chiqmaguningizcha
          amal qiladi. Kukida parol yoki shaxsiy ma’lumot saqlanmaydi.
        </p>
        <p>
          Ba’zi holatlar (yozilish qoralamasi, saqlangan kurslar ro‘yxati)
          hozircha faqat brauzeringiz xotirasida saqlanadi — ular serverga
          yuborilmaydi va boshqa qurilmada ko‘rinmaydi.
        </p>
      </InfoSection>

      <InfoSection title="Himoya">
        <p>
          Parollar xeshlangan holda saqlanadi; sessiya kukilari himoyalangan
          rejimda ishlaydi. Har bir so‘rov serverda tekshiriladi: o‘quvchi
          faqat o‘z yozilishlarini, ustoz faqat o‘z kurslariga kelgan
          so‘rovlarni, administrator esa faqat o‘z vakolatidagi bo‘limlarni
          ko‘radi.
        </p>
        <p>
          Shaxsiy hujjatlar maxfiy saqlanadi va ularga kirish vaqtinchalik,
          maqsadli havolalar orqali beriladi — doimiy ochiq manzil
          saqlanmaydi.
        </p>
      </InfoSection>

      <InfoSection title="Nazorat sizda">
        <p>
          Profil ma’lumotlaringizni kabinetingizdan o‘zgartirishingiz, ko‘rib
          chiqilmagan yozilish so‘rovingizni bekor qilishingiz va istalgan
          payt hisobingizdan chiqishingiz mumkin. E’lon qilingan fikrlar
          moderatsiya qoidalariga muvofiq boshqariladi.
        </p>
        <p className="!text-base text-ink-500">
          Ushbu sahifa mahsulotning haqiqiy ishlashini tavsiflaydi va umumiy
          ma’lumot uchun yozilgan — yuridik maslahat emas. Mahsulot
          o‘zgarganda sahifa ham yangilanadi.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
