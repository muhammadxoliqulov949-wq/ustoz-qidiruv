import Link from "next/link";
import { teacherDirectory } from "@/data/teacher-dashboard";
import { demoWorkspaceEnabled } from "@/server/env";
import { TeacherOverviewPanels } from "@/components/teacher-dashboard/overview-panels";
import { requireRolePage } from "@/server/auth/guards";
import {
  getTeacherCapacitySummary,
  getTeacherRequestCounts,
} from "@/server/enrollment-service";
import { cn, focusRing } from "@/lib/utils";

/* /teacher/dashboard — teacher overview. Server page: owns the <h1> and hands
 * the derived directory projection to one client island.
 *
 * Phase 13 adds a small band of REAL counts read from the database. They are
 * deliberately plain facts — pending requests, accepted students, seats left.
 * No revenue, no conversion rate, no acceptance-rate chart: the product does
 * not measure those, so it does not display them. */

export const dynamic = "force-dynamic";

export default async function TeacherOverviewPage() {
  const user = await requireRolePage("teacher", "/teacher/dashboard");
  // Demo flag resolved on the SERVER; it grants no access of any kind.
  const demoEnabled = demoWorkspaceEnabled();
  const [counts, capacity] = await Promise.all([
    getTeacherRequestCounts(user.id),
    getTeacherCapacitySummary(user.id),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Ustoz paneli
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Kurslaringiz, guruhlar va profil holati — barchasi katalogdagi haqiqiy
          ma’lumotdan hisoblanadi.
        </p>
      </header>
      <section aria-labelledby="teacher-counts" className="flex flex-col gap-3">
        <h2 id="teacher-counts" className="text-xl font-semibold text-ink-900">
          Hozirgi holat
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <dt className="text-sm text-ink-500">Ko‘rib chiqilmagan so‘rovlar</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900">{counts.submitted}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <dt className="text-sm text-ink-500">Qabul qilingan o‘quvchilar</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900">{counts.accepted}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <dt className="text-sm text-ink-500">Bo‘sh joylar</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900">{capacity.available}</dd>
          </div>
        </dl>
        <p className="text-sm text-ink-500">
          Bo‘sh joylar jami {capacity.capacity} ta o‘rindan hisoblanadi.{" "}
          <Link
            href="/teacher/dashboard/requests?status=submitted"
            className={cn("font-medium text-accent-700 underline underline-offset-2", focusRing)}
          >
            So‘rovlarni ko‘rib chiqish
          </Link>
        </p>
      </section>
      <TeacherOverviewPanels directory={teacherDirectory} demoEnabled={demoEnabled} />
    </div>
  );
}
