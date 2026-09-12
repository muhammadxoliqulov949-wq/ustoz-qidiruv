import { dashboardCatalog } from "@/data/dashboard-catalog";
import { OverviewPanels } from "@/components/dashboard/overview-panels";

/* -------------------------------------------------------------------------- */
/* /dashboard — student overview. Server component: it owns the <h1> and hands  */
/* the derived catalog projection to ONE client island that joins it with the   */
/* prototype stores. No analytics, only counts of things that exist.            */
/* -------------------------------------------------------------------------- */

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Kabinet
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          O‘quvchi paneli: yozilish so‘rovlaringiz, saqlangan kurslar va profil
          ma’lumotlari bir joyda.
        </p>
      </header>
      <OverviewPanels catalog={dashboardCatalog} />
    </div>
  );
}
