import { OverviewPanels } from "@/components/dashboard/overview-panels";
import { getDashboardCatalog } from "@/server/public-repo";

/* -------------------------------------------------------------------------- */
/* /dashboard — student overview. Server component: it owns the <h1> and hands  */
/* the catalog projection to ONE client island that joins it with the browser   */
/* stores. No analytics, only counts of things that exist.                      */
/*                                                                              */
/* Phase 20: the catalog is projected from PostgreSQL at request time            */
/* (getDashboardCatalog — published courses + directory teachers, the same       */
/* reads the public marketplace uses). No fixture import remains on this route.  */
/* -------------------------------------------------------------------------- */
import { requireRolePage } from "@/server/auth/guards";

// Account data + live catalog: never prerendered, never a build-time query.
export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  await requireRolePage("student", "/dashboard");
  const catalog = await getDashboardCatalog();
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
      <OverviewPanels catalog={catalog} />
    </div>
  );
}
