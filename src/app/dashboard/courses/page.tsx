import type { Metadata } from "next";
import { dashboardCatalog } from "@/data/dashboard-catalog";
import { RequestsPanel } from "@/components/dashboard/requests-panel";

export const metadata: Metadata = {
  title: "So‘rovlarim",
};

/* /dashboard/courses — enrollment requests derived from the Phase 7 draft. */
export default function DashboardCoursesPage() {
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
      <RequestsPanel catalog={dashboardCatalog} />
    </div>
  );
}
