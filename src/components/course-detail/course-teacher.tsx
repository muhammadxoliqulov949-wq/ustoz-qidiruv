import Image from "next/image";
import { ArrowRight, Globe, Star } from "lucide-react";
import type { Course, Teacher } from "@/data/models";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { VerifiedMark } from "@/components/ui/rating";
import { formatCount } from "@/lib/format";
import { teacherById } from "@/data/teachers";

/**
 * Teacher block on the detail page — richer than the marketplace card:
 * portrait, identity + verification, one-paragraph bio, and only the
 * numbers the platform actually stores (rating, students, experience,
 * languages). The profile route (/teachers/[slug]) is a clearly deferred
 * later phase: the link is kept (with an honest title) so the seam is
 * visible, not faked.
 */
export function CourseTeacher({ course }: { course: Course }) {
  const teacher: Teacher | undefined = teacherById.get(course.teacher.id);

  if (!teacher) {
    // Defensive fallback — the listing-level identity we always have.
    return (
      <div className="flex items-center gap-3">
        <Avatar name={course.teacher.name} size="lg" />
        <div>
          <p className="text-lg font-semibold text-ink-900">
            {course.teacher.name}
            {course.teacher.verified ? (
              <VerifiedMark className="ms-2 align-[-3px]" />
            ) : null}
          </p>
          <p className="text-sm text-ink-500">Ustoz profili tayyorlanmoqda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs sm:grid sm:grid-cols-[15rem_1fr]">
      <div className="relative aspect-[4/5] sm:aspect-auto">
        {teacher.photo ? (
          <Image
            src={teacher.photo}
            alt={`${teacher.name} — ustoz`}
            fill
            sizes="(min-width: 640px) 240px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center bg-accent-50">
            <Avatar name={teacher.name} size="xl" />
          </div>
        )}
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-2xl font-semibold text-ink-900">{teacher.name}</h3>
          {teacher.verified ? <VerifiedMark /> : null}
        </div>
        <p className="mt-0.5 text-sm text-ink-500">{teacher.specialization}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-400">Reyting</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 font-semibold text-ink-900">
              <Star className="size-3.5 fill-rating text-rating stroke-0" aria-hidden="true" />
              {teacher.rating.toFixed(1)}
              <span className="font-normal text-ink-400">
                ({formatCount(teacher.reviews)})
              </span>
            </dd>
          </div>
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
            <dt className="text-ink-400">Tillar</dt>
            <dd className="mt-0.5 inline-flex items-start gap-1 font-semibold text-ink-900">
              <Globe className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
              {teacher.languages.join(", ")}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-base text-ink-700">{teacher.bio}</p>

        <ButtonLink
          href={`/teachers/${teacher.slug}`}
          variant="outline"
          className="mt-5"
        >
          Ustoz profilini ko‘rish
          <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  );
}
