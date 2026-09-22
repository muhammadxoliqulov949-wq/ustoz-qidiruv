import { ArrowRight, Users } from "lucide-react";
import { ButtonLink, Card, SectionHeader, TeacherCard } from "@/components/ui";
import { Section } from "@/components/layout/section";
import type { Teacher } from "@/data/models";

export interface TopTeachersProps {
  teachers: Teacher[];
}

export function TopTeachers({ teachers }: TopTeachersProps) {
  return (
    <Section ariaLabelledby="top-teachers-title">
      <div className="depth-quiet mb-6 rounded-2xl p-[1px]">
        <div className="rounded-2xl bg-canvas/40 px-5 py-4 backdrop-blur-sm md:px-6">
          <SectionHeader
            eyebrow="ENG YAXSHILAR"
            title={
              <span id="top-teachers-title">
                Eng yaxshi <span className="text-gradient">ustozlar</span>
              </span>
            }
            description="O'quvchilar tanlovi — tajribali ustozlar, tasdiqlangan reyting, faol darslar."
            action={
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Oldingi" className="grid size-9 place-items-center rounded-full border border-white/12 bg-white/6 text-ink-400">
                  <ArrowRight className="size-4 rotate-180" />
                </button>
                <ButtonLink href="/teachers" variant="outline" size="sm" className="rounded-pill border-amber-400/20 bg-amber-500/10 text-amber-300" trailingIcon={<ArrowRight className="size-4" />}>
                  Barcha ustozlar
                </ButtonLink>
              </div>
            }
          />
        </div>
      </div>

      {teachers.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {teachers.map((teacher, idx) => (
              <li key={teacher.id} className="flex">
                <TeacherCard teacher={teacher} className="w-full" featured={idx === 0} />
              </li>
            ))}
          </ul>

          <div className="mt-7 grid grid-cols-1 gap-4 border-t border-white/8 pt-6 md:grid-cols-3">
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">✓</span>
              Boshlovchilar uchun ham, ilg&apos;orlar uchun ham
            </p>
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">✓</span>
              Tasdiqlangan mutaxassislar, ishonchli metodika
            </p>
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">✓</span>
              Har bir ustoz — o&apos;z yo&apos;nalishining yetakchisi
            </p>
          </div>
        </>
      ) : (
        <Card variant="quiet" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-pill bg-surface text-ink-400 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]">
            <Users />
          </span>
          <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">Hozircha ustozlar ro&apos;yxati bo&apos;sh</h3>
          <p className="max-w-md text-base text-pretty text-ink-500">Ommaviy profilini ochgan va kurs e&apos;lon qilgan ustozlar shu yerda ko&apos;rinadi.</p>
        </Card>
      )}
    </Section>
  );
}
