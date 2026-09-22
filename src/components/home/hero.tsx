import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Star, Users } from "lucide-react";
import { HeroSearch } from "./hero-search";
import { QuickFilters } from "./quick-filters";
import { hero, quickFilters } from "@/data/site";
import type { Teacher } from "@/data/models";
import { formatCount, formatRating } from "@/lib/format";

export function Hero({
  teachers,
  totalTeachers,
}: {
  teachers: Teacher[];
  totalTeachers: number;
}) {
  return (
    <section aria-labelledby="hero-title" className="home-hero">
      <div className="home-ambient home-ambient-emerald" aria-hidden="true" />
      <div className="home-ambient home-ambient-amber" aria-hidden="true" />
      <div className="site-container home-hero-grid motion-hero-reveal">
        <div className="home-hero-copy">
          <p className="home-eyebrow home-hero-eyebrow">
            <span aria-hidden="true" />
            {hero.eyebrow}
          </p>
          <h1 id="hero-title">
            Zamonaviy ustozni topishning <span>ishonchli yo‘li</span>
          </h1>
          <p className="home-hero-lede">{hero.subtitle}</p>
          <div className="home-hero-search-wrap">
            <HeroSearch />
          </div>
          <div className="home-quick-row">
            <span>Tezkor tanlov:</span>
            <QuickFilters filters={quickFilters} />
          </div>
        </div>
        <HeroTeacherStage teachers={teachers} totalTeachers={totalTeachers} />
      </div>
      <div className="site-container home-hero-proof" aria-label="Platforma imkoniyatlari">
        <div><BadgeCheck aria-hidden="true" /><span>Tasdiqlangan profillar</span></div>
        <div><Users aria-hidden="true" /><span>Online va offline tanlov</span></div>
        <div><Star aria-hidden="true" /><span>Haqiqiy reyting va izohlar</span></div>
      </div>
    </section>
  );
}

function HeroTeacherStage({
  teachers,
  totalTeachers,
}: {
  teachers: Teacher[];
  totalTeachers: number;
}) {
  if (teachers.length === 0) {
    return (
      <div className="home-hero-stage home-hero-stage-empty" aria-label="Ustozlar katalogi">
        <Users aria-hidden="true" />
        <p>Yangi ustoz profillari e’lon qilinishi bilan shu yerda ko‘rinadi.</p>
        <Link href="/teachers">Ustozlar katalogi <ArrowRight aria-hidden="true" /></Link>
      </div>
    );
  }

  return (
    <div className="home-hero-stage" aria-label="Tavsiya etilgan ustozlar">
      <div className="home-orbit home-orbit-one" aria-hidden="true" />
      <div className="home-orbit home-orbit-two" aria-hidden="true" />
      {teachers.slice(0, 3).map((teacher, index) => (
        <HeroTeacherCard key={teacher.id} teacher={teacher} index={index} />
      ))}
      {totalTeachers > 0 ? (
        <Link href="/teachers" className="home-hero-teacher-count">
          <Users aria-hidden="true" />
          <span><strong>{formatCount(totalTeachers)}</strong>faol ustoz</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function HeroTeacherCard({ teacher, index }: { teacher: Teacher; index: number }) {
  return (
    <Link
      href={`/teachers/${teacher.slug}`}
      className={`home-hero-teacher home-hero-teacher-${index + 1}`}
      aria-label={`${teacher.name} profilini ko‘rish`}
    >
      <div className="home-hero-teacher-photo">
        {teacher.photo ? (
          <Image
            src={teacher.photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 260px, 45vw"
            priority={index === 0}
            className="object-cover object-top"
          />
        ) : (
          <span aria-hidden="true">{teacher.name.slice(0, 1)}</span>
        )}
        {teacher.verified ? (
          <span className="home-verified-pill"><BadgeCheck aria-hidden="true" /> Tasdiqlangan</span>
        ) : null}
      </div>
      <div className="home-hero-teacher-info">
        <div><strong>{teacher.name}</strong><span>{teacher.specialization}</span></div>
        <span className="home-rating"><Star aria-hidden="true" /> {formatRating(teacher.rating)}</span>
      </div>
    </Link>
  );
}
