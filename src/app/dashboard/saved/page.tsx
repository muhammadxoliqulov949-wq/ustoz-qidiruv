import type { Metadata } from "next";
import { dashboardCatalog } from "@/data/dashboard-catalog";
import { SavedPanel } from "@/components/dashboard/saved-panel";
import { requireRolePage } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Saqlanganlar",
};

/* /dashboard/saved — saved ids × canonical catalog projection. */
export default async function DashboardSavedPage() {
  await requireRolePage("student", "/dashboard/saved");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Saqlanganlar
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          Yurakcha tugmasi bilan belgilagan kurslar va ustozlar.
        </p>
      </header>
      <SavedPanel catalog={dashboardCatalog} />
    </div>
  );
}
