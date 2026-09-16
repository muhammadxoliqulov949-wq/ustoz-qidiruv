"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, X } from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "./empty-state";
import { useStudentState } from "./use-student-state";
import type { DashCatalog, DashCourseLite, DashTeacherLite } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* Saved panel — rows DERIVED from the canonical catalog projection plus the     */
/* saved ID list (components/saved/saved-store.ts). No course or teacher fact    */
/* is stored in saved state, so nothing here can drift from the dataset.         */
/* Unsaving writes to the SAME store the marketplace SaveButton uses.            */
/* -------------------------------------------------------------------------- */

function SavedCourseRow({
  course,
  onRemove,
}: {
  course: DashCourseLite;
  onRemove: () => void;
}) {
  return (
    <Card variant="interactive" padded={false} className="relative flex gap-4 p-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:size-24">
        {course.image ? (
          <Image
            src={course.image}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base leading-snug font-semibold text-ink-900">
          <Link
            href={`/courses/${course.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            <span className="line-clamp-2">{course.title}</span>
          </Link>
        </h3>
        <p className="truncate text-sm text-ink-700">{course.teacherName}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
          <Badge variant="neutral">{course.formatLabel}</Badge>
          {course.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{course.location}</span>
            </span>
          ) : null}
        </div>
        <p className="mt-auto text-base font-semibold text-ink-900">
          {course.priceSummary}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        leadingIcon={<X aria-hidden="true" />}
        className="z-10 self-start"
      >
        <span className="max-sm:sr-only">Olib tashlash</span>
        <span className="sr-only sm:hidden">
          Saqlanganlardan olib tashlash: {course.title}
        </span>
      </Button>
    </Card>
  );
}

function SavedTeacherRow({
  teacher,
  onRemove,
}: {
  teacher: DashTeacherLite;
  onRemove: () => void;
}) {
  return (
    <Card variant="interactive" padded={false} className="relative flex gap-4 p-4">
      <Avatar name={teacher.name} src={teacher.photo} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink-900">
          <Link
            href={`/teachers/${teacher.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            {teacher.name}
          </Link>
          {teacher.verified ? (
            <>
              <BadgeCheck aria-hidden="true" className="size-4 text-accent-600" />
              <span className="sr-only">Tasdiqlangan ustoz</span>
            </>
          ) : null}
        </h3>
        <p className="truncate text-sm text-ink-700">{teacher.specialization}</p>
        <p className="text-sm text-ink-500">
          {teacher.activeCourses} ta faol kurs
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        leadingIcon={<X aria-hidden="true" />}
        className="z-10 self-start"
      >
        <span className="max-sm:sr-only">Olib tashlash</span>
        <span className="sr-only sm:hidden">
          Saqlanganlardan olib tashlash: {teacher.name}
        </span>
      </Button>
    </Card>
  );
}

export function SavedPanel({ catalog }: { catalog: DashCatalog }) {
  const { ready, courses, teachers, toggleSavedCourse, toggleSavedTeacher } =
    useStudentState(catalog);

  if (!ready) {
    // Pre-hydration: real section headings stay in the document; only the
    // lists (which depend on browser state) wait.
    return (
      <div className="flex min-h-[28rem] flex-col gap-8">
        <section aria-labelledby="saved-courses">
          <h2 id="saved-courses" className="text-xl font-semibold text-ink-900">
            Saqlangan kurslar
          </h2>
          <p className="mt-2 text-base text-ink-500" role="status">
            Brauzer holati o‘qilmoqda…
          </p>
        </section>
        <section aria-labelledby="saved-teachers">
          <h2 id="saved-teachers" className="text-xl font-semibold text-ink-900">
            Saqlangan ustozlar
          </h2>
        </section>
      </div>
    );
  }

  if (courses.length === 0 && teachers.length === 0) {
    return (
      <EmptyState title="Saqlangan narsa yo‘q" as="h2">
        Kurs yoki ustoz kartochkasidagi yurakcha tugmasi ularni shu ro‘yxatga
        qo‘shadi. Hozircha ro‘yxat bo‘sh.
        <p className="mt-3 flex flex-wrap justify-center gap-4">
          <Link
            href="/courses"
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            Kurslarni ko‘rish
          </Link>
          <Link
            href="/teachers"
            className="font-medium text-accent-700 underline underline-offset-2"
          >
            Ustozlarni ko‘rish
          </Link>
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthNotice title="Saqlanganlar shu brauzerda turadi">
        Saqlanganlar ro‘yxati hozircha hisobingizga bog‘lanmagan: u faqat shu
        qurilma va brauzer xotirasida saqlanadi — boshqa qurilmada ko‘rinmaydi
        va brauzer ma’lumotlari tozalansa yo‘qoladi.
      </AuthNotice>

      <section aria-labelledby="saved-courses" className="flex flex-col gap-4">
        <h2 id="saved-courses" className="text-xl font-semibold text-ink-900">
          Saqlangan kurslar{" "}
          <span className="text-base font-normal text-ink-500">
            ({courses.length})
          </span>
        </h2>
        {courses.length === 0 ? (
          <EmptyState title="Saqlangan kurs yo‘q">
            Kurs kartochkasidagi yurakcha tugmasi orqali qo‘shasiz.
            <p className="mt-3">
              <Link
                href="/courses"
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                Kurslarni ko‘rish
              </Link>
            </p>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {courses.map((course) => (
              <li key={course.id}>
                <SavedCourseRow
                  course={course}
                  onRemove={() => toggleSavedCourse(course.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="saved-teachers" className="flex flex-col gap-4">
        <h2 id="saved-teachers" className="text-xl font-semibold text-ink-900">
          Saqlangan ustozlar{" "}
          <span className="text-base font-normal text-ink-500">
            ({teachers.length})
          </span>
        </h2>
        {teachers.length === 0 ? (
          <EmptyState title="Saqlangan ustoz yo‘q">
            Ustoz kartochkasidagi yurakcha tugmasi orqali qo‘shasiz.
            <p className="mt-3">
              <Link
                href="/teachers"
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                Ustozlarni ko‘rish
              </Link>
            </p>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <SavedTeacherRow
                  teacher={teacher}
                  onRemove={() => toggleSavedTeacher(teacher.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
