import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, CalendarDays, Star, Users } from "lucide-react";
import type { Teacher } from "@/data/models";
import { teacherCta } from "@/data/site";
import { formatCount, formatRating } from "@/lib/format";

const features = [
  { icon: BookOpen, title: "Kurslarni boshqarish", text: "Dastur va guruhlarni bir joyda yuriting." },
  { icon: CalendarDays, title: "Moslashuvchan jadval", text: "Online yoki offline formatni o‘zingiz belgilang." },
  { icon: Users, title: "O‘quvchilarga ko‘rining", text: "Profil, tajriba va kurslaringizni ochiq ko‘rsating." },
] as const;

export function TeacherCta({ teacher }: { teacher: Teacher | null }) {
  return (
    <section aria-labelledby="teacher-cta-title" className="site-container home-teacher-cta-section">
      <div className="home-teacher-cta">
        <div className="home-teacher-cta-copy">
          <p className="home-eyebrow"><span aria-hidden="true" />Ustozlar uchun</p>
          <h2 id="teacher-cta-title">Bilimingizni ulashing, <span>o‘quvchilaringizni toping</span></h2>
          <p>{teacherCta.text}</p>
          <div className="home-teacher-cta-actions">
            <Link href={teacherCta.action.href} className="home-gold-link">
              {teacherCta.action.label} <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/help" className="home-text-link">Qanday boshlanadi?</Link>
          </div>
          <ul className="home-teacher-cta-features">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title}>
                  <Icon aria-hidden="true" />
                  <div><strong>{feature.title}</strong><span>{feature.text}</span></div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="home-teacher-dashboard" aria-label="Ustoz profilining real namunasi">
          {teacher ? (
            <>
              <div className="home-teacher-dashboard-profile">
                <div className="home-teacher-dashboard-photo">
                  {teacher.photo ? (
                    <Image src={teacher.photo} alt={teacher.name} fill sizes="420px" className="object-cover object-top" />
                  ) : <span aria-hidden="true">{teacher.name.slice(0, 1)}</span>}
                </div>
                <div>
                  <span className="home-verified-pill"><BadgeCheck aria-hidden="true" /> {teacher.verified ? "Tasdiqlangan" : "Ommaviy profil"}</span>
                  <h3>{teacher.name}</h3>
                  <p>{teacher.specialization}</p>
                  <span className="home-rating"><Star aria-hidden="true" /> {formatRating(teacher.rating)} <small>({formatCount(teacher.reviews)})</small></span>
                </div>
              </div>
              <div className="home-teacher-dashboard-metrics">
                <span><Users aria-hidden="true" /><strong>{formatCount(teacher.students)}</strong><small>O‘quvchilar</small></span>
                <span><BookOpen aria-hidden="true" /><strong>{teacher.activeCourses}</strong><small>Faol kurslar</small></span>
                <span><CalendarDays aria-hidden="true" /><strong>{teacher.experienceYears}</strong><small>Yil tajriba</small></span>
              </div>
              <Link href={`/teachers/${teacher.slug}`} className="home-panel-link">
                Ommaviy profilni ko‘rish <ArrowRight aria-hidden="true" />
              </Link>
            </>
          ) : (
            <div className="home-teacher-dashboard-empty">
              <Users aria-hidden="true" />
              <h3>Profilingiz shu yerda boshlanadi</h3>
              <p>Ma’lumotlaringizni kiriting, so‘ng kurs va jadvalingizni e’lon qiling.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
