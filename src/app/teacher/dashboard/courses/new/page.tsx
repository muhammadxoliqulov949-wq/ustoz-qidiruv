import type { Metadata } from "next";
import { categories } from "@/data/categories";
import { onboardingCities } from "@/lib/onboarding";
import { NewCourseForm } from "@/components/teacher-dashboard/new-course-form";
import { requireRolePage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Yangi kurs" };

export const dynamic = "force-dynamic";

/* /teacher/dashboard/courses/new — Phase 12.
 *
 * Creates ONE server-side draft owned by the signed-in teacher, then redirects
 * to its stable edit route so a refresh resumes that row instead of creating
 * another. The draft is private: it is stored with status 'draft' and the
 * public queries never select it, so filling it in completely does not publish
 * it. Course management stays inside the dashboard; no public dynamic route is
 * added. */
export default async function NewCoursePage() {
  await requireRolePage("teacher", "/teacher/dashboard/courses/new");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Yangi kurs qoralamasi
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Qoralama hisobingizga bog‘lanib serverda saqlanadi. U katalogda
          ko‘rinmaydi — to‘liq to‘ldirilgani uni avtomatik e’lon qilmaydi.
        </p>
      </header>
      <NewCourseForm
        categories={categories.map(({ id, name }) => ({ id, name }))}
        cities={[...onboardingCities]}
      />
    </div>
  );
}
