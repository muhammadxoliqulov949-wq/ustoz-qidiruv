import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Rating, VerifiedMark } from "@/components/ui/rating";
import { SectionHeader } from "@/components/ui/section-header";
import { CourseFaq } from "@/components/course-detail/course-faq";
import { CourseGroups } from "@/components/course-detail/course-groups";
import { CourseReviews } from "@/components/course-detail/course-reviews";
import { CourseSyllabus } from "@/components/course-detail/course-syllabus";
import { CourseTeacher } from "@/components/course-detail/course-teacher";
import { EnrollmentCard } from "@/components/course-detail/enrollment-card";
import { SectionNav, type CourseSection } from "@/components/course-detail/section-nav";
import { categories } from "@/data/categories";
import { courseFormatLabels, courseLevelLabels } from "@/data/courses";
import { formatCount } from "@/lib/format";
import { getPublicCourseBySlug, getPublicTeacherById } from "@/server/public-repo";
import { cn, focusRing } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* /courses/[slug] — the evaluation page (Phase 4 UX, Phase 12 data source).   */
/*                                                                              */
/* The course, its groups and its ordered syllabus are loaded from PostgreSQL  */
/* by getPublicCourseBySlug(), which only ever returns PUBLISHED courses, so a */
/* draft URL 404s exactly like an unknown slug — drafts are not merely hidden. */
/*                                                                              */
/* RENDERING: dynamic SSR. Group availability is derived from live enrollment  */
/* rows, and a course can be edited or unpublished at any time, so caching a   */
/* build-time snapshot would show stale schedules and seat counts.             */
/* There is deliberately NO build-time slug enumeration (no                  */
/* generateStaticParams): the database is runtime state, so `npm run build`  */
/* must not depend on it. Unknown, unpublished or draft slugs 404 at         */
/* request time via the published-only repository layer.                     */
/*                                                                              */
/* Client islands are unchanged: section nav, group picker, enroll dialog.     */
/* Group selection remains URL state (`?group=`).                              */
/* -------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const SECTIONS: CourseSection[] = [
  { id: "about", label: "Kurs haqida" },
  { id: "program", label: "Dastur" },
  { id: "schedule", label: "Jadval va guruhlar" },
  { id: "teacher", label: "Ustoz" },
  { id: "reviews", label: "Fikrlar" },
  { id: "faq", label: "Savol-javob" },
];

/** Anchor targets clear the sticky header + section-nav strip (72 + ~52px). */
const ANCHOR = "scroll-mt-[9.5rem] lg:scroll-mt-[8.5rem]";

