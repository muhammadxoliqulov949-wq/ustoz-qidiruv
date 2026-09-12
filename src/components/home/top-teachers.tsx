import { ArrowRight } from "lucide-react";
import { ButtonLink, SectionHeader, TeacherCard } from "@/components/ui";
import { Section } from "@/components/layout/section";
import { topTeachers } from "@/data/teachers";

/**
 * “Eng yaxshi ustozlar” — four mock profiles.
 * 1 col mobile → 2 tablet/desktop → 4 on xl. Rows stay balanced at
 * every breakpoint (2+2 / 4), which is why lg deliberately keeps 2 cols.
 */
export function TopTeachers() {
  return (
    <Section ariaLabelledby="top-teachers-title">
      <SectionHeader
        title={<span id="top-teachers-title">Eng yaxshi ustozlar</span>}
        description="Tajribali o‘qituvchilar — reytinglari va faol kurslari bilan."
        action={
          <ButtonLink
            href="/teachers"
            prefetch={false} // teachers browse lands in a later phase
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Barcha ustozlar
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {topTeachers.map((teacher) => (
          <li key={teacher.id} className="flex">
            <TeacherCard teacher={teacher} className="w-full" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
