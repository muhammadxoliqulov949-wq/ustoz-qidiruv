import type { Teacher } from "./models";

/**
 * MOCK data only — Phase 2 “Eng yaxshi ustozlar”.
 * All profiles are neutral fictional persons; no real or celebrity
 * identities are referenced. Future API responses must satisfy
 * `Teacher` (see models.ts).
 */
export const topTeachers: Teacher[] = [
  {
    id: "t-dilshod-rahimov",
    slug: "dilshod-rahimov",
    name: "Dilshod Rahimov",
    photo: "/media/teachers/dilshod-rahimov.jpg",
    verified: true,
    specialization: "IELTS va umumiy ingliz tili",
    rating: 4.9,
    reviews: 214,
    students: 1260,
    experienceYears: 11,
    languages: ["UZ", "EN", "RU"],
    activeCourses: 6,
  },
  {
    id: "t-nodira-yusupova",
    slug: "nodira-yusupova",
    name: "Nodira Yusupova",
    photo: "/media/teachers/nodira-yusupova.jpg",
    verified: true,
    specialization: "Matematika, DTM tayyorlov",
    rating: 4.8,
    reviews: 156,
    students: 890,
    experienceYears: 14,
    languages: ["UZ", "RU"],
    activeCourses: 4,
  },
  {
    id: "t-sardor-qodirov",
    slug: "sardor-qodirov",
    name: "Sardor Qodirov",
    photo: "/media/teachers/sardor-qodirov.jpg",
    verified: true,
    specialization: "Frontend dasturlash",
    rating: 4.9,
    reviews: 342,
    students: 2100,
    experienceYears: 8,
    languages: ["UZ", "EN", "RU"],
    activeCourses: 5,
  },
  {
    id: "t-malika-ergasheva",
    slug: "malika-ergasheva",
    name: "Malika Ergasheva",
    photo: "/media/teachers/malika-ergasheva.jpg",
    verified: false,
    specialization: "Arab tili va tarjimasi",
    rating: 4.6,
    reviews: 58,
    students: 190,
    experienceYears: 6,
    languages: ["UZ", "AR", "RU"],
    activeCourses: 3,
  },
];
