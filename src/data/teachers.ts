import type { Teacher } from "./models";
import { courses } from "./courses";
import { teacherProfilesById } from "./teacher-profiles";

/* -------------------------------------------------------------------------- */
/* Teacher registry — Phase 2 record set, completed by Phase 5.                  */
/* SEED FIXTURE only (development `npm run db:seed`); all profiles are neutral    */
/* fictional persons. Since Phase 12 no public page renders this array —         */
/* /teachers and /teachers/[slug] read PostgreSQL through                        */
/* src/server/public-repo.ts.                                                    */
/*                                                                                 */
/* Integrity rules (enforced at build time):                                       */
/*  • every course.teacher.id must exist here (no phantom course authors);        */
/*  • `activeCourses` is DERIVED from courses.ts — never hand-set — so the card   */
/*    badge and /teachers/[slug] can never contradict each other;                 */
/*  • every teacher needs a TeacherProfile (teacher-profiles.ts).                 */
/* Future API responses must satisfy `Teacher` (see models.ts).                    */
/* -------------------------------------------------------------------------- */

/** Everything except the two derived/merged fields. */
type TeacherSeed = Omit<Teacher, "activeCourses" | "detail">;

const teacherSeeds: TeacherSeed[] = [
  {
    id: "t-dilshod-rahimov",
    slug: "dilshod-rahimov",
    name: "Dilshod Rahimov",
    photo: "/media/teachers/dilshod-rahimov.jpg",
    verified: true,
    specialization: "IELTS va umumiy ingliz tili",
    bio: "11 yildan beri IELTS va akademik ingliz tili bo‘yicha o‘qitadi. 900 dan ortiq o‘quvchisidan 60+i 7.0+ bandga chiqqan. Darslarda qolip emas, band-deskriptor mantig‘i ustida ishlaydi.",
    rating: 4.9,
    reviews: 214,
    students: 1260,
    experienceYears: 11,
    languages: ["UZ", "EN", "RU"],
  },
  {
    id: "t-nodira-yusupova",
    slug: "nodira-yusupova",
    name: "Nodira Yusupova",
    photo: "/media/teachers/nodira-yusupova.jpg",
    verified: true,
    specialization: "Matematika, DTM tayyorlov",
    bio: "Mahalliy olimpiada jamlari sohibi, 14 yillik tajriba. Abituriyentlar bilan ishlashda ‘mavzu bo‘yicha bo‘sh joy qoldirmaslik’ tizimini qo‘llaydi — har o‘quvchi xaritasi alohida yuritiladi.",
    rating: 4.8,
    reviews: 156,
    students: 890,
    experienceYears: 14,
    languages: ["UZ", "RU"],
  },
  {
    id: "t-sardor-qodirov",
    slug: "sardor-qodirov",
    name: "Sardor Qodirov",
    photo: "/media/teachers/sardor-qodirov.jpg",
    verified: true,
    specialization: "Frontend dasturlash",
    bio: "Product muhandisi, olti yillik jamoaviy ish tajribasi. Kurslarida real kod-review madaniyati — har bir topshiriq pull request tartibida qayta ko‘riladi.",
    rating: 4.9,
    reviews: 342,
    students: 2100,
    experienceYears: 8,
    languages: ["UZ", "EN", "RU"],
  },
  {
    id: "t-malika-ergasheva",
    slug: "malika-ergasheva",
    name: "Malika Ergasheva",
    photo: "/media/teachers/malika-ergasheva.jpg",
    verified: false,
    specialization: "Arab tili va tarjimasi",
    bio: "Filologiya fakultetini tugatgan, tarjima bo‘yicha amaliyot tajribasi bor. Boshlang‘ich guruhlar bilan ishlashda kichik qadamlar va kundalik takrorlash usulini tanlaydi.",
    rating: 4.6,
    reviews: 58,
    students: 190,
    experienceYears: 6,
    languages: ["UZ", "AR", "RU"],
  },
  {
    id: "t-zilola-akbarova",
    slug: "zilola-akbarova",
    name: "Zilola Akbarova",
    photo: "/media/teachers/zilola-akbarova.jpg",
    verified: true,
    specialization: "Boshlang‘ich sinflarda ingliz tili",
    bio: "Maktabgacha va kichik sinf bolalari bilan 7 yillik amaliyot. Darslarni o‘yin, qo‘shiq va harakat orqali yuritadi — bolani majburlashsiz ritm usuli asosiy.",
    rating: 4.9,
    reviews: 64,
    students: 310,
    experienceYears: 7,
    languages: ["UZ", "EN"],
  },
  {
    id: "t-malika-sattorova",
    slug: "malika-sattorova",
    name: "Malika Sattorova",
    photo: "/media/teachers/malika-sattorova.jpg",
    verified: false,
    specialization: "Ingliz tili muloqot klublari",
    bio: "Konferensiya tarjimasi tajribasi bor. Klub seanslarida qattiq grammatik tuzatishlarsiz, faqat tushunarlilik ustida ishlaydi — shuning uchun klubi tortinchoq boshlovchilarga ham ochiq.",
    rating: 4.4,
    reviews: 88,
    students: 610,
    experienceYears: 5,
    languages: ["UZ", "EN"],
  },
  {
    id: "t-shahnoza-tursunova",
    slug: "shahnoza-tursunova",
    name: "Shahnoza Tursunova",
    photo: "/media/teachers/shahnoza-tursunova.jpg",
    verified: false,
    specialization: "Maktabgacha matematika va mantiq",
    bio: "Boshlang‘ich sinf metodikasi bo‘yicha sertifikatlangan o‘qituvchi. Har bir mavzuni qo‘g‘irchoq, kubik va rasm materiallar bilan bog‘lab tushuntiradi.",
    rating: 4.6,
    reviews: 41,
    students: 205,
    experienceYears: 6,
    languages: ["UZ"],
  },
  {
    id: "t-rustam-alimov",
    slug: "rustam-alimov",
    name: "Rustam Alimov",
    photo: "/media/teachers/rustam-alimov.jpg",
    verified: true,
    specialization: "Algebra va test madaniyati",
    bio: "Maktab o‘qituvchisi, 12 yillik tajriba. O‘quvchilarda ‘tekshirib ko‘rish’ odatini shakllantirishga alohida e’tibor beradi — sinovda eng ko‘p ball shu yerda qoladi, deydi.",
    rating: 4.3,
    reviews: 52,
    students: 340,
    experienceYears: 12,
    languages: ["UZ", "RU"],
  },
  {
    id: "t-behzod-karimov",
    slug: "behzod-karimov",
    name: "Behzod Karimov",
    photo: "/media/teachers/behzod-karimov.jpg",
    verified: true,
    specialization: "Python va ma‘lumotlar bilan ishlash",
    bio: "Backend muhandisi, ichki biznes vositalari ustida ishlagan. Boshlovchilarga ‘slaydsiz dars’ usulini tanlaydi — sinfda birinchi daqiqadanoq kod yoziladi.",
    rating: 4.6,
    reviews: 187,
    students: 1150,
    experienceYears: 7,
    languages: ["UZ", "EN", "RU"],
  },
  {
    id: "t-ubaydullo-nasriddinov",
    slug: "ubaydullo-nasriddinov",
    name: "Ubaydullo Nasriddinov",
    photo: "/media/teachers/ubaydullo-nasriddinov.jpg",
    verified: true,
    specialization: "Nahv, sarf va matn tahlili",
    bio: "An’anaviy ilm halqalarida tahsil olgan, 20 yildan beri nahv va sarf darslari beradi. Qoidalarni quruq ezmaska, matn ustida ko‘rsatib o‘tishni afzal ko‘radi.",
    rating: 4.7,
    reviews: 73,
    students: 420,
    experienceYears: 20,
    languages: ["UZ", "AR"],
  },
  {
    id: "t-aziza-nazarova",
    slug: "aziza-nazarova",
    name: "Aziza Nazarova",
    photo: "/media/teachers/aziza-nazarova.jpg",
    verified: true,
    specialization: "UI/UX va dizayn tizimlari",
    bio: "Xalqaro jamoalarda ishlagan product designer. Kurs kayslarini haqiqiy brend brieflari asosida quradi — portfolio talablari nima bo‘lishini bo‘g‘in-bog‘in ko‘rsatadi.",
    rating: 4.8,
    reviews: 121,
    students: 640,
    experienceYears: 6,
    languages: ["UZ", "EN"],
  },
  {
    id: "t-javohir-xolliyev",
    slug: "javohir-xolliyev",
    name: "Javohir Xolliyev",
    photo: "/media/teachers/javohir-xolliyev.jpg",
    verified: false,
    specialization: "Grafik dizayn va bosmaga tayyorlash",
    bio: "Bosmaxona va raqamli reklama tajribasi bo‘lgan dizayner. Fayl madaniyati va chop etishga tayyorlov bo‘yicha qattiq me‘yor qo‘yadi — ‘chiroyli emas, avval to‘g‘ri’.",
    rating: 3.9,
    reviews: 26,
    students: 150,
    experienceYears: 9,
    languages: ["UZ", "RU"],
  },
  {
    id: "t-kamola-yuldosheva",
    slug: "kamola-yuldosheva",
    name: "Kamola Yuldosheva",
    photo: "/media/teachers/kamola-yuldosheva.jpg",
    verified: false,
    specialization: "Umumiy ingliz tili (A2–B1)",
    bio: "Filolog, yetti yildan beri o‘rta va katta yoshli guruhlar bilan ishlaydi. Guruhlarini kichik ushlab, har o‘quvchiga haftada bir marta shaxsiy fikr-qaytaliuv berishni ustuvor ko‘radi.",
    rating: 4.5,
    reviews: 64,
    students: 380,
    experienceYears: 8,
    languages: ["UZ", "EN"],
  },
];

