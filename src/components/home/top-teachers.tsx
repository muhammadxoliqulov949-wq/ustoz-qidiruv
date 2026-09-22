import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Star, Users } from "lucide-react";
import { Section } from "@/components/layout/section";
import type { Teacher } from "@/data/models";
import { formatCount, formatRating } from "@/lib/format";
import { HomeSectionHeading } from "./home-section-heading";

export interface TopTeachersProps {
  teachers: Teacher[];
}

export function TopTeachers({ teachers }: TopTeachersProps) {
  return (
    <Section ariaLabelledby="top-teachers-title" className="home-section">
      <HomeSectionHeading
        id="top-teachers-title"
        eyebrow="Top ustozlar"
        title={<>Eng yaxshi <span className="home-title-accent">ustozlar</span></>}
        description="O‘quvchilar baholagan, tajribasi va faol kurslari ochiq ko‘rsatilgan ustozlar."
        action={
          <Link href="/teachers" className="home-outline-link">
            Barcha ustozlar <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      {teachers.length > 0 ? (
        <ul className="home-teacher-grid">
          {teachers.map((teacher, index) => (
            <li key={teacher.id}>
              <article className={`home-teacher-card home-teacher-tone-${(index % 2) + 1}`}>
                <div className="home-teacher-media">
                  {teacher.photo ? (
                    <Image
                      src={teacher.photo}
                      alt={teacher.name}
                      fill
                      sizes="(min-width: 1280px) 280px, (min-width: 768px) 45vw, 100vw"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span aria-hidden="true">{teacher.name.slice(0, 1)}</span>
                  )}
                  <div className="home-teacher-shade" aria-hidden="true" />
                  {teacher.verified ? (
                    <span className="home-verified-pill"><BadgeCheck aria-hidden="true" /> Tasdiqlangan</span>
                  ) : null}
                  <div className="home-teacher-identity">
                    <h3>{teacher.name}</h3>
                    <p>{teacher.specialization}</p>
                  </div>
                </div>
                <div className="home-teacher-body">
                  <div className="home-teacher-rating">
                    <span className="home-rating"><Star aria-hidden="true" /> {formatRating(teacher.rating)} <small>({formatCount(teacher.reviews)})</small></span>
                    <span>{teacher.experienceYears} yil tajriba</span>
                  </div>
                  <div className="home-teacher-tags">
                    {teacher.languages.map((language) => <span key={language}>{language}</span>)}
                  </div>
                  <div className="home-teacher-stats">
                    <span><Users aria-hidden="true" /><strong>{formatCount(teacher.students)}</strong> o‘quvchi</span>
                    <span><BookOpen aria-hidden="true" /><strong>{teacher.activeCourses}</strong> kurs</span>
                  </div>
                  <Link href={`/teachers/${teacher.slug}`} className="home-card-cta">
                    Profilni ko‘rish <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="home-empty-state">
          <Users aria-hidden="true" />
          <h3>Hozircha ustozlar ro‘yxati bo‘sh</h3>
          <p>Ommaviy profilini ochgan va kurs e’lon qilgan ustozlar shu yerda ko‘rinadi.</p>
        </div>
      )}
    </Section>
  );
}
