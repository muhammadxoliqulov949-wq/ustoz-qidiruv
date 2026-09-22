import { ArrowRight, SearchX } from "lucide-react";
import { ButtonLink, Card, CourseCard, SectionHeader } from "@/components/ui";
import { Section } from "@/components/layout/section";
import type { Course } from "@/data/models";

export interface RecommendedCoursesProps {
  courses: Course[];
}

export function RecommendedCourses({ courses }: RecommendedCoursesProps) {
  return (
    <Section ariaLabelledby="recommended-courses-title">
      <div className="depth-quiet mb-6 rounded-2xl p-[1px]">
        <div className="rounded-2xl bg-canvas/40 px-5 py-4 backdrop-blur-sm md:px-6">
          <SectionHeader
            eyebrow="SIZ UCHUN"
            title={
              <span id="recommended-courses-title">
                Siz uchun <span className="text-gradient">tavsiya etiladigan</span> kurslar
              </span>
            }
            description="Maqsad va qiziqishlaringizga mos eng yaxshi kurslarni biz siz uchun saralab berdik."
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Oldingi"
                  className="grid size-9 place-items-center rounded-full border border-white/12 bg-white/6 text-ink-400 hover:bg-white/10"
                >
                  <ArrowRight className="size-4 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Keyingi"
                  className="grid size-9 place-items-center rounded-full border border-amber-400/30 bg-amber-500 text-amber-950 shadow-md"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            }
          />
        </div>
      </div>

      {courses.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course, idx) => (
              <li key={course.id} className="flex">
                <CourseCard course={course} className="w-full" featured={idx === 0} priority={idx === 0} />
              </li>
            ))}
          </ul>

          {/* bottom stats like reference */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/8 pt-6 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-400">👥</span>
              <div>
                <p className="text-sm font-bold text-ink-900">10,000+</p>
                <p className="text-xs text-ink-500">Talabalar allaqachon o&apos;z yo&apos;lini topdi</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-400">💎</span>
              <div>
                <p className="text-sm font-bold text-ink-900">Sifatli va amaliy kurslar</p>
                <p className="text-xs text-ink-500">Nazariya emas, natija muhim</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-400">📈</span>
              <div>
                <p className="text-sm font-bold text-ink-900">Doim yangilanib boradigan kontent</p>
                <p className="text-xs text-ink-500">Zamonaviy bilimlar, real imkoniyatlar</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-400">🛡️</span>
              <div>
                <p className="text-sm font-bold text-ink-900">Ishonchli ustozlar</p>
                <p className="text-xs text-ink-500">O&apos;z sohasining mutaxassislari</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <Card variant="quiet" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span aria-hidden="true" className="grid size-12 place-items-center rounded-pill bg-surface text-ink-400 shadow-xs [&>svg]:size-6 [&>svg]:stroke-[1.75]">
            <SearchX />
          </span>
          <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">Hozircha kurslar e&apos;lon qilinmagan</h3>
          <p className="max-w-md text-base text-pretty text-ink-500">Yangi kurslar joylashtirilishi bilan ular shu yerda ko&apos;rinadi.</p>
        </Card>
      )}

      <div className="mt-6 flex justify-end">
        <ButtonLink href="/courses" variant="ghost" size="sm" trailingIcon={<ArrowRight className="size-4" />}>
          Barcha kurslar
        </ButtonLink>
      </div>
    </Section>
  );
}
