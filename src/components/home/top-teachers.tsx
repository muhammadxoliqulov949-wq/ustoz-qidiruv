import { ArrowRight, Users } from "lucide-react";
import { ButtonLink, Card, SectionHeader, TeacherCard } from "@/components/ui";
import { Section } from "@/components/layout/section";
import type { Teacher } from "@/data/models";

/* -------------------------------------------------------------------------- */
/* “Eng yaxshi ustozlar”.                                                      */
/* 1 col mobile → 2 tablet/desktop → 4 on xl. Rows stay balanced at             */
/* every breakpoint (2+2 / 4), which is why lg deliberately keeps 2 cols.       */
/*                                                                              */
/* DATA: public teacher profiles read at request time from the runtime          */
/* repository. A teacher reaches this row only when their profile is public AND */
/* they own at least one published course — the same rule /teachers applies —   */
/* so every `/teachers/[slug]` link here resolves to a real profile page.       */
/* Verification badges and “N ta kurs” come from stored/derived values, never   */
/* from a curated fixture list.                                                 */
/*                                                                              */
/* An empty roster renders the honest empty state instead of placeholder        */
/* portraits.                                                                   */
/* -------------------------------------------------------------------------- */

export interface TopTeachersProps {
  /** Public teachers from the runtime repository, already ordered and capped. */
  teachers: Teacher[];
}

export function TopTeachers({ teachers }: TopTeachersProps) {
  return (
    <Section ariaLabelledby="top-teachers-title">
      <SectionHeader
        title={<span id="top-teachers-title">Eng yaxshi ustozlar</span>}
        description="Tajribali o‘qituvchilar — reytinglari va faol kurslari bilan."
        action={
          <ButtonLink
            href="/teachers"
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Barcha ustozlar
          </ButtonLink>
        }
      />

      {teachers.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="flex">
              <TeacherCard teacher={teacher} className="w-full" />
            </li>
          ))}
        </ul>
      ) : (
        /* No public teacher with a published course yet — say so plainly. */
        <Card
          variant="quiet"
          className="flex flex-col items-center gap-3 px-6 py-14 text-center"
        >
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-pill bg-surface text-ink-400 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]"
          >
            <Users />
          </span>
          <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">
            Hozircha ustozlar ro‘yxati bo‘sh
          </h3>
          <p className="max-w-md text-base text-pretty text-ink-500">
            Ommaviy profilini ochgan va kurs e’lon qilgan ustozlar shu yerda
            ko‘rinadi.
          </p>
        </Card>
      )}
    </Section>
  );
}
