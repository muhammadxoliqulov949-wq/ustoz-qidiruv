import type { Metadata } from "next";
import { dashboardCatalog } from "@/data/dashboard-catalog";
import { RequestsPanel } from "@/components/dashboard/requests-panel";
import { AccountRequests } from "@/components/dashboard/account-requests";
import { requireRolePage } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "So‘rovlarim",
};

/* /dashboard/courses — two clearly separated sources (Phase 11):
 *   • AccountRequests — REAL rows from the database, scoped to the session;
 *   • RequestsPanel  — the Phase 7 in-progress draft that still lives in this
 *     browser, kept so nobody loses a half-finished enrollment. */
export default async function DashboardCoursesPage() {
  const user = await requireRolePage("student", "/dashboard/courses");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          So‘rovlarim
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Boshlangan yozilish qoralamalari va tayyor so‘rovlar — kurs, guruh,
          jadval va holat bilan.
        </p>
      </header>
      <AccountRequests userId={user.id} />
      <RequestsPanel catalog={dashboardCatalog} />
    </div>
  );
}
