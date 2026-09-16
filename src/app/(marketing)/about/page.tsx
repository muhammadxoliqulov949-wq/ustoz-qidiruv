import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { InfoLink, InfoPage, InfoSection } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  description:
    "USTOZ — onlayn va offlayn kurslar marketi: o‘quvchilar kurs topadi, ustozlar o‘quvchi topadi.",
  alternates: { canonical: "/about" },
};

/* /about — what USTOZ is and how the marketplace works. Static page: no data,
 * no counts, no company statistics — only what the product actually does. */
export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="USTOZ"
      title="Biz haqimizda"
      intro="USTOZ — onlayn va offlayn kurslar bir joyda topiladigan market. O‘quvchilar mos kursni qidiradi, ustozlar o‘z kurslarini e’lon qiladi."
    >
      <InfoSection title="USTOZ nima?">
        <p>
          USTOZ — ustoz va o‘quvchini bog‘laydigan onlayn market. Katalogda
          faqat e’lon qilingan kurslar ko‘rinadi: har bir kurs sahifasida
          dastur, guruhlar va jadval, narx, ustoz profili va o‘quvchilar
          fikrlari ochiq turadi.
        </p>
        <p>
          Qidiruv va filtrlar — yo‘nalish, format (onlayn, offlayn, gibrid),
          shahar, daraja, narx va reyting bo‘yicha — to‘g‘ri kursni topishga
          yordam beradi. Yashirin ro‘yxatlar yo‘q: ko‘rganingiz — mavjud
          takliflar.
        </p>
      </InfoSection>

      <InfoSection title="Marketplace qanday ishlaydi?">
        <p>
          O‘quvchi kursni tanlaydi, mos guruhga yozilish so‘rovini yuboradi va
          ustoz uni qabul qiladi yoki rad etadi. Qabul qilingan pullik
          kurslarda to‘lov o‘quvchi kabineti orqali amalga oshiriladi; bepul
          kurslarda to‘lov talab qilinmaydi.
        </p>
        <p>
          Ustoz kurs yaratadi, uni moderatsiyaga yuboradi va tasdiqlangach kurs
          katalogda e’lon qilinadi. Faqat tasdiqlangan ustozlar kursini
          moderatsiyaga yuborishi mumkin — tasdiqlash arizasini administrator
          ko‘rib chiqadi.
        </p>
        <p>
          Kursni tamomlagan o‘quvchilar fikr qoldirishi mumkin; fikrlar e’lon
          qilinishidan oldin moderatsiyadan o‘tadi. Reytinglar faqat e’lon
          qilingan haqiqiy fikrlardan hisoblanadi — sun’iy ko‘paytirilmaydi.
        </p>
      </InfoSection>

      <InfoSection title="O‘quvchilar va ustozlar">
        <p>
          O‘quvchi va ustoz munosabati yozilish so‘rovi atrofida qurilgan:
          so‘rov — bu darsga yozilish istagi, qabul qilish — ustozning roziligi.
          Qabul qilingan yozilish bo‘yicha tomonlar kabinet ichida xabarlashishi
          mumkin.
        </p>
        <p>
          Ustoz o‘z kurslari, guruhlari va so‘rovlarini ustoz panelida
          boshqaradi; o‘quvchi so‘rovlari, to‘lovlari va fikrlarini o‘quvchi
          kabinetida kuzatadi. Har ikkala tomon ham bir xil haqiqiy
          ma’lumotni ko‘radi: joylar soni qabul qilingan so‘rovlardan kelib
          chiqib hisoblanadi.
        </p>
      </InfoSection>

      <InfoSection title="Boshlash">
        <p>
          Kurs izlayotgan bo‘lsangiz — katalogdan boshlang. O‘qitmoqchi
          bo‘lsangiz — ustoz sifatida ro‘yxatdan o‘ting, profilingizni
          to‘ldiring va birinchi kursingizni yarating.
        </p>
        <p className="flex flex-wrap gap-2.5">
          <ButtonLink href="/courses" variant="primary">
            Kurslarni ko‘rish
          </ButtonLink>
          <ButtonLink href="/register?role=teacher" variant="outline">
            Ustoz bo‘lish
          </ButtonLink>
        </p>
        <p className="!text-base text-ink-500">
          Savollaringiz bo‘lsa — <InfoLink href="/help">yordam</InfoLink>{" "}
          sahifasiga qarang yoki <InfoLink href="/contacts">biz bilan
          bog‘laning</InfoLink>.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
