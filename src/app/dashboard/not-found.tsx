import { ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";

/* Unknown nested dashboard route → a real 404 INSIDE the dashboard shell
 * (nav stays usable), never a redirect that hides the wrong URL. */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
        Bo‘lim topilmadi
      </h1>
      <EmptyState title="Bunday sahifa kabinetda yo‘q" as="h2">
        Manzil noto‘g‘ri bo‘lishi yoki bu bo‘lim hali qurilmagan bo‘lishi
        mumkin. Kabinetning mavjud bo‘limlari chapdagi menyuda.
        <span className="mt-4 block">
          <ButtonLink href="/dashboard" variant="outline" size="sm">
            Kabinetga qaytish
          </ButtonLink>
        </span>
      </EmptyState>
    </div>
  );
}
