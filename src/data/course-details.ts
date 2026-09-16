import type { CourseDetail } from "./models";

/**
 * DEV-SEED-ONLY course-detail payloads, keyed by course id.
 *
 * Kept separate from `courses.ts` so list views never carry this payload
 * into their module graph. Since Phase 12 NO page renders from here: the
 * detail page reads PostgreSQL (getPublicCourseBySlug), and `npm run db:seed`
 * (development only — it refuses to run in production) projects these rows
 * into the database. `seatsRemaining` here is seed input only and is NOT
 * imported: public availability is derived from real enrollment rows.
 */
export const courseDetailsById: Record<string, CourseDetail> = {
  "c-ielts-intensive": {
    summary:
      "To‘rt oyda IELTS 7.0+ bandga: haftasiga 3 dars, mock imtihonlar va individual feedback.",
    longDescription:
      "Kurs to‘liq imtihon formatiga qurilgan: Listening va Reading strategiyalari, Writing Task 1–2 qolip va tuzilmasi, Speaking part 1–3 mashqlari parallel yuriladi. Har ikki haftada bitta to‘liq mock imtihon topshiriladi, xatolar tahlili shaxsiy jadval ko‘rinishida qaytadi. Guruhlar kichik — maksimum 12 kishi, shuning uchun har bir o‘quvchiga alohida vaqt ajratiladi.",
    audience: [
      "5.5–6.5 banddan 7.0+ ko‘tarilmoqchi bo‘lganlar",
      "Mustaqil tayyorgarlikda natija o‘zgarmayotganlar",
      "O‘qish yoki ko‘chish (immigratsiya) uchun IELTS talab qilinadiganlar",
    ],
    learningOutcomes: [
      "Writing Task 1 va 2’ni band-deskriptorga mos tuzib yozish",
      "Reading’da tez o‘qish va javob strategiyalari",
      "Listening’da xarita/jadval topshiriqlarini ishonchli bajarish",
      "Speaking’da fikrni dalil va kollokatsiyalar bilan ochish",
      "Haftalik mock testlar orqali real imtihon ritmiga o‘rganish",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-ielts-a",
        title: "A guruhi",
        days: ["Du", "Chor", "Jum"],
        startTime: "18:00",
        format: "online",
        location: null,
        capacity: 12,
        seatsRemaining: 4,
        startDate: "2026-10-05",
      },
      {
        id: "g-ielts-b",
        title: "B guruhi",
        days: ["Se", "Pay", "Shan"],
        startTime: "20:00",
        format: "online",
        location: null,
        capacity: 12,
        seatsRemaining: 7,
        startDate: "2026-10-07",
      },
      {
        id: "g-ielts-c",
        title: "C guruhi (yakshanba intensiv)",
        days: ["Yak"],
        startTime: "10:00",
        format: "online",
        location: null,
        capacity: 12,
        seatsRemaining: 0,
        startDate: "2026-11-01",
      },
    ],
    syllabus: [
      {
        title: "Kirish va diagnostika",
        description: "Joriy darajani aniqlash, band talablari bilan tanishuv va shaxsiy reja tuzish.",
        lessons: 6,
      },
      {
        title: "Asosiy strategiyalar",
        description: "Har bir modul bo‘yicha qolip mashqlari: Listening, Reading, Writing, Speaking.",
        lessons: 12,
      },
      {
        title: "Amaliyot va mock imtihonlar",
        description: "To‘liq formatdagi mock imtihonlar, xatolar jurnali va qayta yozish seanslari.",
        lessons: 14,
      },
      {
        title: "Yakuniy sinov",
        description: "Imtihon oldidan strategiyani mustahkamlash va so‘nggi takrorlash.",
        lessons: 4,
      },
    ],
  },

  "c-ielts-speaking": {
    summary:
      "IELTS Speaking bo‘yicha haftalik amaliyot klubi: erkin mashg‘ulot va jonli feedback.",
    longDescription:
      "Klub formati: kichik guruhda (maksimum 8 kishi) mavzu bo‘yicha diskussiya, so‘ng imtihon formatida 1:1 progonka. Har bir seans qisqa yozuv bilan yakunlanadi — o‘quvchi o‘z gapirishini eshitib, individual xulosani oladi. Part 1–3 bo‘yicha vazifalar navbatma-navbat qamrab boriladi.",
    audience: [
      "G‘oyasi bor-yo‘q, lekin gapirishga ishonchi yetishmayotganlar",
      "Part 3’da dalillash va fikr bildirishni kuchaytirmoqchi bo‘lganlar",
      "Imtihon oldidan sinov bosqichidan o‘tishni istovchilar",
    ],
    learningOutcomes: [
      "Har bir qismni vaqt mezoni ichida ochish",
      "Fikrni dalil va misol bilan strukturalash",
      "Kollokatsiya va idiomatik iboralarni faol ishlatish",
      "Talanishni tushunarlilik ustida ishlash",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-speak-a",
        title: "A guruhi",
        days: ["Du"],
        startTime: "19:00",
        format: "online",
        location: null,
        capacity: 8,
        seatsRemaining: 2,
        startDate: "2026-09-28",
      },
      {
        id: "g-speak-b",
        title: "B guruhi",
        days: ["Pay"],
        startTime: "20:30",
        format: "online",
        location: null,
        capacity: 8,
        seatsRemaining: 5,
        startDate: "2026-10-01",
      },
    ],
    syllabus: [
      {
        title: "Fluency poydevori",
        description: "Part 1 mavzulari, shablon javobsiz gapirish va tanaffusni boshqarish.",
        lessons: 4,
      },
      {
        title: "Part 2: uzun javob",
        description: "Cue card tuzilmasi, 2 daqiqalik monolog va misol boyitish.",
        lessons: 8,
      },
      {
        title: "Part 3: muhokama",
        description: "Ijtimoiy mavzularda dalillash, savolga savob berish va aniqlovchi so‘zlar.",
        lessons: 8,
      },
      {
        title: "Sinov progonkalari",
        description: "Haqiqiy imtihon vaqtida 1:1 progonka va yozuv asosida xulosa.",
        lessons: 4,
      },
    ],
  },

  "c-general-english": {
    summary:
      "A2 darajadan B1’ga: haftasiga 2 marta — Toshkentdagi sinfda yoki online, ikkala formatda bir dastur.",
    longDescription:
      "Grammatika, leksika va to‘rt ko‘nikma parallel olib boriladi. Har modul yakunida amaliy loyiha — kichik prezentatsiya yoki yozma ish. O‘tkazib yuborilgan dars yozuvdan ko‘riladi; sinf guruhlarida qatnashish majburiy emas, lekin Speaking bloklari yuzma-yuz kuchliroq ishlaydi.",
    audience: [
      "Boshlang‘ich bosqichni tugatib, o‘rtaga chiqmoqchi bo‘lganlar",
      "Ish yoki o‘qishda kundalik ingliz tili kerak bo‘lganlar",
      "Keyinchalik imtihon kurslariga asos tayyorlayotganlar",
    ],
    learningOutcomes: [
      "Kundalik mavzularda erkin suhbat qurish",
      "Zamon tizimini (perfect, passive) xatosiz qo‘llash",
      "Oddiy hujjat, xat va email matnlarini tushunish",
      "500–600 so‘zlik faol leksika bazasini yig‘ish",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-gen-a",
        title: "A guruhi (sinf)",
        days: ["Du", "Chor"],
        startTime: "18:00",
        format: "hybrid",
        location: "Toshkent, Yunusobod",
        capacity: 10,
        seatsRemaining: 3,
        startDate: "2026-09-21",
      },
      {
        id: "g-gen-b",
        title: "B guruhi (shanba)",
        days: ["Shan"],
        startTime: "11:00",
        format: "hybrid",
        location: "Toshkent, Yunusobod",
        capacity: 10,
        seatsRemaining: 6,
        startDate: "2026-10-03",
      },
    ],
    syllabus: [
      {
        title: "B1 kirish bloki",
        description: "A2 takrori, zamon tizimini tekshirish va o‘zini tanitish mavzusi.",
        lessons: 5,
      },
      {
        title: "Kundalik kommunikatsiya",
        description: "Xizmat ko‘rsatish, sayohat, ish yozishmalari bo‘yicha dialog mashqlari.",
        lessons: 8,
      },
      {
        title: "Grammatika kamoloti",
        description: "Conditionals, reported speech, modal fe’llar — amaliy kontekstda.",
        lessons: 8,
      },
      {
        title: "Loyiha va yakuniy baholash",
        description: "Jamoaviy prezentatsiya va B1 daraja bo‘yicha komponent sinovi.",
        lessons: 4,
      },
    ],
  },

  "c-english-kichik": {
    summary:
      "3–5-sinf o‘quvchilari uchun ingliz tili: o‘yin, qo‘shiq va haftasiga 2 marta, Samarqanddagi sinfda.",
    longDescription:
      "Darslar 45 daqiqadan iborat: yangi 8–10 so‘z, qo‘shiq yoki harakatli o‘yin, rasm-topshiriq va mini-suhbat. Bolani majburlash usuli emas — har mavzu qiziqish orqali yuriladi. Ota-onalar uchun oyiga bir ochiq dars va qisqa progress xulosi beriladi.",
    audience: [
      "Maktab dasturidan tashqari muntazam til amaliyoti kerak bo‘lgan o‘quvchilar",
      "Yangi tilga qo‘rquvsiz, o‘yin muhitida kirib kelmoqchi bolalar",
      "Ta’tilda ham ritmni yo‘qotmaslikni istagan oilalar",
    ],
    learningOutcomes: [
      "O‘zi, oilasi va maktabi haqida oddiy gaplar qurish",
      "Ranglar, sonlar, kunlik fe’llar bilan erkin ishlash",
      "Savol-javob almashinuvini tushunish va davom ettirish",
      "Yozish va o‘qishning boshlang‘ich ko‘nikmalarini mustahkamlash",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-kid-a",
        title: "A guruhi (dushanbi-chorshanba)",
        days: ["Du", "Chor"],
        startTime: "15:00",
        format: "offline",
        location: "Samarqand, Registon",
        capacity: 12,
        seatsRemaining: 5,
        startDate: "2026-09-21",
      },
      {
        id: "g-kid-b",
        title: "B guruhi (payshanbi-shanba)",
        days: ["Pay", "Shan"],
        startTime: "11:00",
        format: "offline",
        location: "Samarqand, Registon",
        capacity: 12,
        seatsRemaining: 8,
        startDate: "2026-10-02",
      },
    ],
    syllabus: [
      {
        title: "Mening dunyom",
        description: "Salomlashish, oila, hayvonlar — qo‘shiq va o‘yinlar orqali.",
        lessons: 6,
      },
      {
        title: "Maktab va do‘stlar",
        description: "Buyurtma, ruxsat so‘rash, sinf ichida muloqot iboralari.",
        lessons: 6,
      },
      {
        title: "Ranglar va sonlar o‘yini",
        description: "Sanoq, taqqoslash va oddiy matematik iboralar ingliz tilida.",
        lessons: 5,
      },
      {
        title: "Kichik bayram loyihasi",
        description: "Guruhda tayyorlanadigan sahna ko‘rinishi — ota-onalar uchun ochiq dars.",
        lessons: 3,
      },
    ],
  },

  "c-english-conversation": {
    summary:
      "Bepul onlayn muloqot klubi: haftasiga 2 kecha, mavzuli erkin suhbat va mikro-tuzatishlar.",
    longDescription:
      "Format — moderator bilan diskussiya: 6–10 kishi, har hafta yangi mavzu, 5 daqiqalik leksika kirishi va juftlik mashqlari. Bu kursda grammatika darsi yo‘q — ustoz faqat tushunarlilik va tabiiylik ustida ishlaydi. Uyga vazifa yo‘q; izchil qatnash — yagona talab.",
    audience: [
      "Tilni biladi-yu, amaliyot kam — gapirish maydoni kerak bo‘lganlar",
      "Imtihon kurslariga kirishdan oldin shakeni sindirmoqchi bo‘lganlar",
      "Guruh muhitida muntazam mashg‘ulotni yoqtiradiganlar",
    ],
    learningOutcomes: [
      "To‘xtovsiz 2–3 daqiqa gapirib turish",
      "Suhbatni davom ettirish va so‘rovni aniqlovchi iboralar",
      "O‘z-xatoni eshitib tuzatish ko‘nikmasi",
      "12+ kundalik mavzuda erkin fikr bildirish",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-conv-a",
        title: "A guruhi (kechki)",
        days: ["Se", "Pay"],
        startTime: "19:30",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 6,
        startDate: "2026-09-29",
      },
      {
        id: "g-conv-b",
        title: "B guruhi (shanba)",
        days: ["Shan"],
        startTime: "12:00",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 9,
        startDate: "2026-10-10",
      },
    ],
    syllabus: [
      {
        title: "Tanishuv va qoidalar",
        description: "Klub ritmi, mavzu banki va feedback tartibi bilan tanishuv.",
        lessons: 2,
      },
      {
        title: "Kundalik mavzular",
        description: "Shahar, ish, sayohat, media — har hafta yangi diskussiya bloki.",
        lessons: 8,
      },
      {
        title: "Fikr va bahs",
        description: "Rozilik/rozilikmaslik tuzilmalari, muhokama qoidalari.",
        lessons: 6,
      },
      {
        title: "Erkin seanslar",
        description: "Mavzuni o‘quvchilar tanlaydigan ochiq formatdagi yakuniy uchrashuvlar.",
        lessons: 4,
      },
    ],
  },

  "c-math-children": {
    summary:
      "Maktabgacha yoshdagi bolalar uchun matematika va mantiq: o‘yin va qo‘llab-quvvatlash asosida, Farg‘onada.",
    longDescription:
      "Dars 30 daqiqa: 10 daqiqa harakatli o‘yin, 15 daqiqa stol ustida mashq, 5 daqiqa ertak-masala. Sanoq, shakl, naqsh va oddiy masalalar avval qo‘lda, so‘ng daftarda. Maktabga tayyorlov guruhiga o‘tish mezonlari ota-onalar bilan alohida suhbatda muhokama qilinadi.",
    audience: [
      "5–6 yoshida maktabga tayyorlanayotgan bolalar",
      "Raqam va shakllarga qiziqishni o‘yin orqali o‘shtirishni istagan oilalar",
      "Maktabgacha ta’lim muassasasidan tashqari qo‘shicha mashg‘ulot izlovchilar",
    ],
    learningOutcomes: [
      "20 gacha sanoq va sonlar tarkibini tushunish",
      "Shakl va naqshlarni davom ettirish, farqlash",
      "Birlashtirish-ayirishga tayyor mashqlar",
      "Qisqa og‘zaki masalani o‘yinchoqlar yordamida yechish",
    ],
    teachingLanguages: ["UZ"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-pre-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "10:00",
        format: "offline",
        location: "Farg‘ona, Markaziy",
        capacity: 8,
        seatsRemaining: 3,
        startDate: "2026-09-22",
      },
      {
        id: "g-pre-b",
        title: "B guruhi",
        days: ["Pay", "Shan"],
        startTime: "10:00",
        format: "offline",
        location: "Farg‘ona, Markaziy",
        capacity: 8,
        seatsRemaining: 0,
        startDate: "2026-10-06",
      },
    ],
    syllabus: [
      {
        title: "Sonlar dunyosi",
        description: "1–10, miqdor tushunchasi, qiyos: ko‘p/oz/teng.",
        lessons: 6,
      },
      {
        title: "Shakllar va fazo",
        description: "Asosiy shakllar, yo‘nalish, simmetriya — konstruksiyalar bilan.",
        lessons: 5,
      },
      {
        title: "Naqsh va mantiq",
        description: "Qonuniyatni topish, tasniflash va oddiy zanjir masalalar.",
        lessons: 5,
      },
      {
        title: "Masalalar bosqichi",
        description: "Ertak-qahramonlar bilan qo‘shish-ayirishga tayyorlov vazifalari.",
        lessons: 4,
      },
    ],
  },

  "c-math-dtm": {
    summary:
      "9–11-sinf uchun chuqurlashtirilgan matematika va DTM tayyorlov: haftasiga 3 marta, sinfda yoki onlayn.",
    longDescription:
      "Dastur maktab doirasidan tashqari mavzularni qamrab oladi: parametrli tenglamalar, koordinata usuli, hosila va uning qo‘llanilishi. Har yakshanba — 90 daqiqali test sinovi, DTM formatiga mos, xatolar tahlili bilan qaytariladi. Har o‘quvchi uchun progress kartasi yuritiladi: mavzu × bajarilish foizi.",
    audience: [
      "DTM testida 60+ ball — aniq maqsadi bo‘lgan abituriyentlar",
      "Maktab olimpiadalariga tayyorlanayotgan o‘quvchilar",
      "10–11-sinfda fan bazasini jiddiy mustahkamlamoqchi bo‘lganlar",
    ],
    learningOutcomes: [
      "Test tezligini real imtihon me‘yoriga yetkazish",
      "Ko‘p qadamli masalalarda tizimli yechim yozish",
      "Funksiyalar, grafik va hosila bo‘yicha mustahkam baza",
      "Xato tahlili orqali ‘tizimli tushunish’ni yo‘qotish",
      "Imtihon kuniga fizik va ruhiy tayyorgarlik ritmi",
    ],
    teachingLanguages: ["UZ", "RU"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-dtm-a",
        title: "A guruhi (sinf)",
        days: ["Du", "Chor", "Jum"],
        startTime: "16:00",
        format: "offline",
        location: "Toshkent, Chilonzor",
        capacity: 14,
        seatsRemaining: 2,
        startDate: "2026-09-14",
      },
      {
        id: "g-dtm-b",
        title: "B guruhi (onlayn)",
        days: ["Se", "Pay", "Shan"],
        startTime: "18:30",
        format: "online",
        location: null,
        capacity: 14,
        seatsRemaining: 5,
        startDate: "2026-09-15",
      },
      {
        id: "g-dtm-c",
        title: "C guruhi (yakshanba blok)",
        days: ["Yak"],
        startTime: "10:00",
        format: "offline",
        location: "Toshkent, Chilonzor",
        capacity: 14,
        seatsRemaining: 9,
        startDate: "2026-09-20",
      },
    ],
    syllabus: [
      {
        title: "Baza va tiklash",
        description: "Algebra asoslari, ifodalar va tenglamalar bo‘yicha diagnostic + kamolot.",
        lessons: 10,
      },
      {
        title: "Funksiyalar chizig‘i",
        description: "Grafiklar, aylana tenglamalari, progressiyalar — test formatida.",
        lessons: 14,
      },
      {
        title: "Hosila va boshlang‘ich analiz",
        description: "Limit tushunchasi, hosila qoidalarini qo‘llash va masalalar.",
        lessons: 12,
      },
      {
        title: "Sinov marafoni",
        description: "Haftalik to‘liq testlar, tezlik strategiyasi va xato jurnali tahlili.",
        lessons: 16,
      },
    ],
  },

  "c-algebra-sinav": {
    summary:
      "Algebra bo‘yicha nazorat sinovlariga yo‘naltirilgan onlayn kurs: haftasiga 2 dars, chorak ritmiga mos.",
    longDescription:
      "Mavzular shoshilinch o‘tilmaydi: har bo‘lim test formatida mustahkamlanadi. Sinovga 2 hafta qolganda qaytarish darsi, undan oldin namunaviy sinov va tahlil. O‘quvchining zaif mavzular ro‘yxati doim yangilanib boradi — reja shu ro‘yxat ustiga quriladi.",
    audience: [
      "Chorak sinovlarida barqaror baho olmoqchi bo‘lgan 7–9-sinf o‘quvchilari",
      "‘Tushunaman, lekin yecholmayman‘ holatidagi o‘quvchilar",
      "Onlayn formatda qulay jadval izlovchilar",
    ],
    learningOutcomes: [
      "Ko‘phadlar va qisqartirishlar bilan ishonchli ishlash",
      "Tenglama va tengsizlik tizimlarini beziybop yechish",
      "Sinovda tekshirish odatini shakllantirish",
      "Tipik ‘tuzoqli’ topshiriq turnlarini tanish",
    ],
    teachingLanguages: ["UZ"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-alg-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "15:00",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 4,
        startDate: "2026-09-21",
      },
      {
        id: "g-alg-b",
        title: "B guruhi",
        days: ["Pay", "Shan"],
        startTime: "16:30",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 7,
        startDate: "2026-10-02",
      },
    ],
    syllabus: [
      {
        title: "Ifodalar va tenglamalar",
        description: "Soddalashtirish, qavs ochish, chiziqli tenglamalar — tekshirish bilan.",
        lessons: 6,
      },
      {
        title: "Kvadrat va kasrli ifodalar",
        description: "Ko‘phad amallari, kasrlarni qisqartirish, viyet teoremasi.",
        lessons: 8,
      },
      {
        title: "Funksiyalar va grafiklar",
        description: "Chiziqli funksiya grafigi, tengsizliklarni grafikda ko‘rsatish.",
        lessons: 6,
      },
      {
        title: "Sinov rejimi",
        description: "Namunaviy sinovlar, taymer bilan yechish va xato tahlili.",
        lessons: 6,
      },
    ],
  },

  "c-frontend": {
    summary:
      "Noldan birinchi real loyihagacha: HTML, CSS va JavaScript — amaliy darslar, kod-review va portfolio.",
    longDescription:
      "Darslar 90 daqiqa: 30 daqiqa yangi mavzu, qolgani — brauzerda kod yozish. Har modul oxiridagi topshiriqqa matnli review qaytadi. Kurs yakunida responsive landing page, oddiy interaktiv ilova va GitHub profili — uchov ham portfolio uchun tayyor holda.",
    audience: [
      "Butunlay noldan boshlayotganlar",
      "IT sohasiga karera o‘zgartirib kirib kelmoqchi bo‘lganlar",
      "Freelance yoki junior lavozimga birinchi portfolioni to‘plashni istaganlar",
    ],
    learningOutcomes: [
      "Semantik HTML va Flexbox/Grid bilan aniq joylashuv",
      "JavaScript asoslari: DOM, hodisalar, async oqim",
      "Mobil-ustuvor (mobile-first) responsive tuzilish",
      "Git bilan ishlash va ochiq repo yuritish",
      "Himoyaga tayyor 3 ta portfolio loyihasi",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-fe-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "19:00",
        format: "online",
        location: null,
        capacity: 16,
        seatsRemaining: 3,
        startDate: "2026-09-21",
      },
      {
        id: "g-fe-b",
        title: "B guruhi",
        days: ["Se", "Pay"],
        startTime: "19:00",
        format: "online",
        location: null,
        capacity: 16,
        seatsRemaining: 8,
        startDate: "2026-09-29",
      },
      {
        id: "g-fe-c",
        title: "C guruhi (yakshanba intensiv)",
        days: ["Shan", "Yak"],
        startTime: "11:00",
        format: "online",
        location: null,
        capacity: 16,
        seatsRemaining: 0,
        startDate: "2026-10-10",
      },
    ],
    syllabus: [
      {
        title: "Veb-koz: HTML va CSS",
        description: "Sahifa tuzilishi, semantika, dizayn asoslari va joylashuv modellari.",
        lessons: 10,
      },
      {
        title: "JavaScript bilan jonlantirish",
        description: "O‘zgaruvchidan funksiyagacha, DOM API va hodisa boshqaruvi.",
        lessons: 12,
      },
      {
        title: "Ma‘lumot bilan ishlash",
        description: "Formalar, localStorage, oddiy API so‘rovlari va xatolar bilan ishlash.",
        lessons: 8,
      },
      {
        title: "Loyiha haftalari",
        description: "Individual loyiha, kod-review sikli va portfolio uchun tayyorlash.",
        lessons: 6,
      },
    ],
  },

  "c-python-boshlangich": {
    summary:
      "Python’da dasturlash asoslari va birinchi loyihangacha — Toshkent sinfida yoki online.",
    longDescription:
      "Darslarda kod yoziladi — slaydga vaqt sarflanmaydi. Har hafta o‘rtasida kichik konsol ilovasi: kalkulyatordan fayl bilan ishlovchi vositagacha. Yakuniy ikki hafta — tanlangan yo‘nalish bo‘yicha mini-loyiha: viktorina dasturi, ish vaqti hisoblagichi yoki ma‘lumot to‘quvchi (scraper) scripti.",
    audience: [
      "Dasturlashni butunlay noldan boshlovchilar",
      "Universitet/maktabda Python o‘qib, amaliyot yetishmayotgan o‘quvchilar",
      "Ma‘lumotlar bilan ishlash yoki keyinchalik backend yo‘nalishiga kirishni rejalaganlar",
    ],
    learningOutcomes: [
      "Tip va strukturadan (list, dict, set) to‘g‘ri foydalanish",
      "Funksiyalar va modulli kod yozish",
      "Fayllar va tashqi ma‘lumot bilan ishlash",
      "Kichik loyihani yakuniga yetkazish va kod himoyasidan o‘tkazish",
      "Xatoni o‘qish va debugger bilan tanishish",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-py-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "18:00",
        format: "hybrid",
        location: "Toshkent, Mirzo Ulug‘bek",
        capacity: 12,
        seatsRemaining: 4,
        startDate: "2026-09-21",
      },
      {
        id: "g-py-b",
        title: "B guruhi (shanba)",
        days: ["Shan"],
        startTime: "10:00",
        format: "hybrid",
        location: "Toshkent, Mirzo Ulug‘bek",
        capacity: 12,
        seatsRemaining: 6,
        startDate: "2026-10-03",
      },
    ],
    syllabus: [
      {
        title: "Til poydevori",
        description: "O‘zgaruvchi, shartlar, sikllar — birinchi 200 qatorlik dars kodi.",
        lessons: 8,
      },
      {
        title: "Ma‘lumot strukturalari",
        description: "Ro‘yxatlar, lug‘atlar va funksiya bilan toza interfeys.",
        lessons: 8,
      },
      {
        title: "Fayl va tashqi dunyo",
        description: "CSV/JSON bilan ishlash, sodda so‘rov va xatolarni ushlash.",
        lessons: 6,
      },
      {
        title: "Mini-loyiha",
        description: "Yo‘nalish bo‘yicha individual loyiha va kod review.",
        lessons: 5,
      },
    ],
  },

  "c-frontend-react": {
    summary:
      "React va TypeScript bilan professional darajadagi ilova: holat arxitekturasi, ma‘lumotlar qatlami va test.",
    longDescription:
      "Kurs — frontend bazasi (HTML/CSS/JS) bo‘lgan dasturchilar uchun. Yarim yillik boshqaruv paneli (dashboard) loyihasi ustida ishlash boradi: komponent chegaralari, data-fetching qatlami, forma validatsiyasi va test qoplamasi. Har hafta yakunida kod-review va git flow. Kurs oxirida portfolio uchun tayyor ilova hamda arxitektura yechimlari jurnali qoladi.",
    audience: [
      "Baza bor, lekin ‘frameworksiz’ loyihasi yo‘q dasturchilar",
      "Junior lavozimga ariza berib, texnik suhbatda qiynalayotganlar",
      "Katta kodbazada jamoaviy ishlash tajribasini to‘plashni istaganlar",
    ],
    learningOutcomes: [
      "TypeScript bilan reaktiv komponentlar arxitekturasi",
      "Ma‘lumot oqimini (server state) to‘g‘ri qatlamlash",
      "Formalar, validatsiya va optimistik yangilanishlar",
      "Vitest bilan ma‘noli unit testlar yozish",
      "Performance byudjeti va bundle tahlili",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-react-a",
        title: "A guruhi",
        days: ["Chor", "Jum"],
        startTime: "19:30",
        format: "online",
        location: null,
        capacity: 14,
        seatsRemaining: 5,
        startDate: "2026-09-23",
      },
      {
        id: "g-react-b",
        title: "B guruhi",
        days: ["Pay", "Shan"],
        startTime: "19:00",
        format: "online",
        location: null,
        capacity: 14,
        seatsRemaining: 9,
        startDate: "2026-10-08",
      },
    ],
    syllabus: [
      {
        title: "React asoslarini qayta ochish",
        description: "Hooks chuqurligi, render semantikasi va TypeScript generiklari.",
        lessons: 6,
      },
      {
        title: "Ma‘lumot qatlami",
        description: "Server state, kesh, mutatsiyalar va xato tiklash strategiyalari.",
        lessons: 8,
      },
      {
        title: "Sifat va test",
        description: "Vitest, komponent testi va CI’ga chiqish minimal sozlamasi.",
        lessons: 6,
      },
      {
        title: "Loyiha himoyasi",
        description: "Dashboard yakunlash, arxitektura hujjati va kod himoyasi.",
        lessons: 6,
      },
    ],
  },

  "c-arabic-boshlangich": {
    summary:
      "Arab tili boshlang‘ich: harf va yozuv tartibidan kundalik iboralargacha — onlayn, haftasiga 2 dars.",
    longDescription:
      "Alifbo va tutmashtirish qoidalari dastlabki ikki haftada asoslanadi; so‘ng o‘qish, imlo va oddiy iboralar parallel yuriladi. Har darsda qisqa suhbat mashqi va yangi so‘z minimumi beriladi. Barcha materiallar PDF ko‘rinishida taqdim etiladi; qatnashmagan dars yozuvdan telaffuz bilan birga ko‘riladi.",
    audience: [
      "Tilni umuman bilmagan, lekin o‘rganishga jiddiy niyat qilganlar",
      "Qur’on matnlarini boshlang‘ich darajada tushunishga intiluvchilar",
      "Arab mamlakatlari bilan ish yuritishni rejalaganlar",
    ],
    learningOutcomes: [
      "Harflarni to‘g‘ri yozish va so‘z ichida tutmashtirish",
      "Qisqa matnlarni talaffuz bilan o‘qishni boshlash",
      "300+ eng zarur so‘zni esda saqlash",
      "Kundalik salom, raqam va so‘rov iboralarini ishlatish",
    ],
    teachingLanguages: ["UZ", "AR"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-ar-a",
        title: "A guruhi (ertalabki)",
        days: ["Du", "Chor"],
        startTime: "09:00",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 7,
        startDate: "2026-09-21",
      },
      {
        id: "g-ar-b",
        title: "B guruhi",
        days: ["Pay", "Shan"],
        startTime: "17:00",
        format: "online",
        location: null,
        capacity: 10,
        seatsRemaining: 10,
        startDate: "2026-10-02",
      },
    ],
    syllabus: [
      {
        title: "Yozuv va tovushlar",
        description: "Alifbo, shakllanish qoidalari va imlo ritmini o‘rnatish.",
        lessons: 8,
      },
      {
        title: "Birinchi iboralar",
        description: "Tanishuv, so‘rov-javob, sonlar va kunlik atamalar.",
        lessons: 8,
      },
      {
        title: "Matn bilan ishlash",
        description: "Qisqa matnlarni o‘qish, tarjima qilish va yangi so‘zlarni yodlash texnikasi.",
        lessons: 6,
      },
      {
        title: "Amaliy suhbat",
        description: "Maktab, bozor, masjidda — vaziyatli dialog progonkalari.",
        lessons: 6,
      },
    ],
  },

  "c-arabic-quran": {
    summary:
      "Qur’on matnlarini tushunish kursi: nahv va sarf asoslari bilan, Buxoroda, kunduzgi guruhda.",
    longDescription:
      "Kurs boshlang‘ich o‘qishni biladiganlar uchun: so‘z yasalishi (sarf), ibora ma’nosi va i’rob belgilari orqali matnni bo‘lib tushunish amaliyoti. Har dars — oyatlar ustida birgalikda ish: yangi tushuncha, matn bilan mashq va qisqa xulosa. Uyga tayyorgarlik uchun material oldindan beriladi.",
    audience: [
      "Arab tilini boshlang‘ich darajada o‘qib o‘tganlar",
      "Matn ma’nosini grammatika orqali chuqurroq anglashni istaganlar",
      "Kichik guruhda an’anaviy tartibda o‘qishni afzal ko‘ruvchilar",
    ],
    learningOutcomes: [
      "Asosiy fe’l yasalishlarini (sarf) tanish",
      "I’rob va nahvning amaliy qoidalarini qo‘llash",
      "Soddaroq matnlarni so‘zma-so‘z tushunishni boshlash",
      "Matn doirasidagi so‘z boyligini izchil oshirish",
    ],
    teachingLanguages: ["UZ", "AR"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-qur-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "13:00",
        format: "offline",
        location: "Buxoro, Markaziy",
        capacity: 10,
        seatsRemaining: 4,
        startDate: "2026-09-21",
      },
      {
        id: "g-qur-b",
        title: "B guruhi (yakshanba)",
        days: ["Yak"],
        startTime: "13:00",
        format: "offline",
        location: "Buxoro, Markaziy",
        capacity: 10,
        seatsRemaining: 6,
        startDate: "2026-09-27",
      },
    ],
    syllabus: [
      {
        title: "Sarf poydevori",
        description: "Fe’l o‘zgarishlari: mavzular, shaxslar va amaliy jadval mashqlari.",
        lessons: 8,
      },
      {
        title: "Nahv asoslari",
        description: "Rofe’/mansub qoidalari va jumlani tahlil qilish tartibi.",
        lessons: 8,
      },
      {
        title: "Matn bilan ishlash",
        description: "Tanlangan sura oyatlari ustida so‘zma-so‘z tahlil amaliyoti.",
        lessons: 10,
      },
      {
        title: "Mustahkamlash",
        description: "O‘zlashtirilgan qoidalarni yangi matnlarda mustaqil qo‘llash.",
        lessons: 4,
      },
    ],
  },

  "c-uiux": {
    summary:
      "UI/UX dizayn noldan: tadqiqot va wireframe’dan to‘liq maket va foydalanuvchi testigacha.",
    longDescription:
      "Bir semestrlik yo‘l: foydalanuvchi oqimini chiqarish, wireframe, Figma’da UI-kit va dizayn tizimi asoslari, so‘ng usability test. Har modul oxirida — real brief asosida doska (miroboard) ustida jamoaviy review. Kurs yakunida portfolio uchun bitta to‘liq kays va bitta mini-kays tayyor holatida bo‘ladi.",
    audience: [
      "Grafik dizayndan mahsulot dizayniga o‘tmoqchi bo‘lganlar",
      "Bosma/veb dizayn tajribasi bor, UX’ni chuqurlashtirishni istaganlar",
      "Yangi kasb tanlab, amaliy portfolio bilan kirib kelmoqchi bo‘lganlar",
    ],
    learningOutcomes: [
      "Brief’dan foydalanuvchi oqimini modellovchi tuzish",
      "Figma: Auto Layout, komponentlar, variantlar bilan ishlash",
      "Kichik UI-kit va dizayn tokenlarini yig‘ish",
      "5 kishilik usability testni o‘tkazish va xulosa chiqarish",
      "Case-study uchun struktura va hikoya matnini yozish",
    ],
    teachingLanguages: ["UZ", "EN"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-uiux-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "18:30",
        format: "offline",
        location: "Toshkent, Mirzo Ulug‘bek",
        capacity: 12,
        seatsRemaining: 3,
        startDate: "2026-09-21",
      },
      {
        id: "g-uiux-b",
        title: "B guruhi",
        days: ["Se", "Pay"],
        startTime: "18:30",
        format: "offline",
        location: "Toshkent, Mirzo Ulug‘bek",
        capacity: 12,
        seatsRemaining: 5,
        startDate: "2026-09-29",
      },
    ],
    syllabus: [
      {
        title: "UX asoslari va tadqiqot",
        description: "Maqsad-analitika, suhbatlar, foydalanuvchi yo‘li xaritasi va prototip.",
        lessons: 7,
      },
      {
        title: "UI qurilishi",
        description: "Setka, tipografiya, rang tizimi va Figma’da komponent arxitekturasi.",
        lessons: 9,
      },
      {
        title: "Dizayn tizimi",
        description: "UI-kit yig‘ish, tokenizatsiya va dizayn-hujjalashtirish amaliyoti.",
        lessons: 6,
      },
      {
        title: "Test va himoya",
        description: "Usability test o‘tkazish, tuzatish sikli va case-study taqdimoti.",
        lessons: 6,
      },
    ],
  },

  "c-graphic-design": {
    summary:
      "Photoshop va Illustrator bilan amaliy grafik dizayn: brend elementlari, bosma va raqamli materiallar.",
    longDescription:
      "Darslar Andijondagi kompyuter sinfida o‘tkaziladi, onlayn qatnashuvchilar bir xil darsni stream orqali oladi va topshiriqlarni masofadan bo‘lishadi. Mavzular bosqichma-bosqich loyiha ustida yuriladi: logotip va firmaviy uslub, ijtimoiy tarmoq shablonlari, bosmaga chiqarishga tayyor fayl. Har hafta — bitta amaliy topshiriq va ko‘rikdan o‘tish.",
    audience: [
      "Dizayn dasturlari bilan ishlashni noldan o‘rganmoqchi bo‘lganlar",
      "Kichik biznes uchun vizual material tayyorlaydigan erkin ishchilar",
      "Bosmaxona/riqamli chop etishga fayl tayyorlash talab bo‘lganlar",
    ],
    learningOutcomes: [
      "Raster va vektor farqini bilish, to‘g‘ri dasturni tanlash",
      "Logotip va firmaviy uslub elementlarini professional tayyorlash",
      "CMYK/RGB va bosmaga chiqarish tekshiruv qoidalari",
      "Ijtimoiy tarmoq shablonlarini tizimli yurish",
    ],
    teachingLanguages: ["UZ"],
    pricePeriod: "month",
    groups: [
      {
        id: "g-gr-a",
        title: "A guruhi",
        days: ["Du", "Chor"],
        startTime: "14:00",
        format: "hybrid",
        location: "Andijon, Markaziy",
        capacity: 10,
        seatsRemaining: 4,
        startDate: "2026-09-21",
      },
      {
        id: "g-gr-b",
        title: "B guruhi (shanba)",
        days: ["Shan"],
        startTime: "11:00",
        format: "hybrid",
        location: "Andijon, Markaziy",
        capacity: 10,
        seatsRemaining: 5,
        startDate: "2026-10-03",
      },
    ],
    syllabus: [
      {
        title: "Asboblar va fayl madaniyati",
        description: "Qatlamlar, tanlash, vektor yo‘llar va to‘g‘ri loyiha fayli tartibi.",
        lessons: 6,
      },
      {
        title: "Brend elementi loyihasi",
        description: "Logotip eskizi vektorlarga o‘tkaziladi; rang va shrift qoida qilinadi.",
        lessons: 8,
      },
      {
        title: "Bosmaga tayyorlash",
        description: "CMYK, bleed va tekshiruv — vizitka, varaq va banner amaliyoti.",
        lessons: 6,
      },
      {
        title: "Raqamli materiallar",
        description: "Ijtimoiy tarmoq postlari uchun tizimli shablon to‘plami.",
        lessons: 5,
      },
    ],
  },
};
