import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronRight, Globe, MapPin, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard } from "@/components/ui/course-card";
import { Rating, VerifiedMark } from "@/components/ui/rating";
import { SectionHeader } from "@/components/ui/section-header";
import { TeacherReviews } from "@/components/teachers/teacher-reviews";
import { cityLabel, courseFormatLabels } from "@/data/courses";
import {
  getPublicTeacherBySlug,
  listPublicTeacherReviews,
} from "@/server/public-repo";
import { buildTeacherFaq } from "@/data/teacher-faq";
import { formatCount, formatPrice } from "@/lib/format";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* /teachers/[slug] — the teacher profile (Phase 5). Fully server-rendered;        */
/* the only interactive surfaces are links and native <details> FAQ. Course,       */
/* Phase 12: the profile, its facets and its ACTIVE COURSES all come from one      */
/* database read. The course list is the set of published courses whose            */
/* teacher_user_id FK points at this profile, so the relation is owned in exactly   */
/* one place and cannot be duplicated or contradicted.                              */
/*                                                                                  */
/* RENDERING: dynamic SSR — a teacher's published course set changes at runtime.    */
/*                                                                                  */
/* NO generateStaticParams: this profile is runtime PostgreSQL data, so slug        */
/* enumeration at build time would make `npm run build` require a reachable          */
/* database. The slug is resolved on demand by getPublicTeacherBySlug(), which       */
/* only ever returns a public profile that owns a published course; anything         */
/* else 404s at request time.                                                       */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPublicTeacherBySlug(slug);
  if (!found) return { title: "Ustoz topilmadi" };
  const { row } = found;
  const { teacher } = row;
  return {
    title: `${teacher.name} — ${teacher.specialization}`,
    description:
      row.courseIds.length > 0
        ? `${teacher.bio} Ustozning ${row.courseIds.length} ta ochiq kursi bor.`
        : teacher.bio,
    alternates: { canonical: `/teachers/${teacher.slug}` },
  };
}

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getPublicTeacherBySlug(slug);
  if (!found) notFound();
  const { row, courses: own } = found;
  const { teacher, formats, cities, minPriceUzs } = row;
  const faq = buildTeacherFaq(row);
  /*
   * PHASE 19: written reviews come from `course_reviews` (published rows of this
   * teacher's published courses), joined by the ownership FK. The count beside the
   * rating is `teacher_profiles.reviews_count`, which is a cached aggregate over
   * exactly these rows — so the list and the number cannot disagree.
   */
  const reviews = await listPublicTeacherReviews(teacher.id);

  return (
    <div className="site-container pb-16 pt-8 lg:pt-12">
      {/* Breadcrumb */}
      <nav aria-label="Tarmoq yo‘li" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-500">
          <li>
            <Link href="/" className="transition-colors duration-fast hover:text-ink-900">
              Bosh sahifa
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3.5 text-ink-300" />
          <li>
            <Link
              href="/teachers"
              className="transition-colors duration-fast hover:text-ink-900"
            >
              Ustozlar
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3.5 text-ink-300" />
          <li aria-current="page" className="truncate font-medium text-ink-900">
            {teacher.name}
          </li>
        </ol>
      </nav>

      {/* --------------------------------------------------------------- */}
      {/* Profile hero                                                      */}
      {/* --------------------------------------------------------------- */}
      <header className="grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[15rem] overflow-hidden rounded-xl border border-line bg-surface-muted md:mx-0">
          {teacher.photo ? (
            <Image
              src={teacher.photo}
              alt={`${teacher.name} — ustoz`}
              fill
              priority
              sizes="(min-width: 768px) 240px, 60vw"
              className="object-cover object-[center_15%]"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {teacher.verified ? (
              <Badge variant="accent">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck aria-hidden="true" className="size-3.5" />
                  Tasdiqlangan ustoz
                </span>
              </Badge>
            ) : null}
            {formats.map((format) => (
              <Badge key={format} variant="neutral">
                {courseFormatLabels[format]}
              </Badge>
            ))}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.015em] text-balance text-ink-900 md:text-4xl">
            {teacher.name}
            {teacher.verified ? (
              <VerifiedMark className="ms-2 align-[-4px]" />
            ) : null}
          </h1>
          <p className="mt-1.5 text-lg text-ink-500">{teacher.specialization}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Rating value={teacher.rating} reviews={teacher.reviews} />
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
              <Globe aria-hidden="true" className="size-4 text-ink-400" />
              {teacher.languages.join(", ")} tillarida o‘qitadi
            </span>
            {cities.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                <MapPin aria-hidden="true" className="size-4 text-ink-400" />
                {cities.map((city) => cityLabel(city)).join(", ")}
              </span>
            ) : formats.includes("online") ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                <Wifi aria-hidden="true" className="size-4 text-ink-400" />
                Butun respublika — onlayn
              </span>
            ) : null}
          </div>

          <dl className="mt-6 grid max-w-xl grid-cols-3 gap-x-6 rounded-xl border border-line bg-surface p-4 text-sm shadow-xs sm:p-5">
            <div>
              <dt className="text-ink-400">Tajriba</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">
                {teacher.experienceYears} yil
              </dd>
            </div>
            <div>
              <dt className="text-ink-400">O‘quvchilar</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">
                {formatCount(teacher.students)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-400">Kurslar</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">
                {own.length > 0 ? (
                  <>
                    {own.length} ta
                    {minPriceUzs !== null && minPriceUzs > 0 ? (
                      <span className="font-normal text-ink-500">
                        {" "}
                        · {formatPrice(minPriceUzs)}dan
                      </span>
                    ) : minPriceUzs === 0 ? (
                      <span className="font-normal text-ink-500"> · bepul variantlar</span>
                    ) : null}
                  </>
                ) : (
                  "Hozircha yo‘q"
                )}
              </dd>
            </div>
          </dl>

          {own.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2.5">
              <ButtonLink href="#teacher-courses" variant="primary">
                Kurslarini ko‘rish ({own.length})
              </ButtonLink>
              <ButtonLink
                href="/teachers"
                variant="outline"
                className={cn(focusRing)}
              >
                Boshqa ustozlarni ko‘rish
              </ButtonLink>
            </div>
          ) : (
            <p className="mt-6 max-w-md text-sm text-ink-500">
              Ustoz hozircha ochiq kurs ro‘yxatiga ega emas — xabar almashinuvi va
              shaxsiy yozilish imkoniyati keyingi bosqichlarda ishga tushadi.
            </p>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------------- */}
      {/* Sections                                                          */}
      {/* --------------------------------------------------------------- */}
      <div className="mt-14 space-y-14 md:mt-16 md:space-y-16">
        <section>
          <SectionHeader title="Ustoz haqida" as="h2" />
          <div className="max-w-3xl space-y-5 text-lg leading-relaxed text-ink-700">
            <p>{teacher.bio}</p>
            <div>
              <h3 className="text-base font-semibold text-ink-900">O‘qitish uslubi</h3>
              <p className="mt-1.5">{teacher.detail.approach}</p>
            </div>
          </div>
        </section>

        <section id="teacher-courses" className="scroll-mt-[calc(var(--height-header)+1.5rem)]">
          <SectionHeader
            title="Faol kurslari"
            description="Kurs sahifasida dastur, guruhlar va yozilish bo‘limini ko‘rasiz."
            as="h2"
          />
          {own.length > 0 ? (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {own.map((course) => (
                <li key={course.id} className="flex">
                  <CourseCard course={course} className="w-full" />
                </li>
              ))}
            </ul>
          ) : (
            <Card
              variant="quiet"
              className="flex flex-col items-center gap-3 px-6 py-12 text-center"
            >
              <p className="text-base font-medium text-ink-900">
                Bu ustozda hozircha ochiq kurs yo‘q
              </p>
              <p className="max-w-md text-sm text-ink-500">
                Kurs ochilganda shu sahifada ko‘rinadi. Shu yo‘nalishdagi boshqa
                takliflarni katalogdan ko‘rishingiz mumkin.
              </p>
              <ButtonLink href="/courses" variant="outline" size="sm">
                Kurslarga o‘tish
              </ButtonLink>
            </Card>
          )}
        </section>

        <section>
          <SectionHeader
            title="O‘quvchilar fikri"
            description="Bu bo‘limda ustoz kurslari bo‘yicha yozilgan tasdiqlangan fikrlar keltiriladi."
            as="h2"
          />
          <div className="max-w-3xl">
            <TeacherReviews reviews={reviews} totalReviews={teacher.reviews} />
          </div>
        </section>

        <section>
          <SectionHeader title="Savol-javob" as="h2" />
          <dl className="max-w-3xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {faq.map((item) => (
              <details key={item.q} className="group/faq px-4 sm:px-5">
                <summary
                  className={
                    "flex cursor-pointer list-none items-center justify-between gap-4 py-4 " +
                    "text-base font-medium text-ink-900 [&::-webkit-details-marker]:hidden"
                  }
                >
                  {item.q}
                </summary>
                <p className="-mt-1 pb-4 pe-8 text-sm text-ink-700">{item.a}</p>
              </details>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
