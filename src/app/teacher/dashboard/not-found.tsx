import { ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";

/* Unknown nested teacher route → a real 404 INSIDE the teacher shell, so the
 * navigation stays usable and the wrong URL is never hidden by a redirect. */
export default function TeacherDashboardNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
        Bo‘lim topilmadi
      </h1>
      <EmptyState title="Bunday sahifa ustoz panelida yo‘q" as="h2">
        Manzil noto‘g‘ri bo‘lishi yoki bu bo‘lim hali qurilmagan bo‘lishi
        mumkin. Panelning mavjud bo‘limlari chapdagi menyuda.
        <span className="mt-4 block">
          <ButtonLink href="/teacher/dashboard" variant="outline" size="sm">
            Panelga qaytish
          </ButtonLink>
        </span>
      </EmptyState>
    </div>
  );
}
