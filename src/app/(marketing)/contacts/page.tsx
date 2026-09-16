import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { InfoLink, InfoPage, InfoSection } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Aloqa",
  description: "USTOZ bilan bog‘lanish: yordam sahifasi va kabinet ichidagi xabarlar.",
  alternates: { canonical: "/contacts" },
};

/* /contacts — honest by omission. No public phone, address, email or social
 * channel exists for this project yet, so none is listed: inventing one would
 * be a fake contact. In-app paths below are all real. */
export default function ContactsPage() {
  return (
    <InfoPage
      eyebrow="Aloqa"
      title="Biz bilan bog‘lanish"
      intro="Savolingizga eng tez javob — yordam sahifasida yoki kabinet ichidagi xabarlarda."
    >
      <InfoSection title="Qanday bog‘lanaman?">
        <Card className="flex flex-col gap-2 !text-base">
          <p className="font-semibold text-ink-900">
            Umumiy qo‘llab-quvvatlash kanali hozircha tayyorlanmoqda.
          </p>
          <p className="text-ink-500">
            Hozircha umumiy telefon, elektron pochta yoki ijtimoiy tarmoq
            manzili e’lon qilinmagan — e’lon qilinishi bilan shu sahifada
            ko‘rsatiladi.
          </p>
        </Card>
        <p>
          Ko‘pchilik savollarga <InfoLink href="/help">yordam sahifasi</InfoLink>{" "}
          javob beradi: hisob, kurs qidirish, yozilish, to‘lovlar, fikrlar,
          tekshiruv va pulni qaytarish bo‘yicha yo‘riqnomalar o‘sha yerda.
        </p>
      </InfoSection>

      <InfoSection title="Yozilish bo‘yicha savollar">
        <p>
          Kurs yoki guruh haqida so‘ramoqchi bo‘lsangiz — yozilish so‘rovingiz
          ustoz tomonidan qabul qilingach, so‘rov kartasidagi “Ustozga yozish”
          tugmasi orqali ustoz bilan bevosita xabarlashasiz. Xabarlar tarixi
          kabinetingizning “Xabarlar” bo‘limida saqlanadi.
        </p>
        <p>
          Ustozlar uchun ham xabarlar ustoz panelidagi “Xabarlar” bo‘limida —
          har bir suhbat aniq bir qabul qilingan yozilishga bog‘langan.
        </p>
      </InfoSection>

      <InfoSection title="Xatolik haqida xabar berish">
        <p>
          Sahifada xatolik yoki noto‘g‘ri ma’lumot ko‘rsangiz — qaysi sahifada
          va nima noto‘g‘ri ekanini yozib oling: qo‘llab-quvvatlash kanali
          ochilgach, shu tafsilotlar muammoni tez hal qilishga yordam beradi.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
