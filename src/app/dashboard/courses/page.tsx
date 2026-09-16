import type { Metadata } from "next";
import { RequestsPanel } from "@/components/dashboard/requests-panel";
import { AccountRequests } from "@/components/dashboard/account-requests";
import { requireRolePage } from "@/server/auth/guards";
import { getDashboardCatalog } from "@/server/public-repo";

export const metadata: Metadata = {
  title: "So‘rovlarim",
};

// Account data + live catalog: never prerendered, never a build-time query.
export const dynamic = "force-dynamic";

/* /dashboard/courses — two clearly separated sources (Phase 11):
 *   • AccountRequests — REAL rows from the database, scoped to the session;
 *   • RequestsPanel  — the in-progress draft that still lives in this
 *     browser, joined against the live catalog so its course/group facts are
 *     real. A draft naming no published course resolves to nothing.
 * Phase 20: the catalog comes from PostgreSQL (getDashboardCatalog). */
export default async function DashboardCoursesPage() {
  const user = await requireRolePage("student", "/dashboard/courses");
  const catalog = await getDashboardCatalog();
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
      <RequestsPanel catalog={catalog} />
    </div>
  );
}