const categoryById = new Map(categories.map((category) => [category.id, category]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublicCourseBySlug(slug);
  if (!course) return { title: "Kurs topilmadi" };
  const category = categoryById.get(course.categoryId);
  return {
    title: course.title,
    description: `${course.detail.summary}${category ? ` (${category.name}).` : ""}`,
    alternates: { canonical: `/courses/${course.slug}` },
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const course = await getPublicCourseBySlug(slug);
  if (!course) notFound();

  const { detail } = course;
  const groups = detail.groups;
  const requestedGroup =
    typeof query.group === "string"
      ? groups.find((group) => group.id === query.group)
      : undefined;
  // Default: the first group that actually has seats (never a full one).
  const group =
    requestedGroup ??
    groups.find((candidate) => candidate.seatsRemaining > 0) ??
    groups[0];
  if (!group) notFound(); // defensive — every course has ≥1 group

  const category = categoryById.get(course.categoryId);
  const teacher = await getPublicTeacherById(course.teacher.id);

  return (
    <>
      <div className="site-container pb-24 pt-8 lg:pb-16 lg:pt-12">
        {/* Breadcrumb — spans the container, above the two columns */}
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
                href="/courses"
                className="transition-colors duration-fast hover:text-ink-900"
              >
                Kurslar
              </Link>
            </li>
            {category ? (
              <>
                <ChevronRight aria-hidden="true" className="size-3.5 text-ink-300" />
                <li>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="transition-colors duration-fast hover:text-ink-900"
                  >
                    {category.name}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        {/*
          One grid for the whole page: left column carries hero + sections,
          the right column carries the enrollment rail. Keeping the rail in
          the same grid row is what lets `lg:sticky` pin for the entire page
          (a rail inside a hero-only grid would scroll out after the hero).
        */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-12 xl:gap-16">
          {/* ------------------------------------------------------------ */}
          {/* Left column: identity + media + sections                     */}
          {/* ------------------------------------------------------------ */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{courseFormatLabels[course.format]}</Badge>
              {course.location && course.format !== "online" ? (
                <span className="inline-flex min-w-0 items-center gap-1 text-sm text-ink-500">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{course.location}</span>
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.015em] text-balance text-ink-900 md:text-4xl">
              {course.title}
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-ink-700">{detail.summary}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Rating value={course.rating} reviews={course.reviews} />
              <span className="text-sm text-ink-500">
                {formatCount(course.students)} nafar o‘quvchi
              </span>
              {teacher ? (
                <Link
                  href={`/teachers/${teacher.slug}`}
                  className={cn(
                    "inline-flex items-center gap-2.5 rounded-pill py-1 pe-1",
                    "transition-colors duration-fast hover:text-accent-700",
                    focusRing,
                  )}
                >
                  <Avatar name={teacher.name} src={teacher.photo} size="sm" />
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900">
                    {teacher.name}
                    {teacher.verified ? <VerifiedMark /> : null}
                  </span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-ink-900">
                  <Avatar name={course.teacher.name} size="sm" />
                  {course.teacher.name}
                  {course.teacher.verified ? <VerifiedMark /> : null}
                </span>
              )}
            </div>

            {course.image ? (
              <div className="relative mt-7 aspect-[16/9] w-full overflow-hidden rounded-xl border border-line bg-surface-muted sm:aspect-[2/1]">
                <Image
                  src={course.image}
                  alt={`${course.title} — kurs muhiti`}
                  fill
                  priority
                  sizes="(min-width: 64rem) 720px, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="mt-10 lg:mt-12">
              <SectionNav sections={SECTIONS} />
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Sections                                                    */}
            {/* ---------------------------------------------------------- */}
            <div className="space-y-14 pt-10 pb-4 md:space-y-16 md:pt-14">
              <section id="about" className={ANCHOR}>
                <SectionHeader title="Kurs haqida" as="h2" />
                <p className="max-w-3xl text-lg leading-relaxed text-ink-700">
                  {detail.longDescription}
                </p>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="text-base font-semibold text-ink-900">
                      Kimlar uchun
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {detail.audience.map((item) => (
                        <li key={item} className="flex gap-2.5 text-base text-ink-700">
                          <span
                            aria-hidden="true"
                            className="mt-[0.55rem] size-1.5 shrink-0 rounded-pill bg-accent-600"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-ink-900">
                      Nimalarni o‘rganasiz
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {detail.learningOutcomes.map((item) => (
                        <li key={item} className="flex gap-2.5 text-base text-ink-700">
                          <span
                            aria-hidden="true"
                            className="mt-[0.55rem] size-1.5 shrink-0 rounded-pill bg-accent-600"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-5 text-sm shadow-xs sm:grid-cols-4 sm:p-6">
                  <div>
                    <dt className="text-ink-400">Daraja</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {courseLevelLabels[course.level]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Format</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {courseFormatLabels[course.format]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Joylashuv</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {course.location ?? "Masofaviy"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">O‘quv tili</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {detail.teachingLanguages.join(", ")}
                    </dd>
                  </div>
                </dl>
              </section>

              <section id="program" className={ANCHOR}>
                <SectionHeader
                  title="Dastur"
                  description="Modullar ketma-ketligi — tanishish uchun; darslarni ko‘rish imkoniyati LMS bilan birga keladi."
                  as="h2"
                />
                <CourseSyllabus course={course} />
              </section>

              <section id="schedule" className={ANCHOR}>
                <SectionHeader
                  title="Jadval va guruhlar"
                  description="Guruhni tanlang — yozilish kartasi shunga mos yangilanadi."
                  as="h2"
                />
                <CourseGroups
                  basePath={`/courses/${course.slug}`}
                  groups={groups}
                  selectedGroupId={group.id}
                />
                <p className="mt-3 text-sm text-ink-500">
                  Bo‘sh joylar soni guruh sig‘imidan yuborilgan so‘rovlar ayirilib
                  hisoblanadi; yakuniy bandlikni ustoz tasdiqlaydi.
                </p>
              </section>

              <section id="teacher" className={ANCHOR}>
                <SectionHeader title="Ustoz" as="h2" />
                <CourseTeacher course={course} teacher={teacher} />
              </section>

              <section id="reviews" className={ANCHOR}>
                <SectionHeader
                  title="Fikrlar"
                  description="Sahifada faqat haqiqatan yozilgan fikrlar keltiriladi — sonlar sun’iy ko‘paytirilmaydi."
                  as="h2"
                />
                <CourseReviews course={course} />
              </section>

              <section id="faq" className={ANCHOR}>
                <SectionHeader title="Savol-javob" as="h2" />
                <CourseFaq course={course} />
              </section>
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Right column: enrollment rail — sticky, capped, internal      */}
          {/* scroll on tall viewports (same recipe as the Phase 3 sidebar). */}
          {/* ------------------------------------------------------------ */}
          <div className="hidden lg:sticky lg:top-[calc(var(--height-header)+1.5rem)] lg:block lg:max-h-[calc(100dvh-var(--height-header)-3rem)] lg:self-start lg:overflow-y-auto">
            <EnrollmentCard course={course} group={group} />
          </div>
        </div>
      </div>

      {/* Mobile sticky enrollment bar (hidden on desktop where the rail is). */}
      <div className="lg:hidden">
        <EnrollmentCard course={course} group={group} variant="bar" />
      </div>
    </>
  );
}