/** Derived from the canonical course list — the single source of truth. */
const courseCountById = new Map<string, number>();
for (const course of courses) {
  if (!teacherSeeds.some((seed) => seed.id === course.teacher.id)) {
    throw new Error(
      `Course "${course.slug}" references unknown teacher "${course.teacher.id}" — add the teacher to src/data/teachers.ts`,
    );
  }
  courseCountById.set(
    course.teacher.id,
    (courseCountById.get(course.teacher.id) ?? 0) + 1,
  );
}

export const teachers: Teacher[] = teacherSeeds.map((seed) => {
  const detail = teacherProfilesById[seed.id];
  if (!detail) {
    throw new Error(
      `Missing TeacherProfile for "${seed.id}" — add it to src/data/teacher-profiles.ts`,
    );
  }
  return {
    ...seed,
    activeCourses: courseCountById.get(seed.id) ?? 0,
    detail,
  };
});

export const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

/* There is deliberately no `topTeachers` export here any more. The homepage    */
/* “Eng yaxshi ustozlar” row is read from PostgreSQL at request time            */
/* (listPublicTeachers in src/server/public-repo.ts, ranked by the same pure    */
/* sorter as /teachers?sort=rating); a hand-picked slice of this fixture array  */
/* would render portraits whose /teachers/[slug] route 404s. This file is seed  */
/* input only.                                                                  */
