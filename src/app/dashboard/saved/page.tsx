import type { Metadata } from "next";
import { SavedPanel } from "@/components/dashboard/saved-panel";
import { requireRolePage } from "@/server/auth/guards";
import { getDashboardCatalog } from "@/server/public-repo";

export const metadata: Metadata = {
  title: "Saqlanganlar",
};

// Account data + live catalog: never prerendered, never a build-time query.
export const dynamic = "force-dynamic";

/* /dashboard/saved — saved ids × the live catalog projection (Phase 20: the
 * catalog is PostgreSQL truth, so every saved row links to a real published
 * course or a real directory teacher; stale ids honestly drop out). */
export default async function DashboardSavedPage() {
  await requireRolePage("student", "/dashboard/saved");
  const catalog = await getDashboardCatalog();
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
      <SavedPanel catalog={catalog} />
    </div>
  );
}
