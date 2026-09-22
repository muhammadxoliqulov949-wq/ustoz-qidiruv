import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, SearchX, Signal, Star, Users } from "lucide-react";
import { Section } from "@/components/layout/section";
import { SaveButton } from "@/components/ui/save-button";
import { courseFormatLabels, courseLevelLabels } from "@/data/courses";
import type { Course } from "@/data/models";
import { formatCount, formatPrice, formatRating } from "@/lib/format";
import { HomeSectionHeading } from "./home-section-heading";

export interface RecommendedCoursesProps {
  courses: Course[];
}

export function RecommendedCourses({ courses }: RecommendedCoursesProps) {
  const [featured, ...supporting] = courses;

  return (
    <Section ariaLabelledby="recommended-courses-title" className="home-section">
      <HomeSectionHeading
        id="recommended-courses-title"
        eyebrow="Siz uchun"
        title={<>Tavsiya etilgan <span className="home-title-accent">kurslar</span></>}
        description="Maqsadingizga mos kurslarni real reyting, format va narx bo‘yicha ko‘ring."
        action={
          <Link href="/courses" className="home-outline-link">
            Barcha kurslar <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      {featured ? (
        <div className="home-course-layout">
          <FeaturedCourse course={featured} />
          <ul className="home-course-supporting">
            {supporting.slice(0, 4).map((course) => (
              <li key={course.id}><CompactCourse course={course} /></li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="home-empty-state">
          <SearchX aria-hidden="true" />
          <h3>Hozircha kurslar e’lon qilinmagan</h3>
          <p>Yangi kurslar joylashtirilishi bilan ular shu yerda ko‘rinadi.</p>
        </div>
      )}
    </Section>
  );
}

function FeaturedCourse({ course }: { course: Course }) {
  return (
    <article className="home-featured-course">
      <div className="home-featured-course-media">
        {course.image ? (
          <Image
            src={course.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <span className="home-popular-badge"><Star aria-hidden="true" /> Yuqori reyting</span>
        <SaveButton title={course.title} kind="course" entityId={course.id} className="home-save-button" />
      </div>
      <div className="home-featured-course-body">
        <div className="home-meta-row">
          <span className="home-format-badge">{courseFormatLabels[course.format]}</span>
          <span><Signal aria-hidden="true" /> {courseLevelLabels[course.level]}</span>
          {course.location ? <span><MapPin aria-hidden="true" /> {course.location}</span> : null}
        </div>
        <h3><Link href={`/courses/${course.slug}`}>{course.title}</Link></h3>
        <p className="home-course-teacher">{course.teacher.name}</p>
        <div className="home-course-facts">
          <span className="home-rating"><Star aria-hidden="true" /> {formatRating(course.rating)} <small>({formatCount(course.reviews)})</small></span>
          <span><Users aria-hidden="true" /> {formatCount(course.students)} o‘quvchi</span>
        </div>
        <div className="home-course-footer">
          <strong>{formatPrice(course.priceUzs)}{course.priceUzs > 0 ? <small> / oyiga</small> : null}</strong>
          <Link href={`/courses/${course.slug}`}>Batafsil <ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}

function CompactCourse({ course }: { course: Course }) {
  return (
    <article className="home-compact-course">
      <div className="home-compact-course-media">
        {course.image ? (
          <Image src={course.image} alt="" fill sizes="(min-width: 1024px) 220px, 40vw" className="object-cover" />
        ) : null}
        <span className="home-format-badge">{courseFormatLabels[course.format]}</span>
      </div>
      <div className="home-compact-course-body">
        <h3><Link href={`/courses/${course.slug}`}>{course.title}</Link></h3>
        <p>{course.teacher.name}</p>
        <div>
          <span className="home-rating"><Star aria-hidden="true" /> {formatRating(course.rating)}</span>
          <strong>{formatPrice(course.priceUzs)}</strong>
        </div>
      </div>
    </article>
  );
}
