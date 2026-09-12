"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, Users } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WorkspaceGate } from "./workspace-gate";
import type { TeacherCourseLite, TeacherDirectory } from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* Kurslarim — the teacher's OWN courses, resolved through the canonical        */
/* course.teacher.id relationship (data/teacher-dashboard.ts). No course record  */
/* is duplicated here; every field is a display string from that projection.     */
/* Card/list layout (not a wide table) so 390px stays readable.                  */
/* Read-only by design: create/edit/delete belong to Phase 10.                   */
/* -------------------------------------------------------------------------- */

function CourseItem({ course }: { course: TeacherCourseLite }) {
  const openSeats = course.groups.reduce(
    (sum, group) => sum + Math.max(0, group.seatsRemaining),
    0,
  );
  const capacity = course.groups.reduce((sum, group) => sum + group.capacity, 0);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:size-24">
          {course.image ? (
            <Image src={course.image} alt="" fill sizes="96px" className="object-cover" />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-base leading-snug font-semibold text-ink-900">
            <Link
              href={`/courses/${course.slug}`}
              className="underline-offset-2 hover:underline"
            >
              {course.title}
            </Link>
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <Badge variant="neutral">{course.formatLabel}</Badge>
            <Badge variant="neutral">{course.levelLabel}</Badge>
            {/* “Public” status is derived: a catalog entry IS the published state. */}
            <Badge variant="success">Katalogda e’lon qilingan</Badge>
            {course.location ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{course.location}</span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden="true" className="size-3.5 shrink-0" />
              {course.reviews > 0 ? `${course.rating.toFixed(1)} · ${course.reviews} izoh` : "Izoh yo‘q"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden="true" className="size-3.5 shrink-0" />
              {course.students} o‘quvchi
            </span>
            <span>E’lon: {course.publishedAtLabel}</span>
          </div>

          <p className="text-base font-semibold text-ink-900">{course.priceSummary}</p>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h4 className="text-sm font-semibold text-ink-900">
          Guruhlar{" "}
          <span className="font-normal text-ink-500">
            ({course.groups.length} ta · {openSeats}/{capacity} joy bo‘sh)
          </span>
        </h4>
        {course.groups.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Bu kursda jadval guruhi ko‘rsatilmagan.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {course.groups.map((group) => {
              const full = group.seatsRemaining <= 0;
              return (
                <li
                  key={group.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-surface-muted px-3 py-2"
                >
                  <span className="text-sm font-medium text-ink-900">
                    {group.title}
                    <span className="ms-2 font-normal text-ink-700">
                      {group.days.join(", ")} · soat {group.startTime}
                    </span>
                  </span>
                  <span className="text-sm text-ink-500">
                    {group.startDateLabel} ·{" "}
                    <span className={full ? "font-medium text-ink-900" : undefined}>
                      {full
                        ? "Joy qolmagan"
                        : `${group.seatsRemaining}/${group.capacity} joy bo‘sh`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/courses/${course.slug}`} variant="outline" size="sm">
          Ommaviy sahifa
        </ButtonLink>
      </div>
    </Card>
  );
}

export function TeacherCoursesPanel({ directory }: { directory: TeacherDirectory }) {
  return (
    <WorkspaceGate directory={directory} heading="Kurslarim" minHeight="min-h-[40rem]">
      {(workspace) => (
        <div className="flex flex-col gap-6">
          <AuthNotice title="Kurslarni tahrirlash hali yo‘q">
            Quyidagi ro‘yxat katalogdagi haqiqiy kurslaringizdan olinadi. Kurs
            yaratish, tahrirlash va o‘chirish keyingi bosqichda qo‘shiladi —
            hozircha panel faqat ko‘rish uchun.
          </AuthNotice>

          <section aria-labelledby="tw-courses" className="flex flex-col gap-4">
            <h2 id="tw-courses" className="text-xl font-semibold text-ink-900">
              Kurslarim{" "}
              <span className="text-base font-normal text-ink-500">
                ({workspace.courses.length})
              </span>
            </h2>

            {workspace.courses.length === 0 ? (
              <EmptyState title="Katalogda kursingiz yo‘q">
                Bu ustoz profiliga bog‘langan e’lon qilingan kurs topilmadi.
                Kurs qo‘shish oqimi keyingi bosqichda ishga tushadi.
                <p className="mt-3">
                  <Link
                    href={`/teachers/${workspace.slug}`}
                    className="font-medium text-accent-700 underline underline-offset-2"
                  >
                    Ommaviy profilni ko‘rish
                  </Link>
                </p>
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-4">
                {workspace.courses.map((course) => (
                  <li key={course.id}>
                    <CourseItem course={course} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </WorkspaceGate>
  );
}
