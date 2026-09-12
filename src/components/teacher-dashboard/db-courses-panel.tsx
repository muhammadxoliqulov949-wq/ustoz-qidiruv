import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { courseFormatLabels, courseLevelLabels } from "@/data/courses";
import { formatPrice } from "@/lib/format";
import { CopyCourseButton } from "./copy-course-button";

/* -------------------------------------------------------------------------- */
/* Kurslarim — Phase 12 PRIMARY experience, rendered on the SERVER from the     */
/* database using the signed-in teacher's session id.                           */
/*                                                                              */
/* There is no localStorage in this path: the list is what the database says    */
/* this account owns. Published courses and private drafts are shown as two     */
/* clearly separated groups so the teacher can never mistake a draft for a live */
/* listing — the draft group states in words that it is not public.             */
/* -------------------------------------------------------------------------- */

export interface DashboardGroup {
  id: string;
  title: string;
  days: string[];
  startTime: string;
  endTime: string | null;
  capacity: number;
  startDate: string;
}

export interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  status: string;
  format: "online" | "offline" | "hybrid";
  level: "boshlangich" | "orta" | "yuqori";
  priceUzs: number;
  city: string | null;
  location: string | null;
  summary: string;
  groups: DashboardGroup[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Qoralama",
  ready: "Ko‘rib chiqishga tayyor",
  published: "Katalogda e’lon qilingan",
};

function CourseItem({ course }: { course: DashboardCourse }) {
  const isPublic = course.status === "published";
  const seats = course.groups.reduce((sum, group) => sum + group.capacity, 0);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-base leading-snug font-semibold text-ink-900">{course.title}</h3>

        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <Badge variant="neutral">{courseFormatLabels[course.format]}</Badge>
          <Badge variant="neutral">{courseLevelLabels[course.level]}</Badge>
          <Badge variant={isPublic ? "success" : "neutral"}>
            {STATUS_LABEL[course.status] ?? course.status}
          </Badge>
          {course.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{course.location}</span>
            </span>
          ) : null}
        </div>

        <p className="text-sm text-ink-500">{course.summary}</p>

        <p className="text-sm text-ink-500">
          {course.priceUzs === 0 ? "Bepul" : `${formatPrice(course.priceUzs)} / oyiga`}
          {course.groups.length > 0 ? (
            <>
              {" · "}
              {course.groups.length} ta guruh · jami {seats} o‘rin rejalashtirilgan
            </>
          ) : (
            " · guruh qo‘shilmagan"
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isPublic ? (
          <ButtonLink href={`/courses/${course.slug}`} variant="outline" size="sm">
            Ko‘rish (ommaviy sahifa)
          </ButtonLink>
        ) : null}
        <ButtonLink
          href={`/teacher/dashboard/courses/${course.id}/edit`}
          variant="outline"
          size="sm"
        >
          Tahrirlash
        </ButtonLink>
        <CopyCourseButton courseId={course.id} />
      </div>
    </Card>
  );
}

export function DbCoursesPanel({
  published,
  drafts,
  teacherSlug,
}: {
  published: DashboardCourse[];
  drafts: DashboardCourse[];
  teacherSlug: string | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="db-courses" className="flex flex-col gap-4">
        <h2 id="db-courses" className="text-xl font-semibold text-ink-900">
          Katalogdagi kurslarim{" "}
          <span className="text-base font-normal text-ink-500">({published.length})</span>
        </h2>

        {published.length === 0 ? (
          <EmptyState title="Katalogda kursingiz yo‘q">
            Bu hisobga bog‘langan e’lon qilingan kurs topilmadi. Quyida qoralama
            yaratib, uni ko‘rib chiqishga tayyorlashingiz mumkin.
            {teacherSlug ? (
              <p className="mt-3">
                <Link
                  href={`/teachers/${teacherSlug}`}
                  className="font-medium text-accent-700 underline underline-offset-2"
                >
                  Ommaviy profilni ko‘rish
                </Link>
              </p>
            ) : null}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {published.map((course) => (
              <li key={course.id}>
                <CourseItem course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="db-drafts" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="db-drafts" className="text-xl font-semibold text-ink-900">
            Serverdagi qoralamalarim{" "}
            <span className="text-base font-normal text-ink-500">({drafts.length})</span>
          </h2>
          <ButtonLink href="/teacher/dashboard/courses/new" size="sm">
            Yangi kurs qoralamasi
          </ButtonLink>
        </div>

        <p className="text-sm text-ink-500">
          Qoralamalar hisobingizga bog‘langan holda serverda saqlanadi va
          brauzerni yopsangiz ham yo‘qolmaydi. Qoralama to‘liq bo‘lsa ham
          katalogda ko‘rinmaydi — e’lon qilish alohida bosqich.
        </p>

        {drafts.length === 0 ? (
          <EmptyState title="Qoralama yo‘q">
            Hali server qoralamasi yaratmagansiz.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {drafts.map((course) => (
              <li key={course.id}>
                <CourseItem course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
