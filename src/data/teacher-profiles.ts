import type { TeacherProfile } from "./models";

/**
 * Teacher profile payloads (Phase 5) — content for /teachers/[slug] only.
 * Same architecture as course-details.ts: one record per teacher, merged in
 * teachers.ts at build time; a teacher without a profile is a data error
 * that fails the build rather than a silently broken page.
 */
export const teacherProfilesById: Record<string, TeacherProfile> = {
  "t-dilshod-rahimov": {
    approach:
      "Boshlang‘ich bosqichda qo‘rqovni sindirishdan ishlayman: har darsda har bir o‘quvchi kamida bir marta gapiradi. Keyin band-deskriptor mantig‘i keladi — nima uchun shu bahoni olganingizni ko‘rsatib beraman, shunda uyda qilgan mashqingiz ham maqsadli bo‘ladi.",
  },
  "t-nodira-yusupova": {
    approach:
      "Har o‘quvchi uchun mavzu xaritasi yuriladi: qayerda bo‘sh joy borligi aniq ko‘rinib turadi. Yangi mavzu eski tasnifsiz o‘tilmaydi — avval bir oldingisini test qilib, keyin oldinga yuramiz. Kuchli guruh va asosiy guruh bir darsda, lekin turli yuklama bilan ishlaydi.",
  },
  "t-sardor-qodirov": {
    approach:
      "Darslarning katta qismi — klassda birga kod yozish. Topshiriqlar real ish jarayoniga o‘xshash: git branch, pull request, kod-review. Ikkinchi oydan boshlab har kuni kichik commit qilish odatga aylanadi, shunda kurs oxirida nafaqat bilim, balki ko‘rsatib beradigan ish ham qoladi.",
  },
  "t-malika-ergasheva": {
    approach:
      "Boshlovchilarda qo‘rqmaydigan muhit birinchi shart. Har dars: yangi so‘zlar talaffuz bilan, qisqa dialog, so‘ng o‘qilgan matn ustida birgalikda ishlash. Grammatika qoidalarini alohida yodlatmayman — matn ichida ko‘rib, o‘zlashtirish tezroq bo‘ladi.",
  },
  "t-zilola-akbarova": {
    approach:
      "Kichik bolalar bilan dars 15-20 daqiqalik bloklarga bo‘linadi: qo‘shiq, harakatli o‘yin, so‘ng daftar bilan tinch ishlash. Uy vazifasi — kuniga 5 daqiqalik eslab qilish mashqi, ota-onaga alohida topshiriq berilmaydi. Har oyda ota-onalar uchun qisqa natija qaytaliuvi yuboriladi.",
  },
  "t-malika-sattorova": {
    approach:
      "Klubda faqat gapiriladi — lekin quloq solinadi ham. Har seans bir mavzuda ochiladi, so‘ng juft va kichik guruhlarda amaliyot qilinadi. Xatolarni seans o‘rtasida to‘g‘rilamayman, yakunida umumiy xatolar ro‘yxatini ko‘rsataman, shunda gapirish ritmi buzilmaydi.",
  },
  "t-shahnoza-tursunova": {
    approach:
      "Har mavzu o‘yinchoq yoki rasmda boshlanadi, so‘ng rasmga chiziladi, oxirida og‘za bilan tushuntiriladi. Bolani majburlash yo‘q — bo‘lmaydigan qadam ertaga qoldiriladi, lekin takrorlanadi. Ota-onaga nima qanday o‘tilayotgani haqida qisqa xabar yuboriladi.",
  },
  "t-rustam-alimov": {
    approach:
      "Dars test formatida emas, avval tushunishda: har mavzu qo‘lda, sekin, izoh bilan yechiladi. Nazorat sinovidan oldingi hafta esa real sinov sharoitida ishlaymiz — vaqt, blanka, tekshirish odati bilan. Eng ko‘p ball yo‘qotiladigan joy — tekshirilmagan javob, shuning uchun shu ko‘nikmaga alohida vaqt ajrataman.",
  },
  "t-behzod-karimov": {
    approach:
      "Birinchi daqiqadan kod yozamiz — slayd yo‘q. Har mavzu oxirida ishlaydigan kichik vosita qilinadi, keyingisida avvalgisi ustiga quriladi, shuning uchun kurs oxirida bir ta’lim loyihasi emas, butun bosqichli portfolio paydo bo‘ladi. Xato o‘qishni kod yozishdan ham muhim ko‘raman.",
  },
  "t-ubaydullo-nasriddinov": {
    approach:
      "Qoidalar matn ustida ko‘rsatiladi — quruq yodlatish yo‘q. Har darsda bir oyati yoki hadis matni tanlanadi, so‘zma-so‘z tahlil qilinadi; o‘quvchi keyingi haftaga o‘sha qoidani boshqa matnda o‘zi topib keladi. Boshlovchilar uchun alifbo va o‘qish darsdan oldin, alohida tartibda yuritiladi.",
  },
  "t-aziza-nazarova": {
    approach:
      "Barcha mashqlar haqiqiy brend brieflari asosida: o‘quvchi bitta foydalanuvchi muammosini olib, uni tekshirilgan dizayn bilan yopishi kerak. Har hafta jamoaviy review — ishingizni himoya qila olishi dizayndan kam muhim emas. O‘quvchilar grid, spacing va tipografiya me‘yorlarini Figma component’larida o‘zi qurib ko‘radi.",
  },
  "t-javohir-xolliyev": {
    approach:
      "Asosiy tamoyil — fayl avval to‘g‘ri, keyin chiroyli bo‘lishi kerak. Shu sababli kurs fayl tuzilishi, rang rejimi va bosmaga tayyorlashdan boshlanadi, kompozitsiya keyin keladi. Har amaliyot haqiqiy bosmaxona yoki SMM talabi bilan beriladi, tayyorlanmagan fayl qabul qilinmaydi.",
  },
  "t-kamola-yuldosheva": {
    approach:
      "A2–B1 oralig‘idagilar bilan grammatikani tushuntirib, so‘ng uni darhol gapirish va yozishga solib ko‘ramiz — qoida faqat ishlatilganda o‘zlashtiriladi deb hisoblayman. Har o‘n kunda kichik yazma ishi tekshirib boriladi, xatolar shaxsiy ro‘yxatga yig‘iladi va keyin shu ro‘yxat ustida ishlaymiz.",
  },
};
