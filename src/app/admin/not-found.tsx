import { ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/dashboard/empty-state";

/* Unknown nested admin route → a real 404 INSIDE the admin shell, so the
 * navigation stays usable and a mistyped id is never disguised by a redirect.
 * Reached for unknown sub-paths and for ids that do not exist. */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
        Bo‘lim topilmadi
      </h1>
      <EmptyState title="Bunday sahifa administrator panelida yo‘q" as="h2">
        Manzil noto‘g‘ri bo‘lishi yoki yozuv o‘chirilgan bo‘lishi mumkin.
        Panelning mavjud bo‘limlari menyuda.
        <span className="mt-4 block">
          <ButtonLink href="/admin" variant="outline" size="sm">
            Umumiy sahifaga qaytish
          </ButtonLink>
        </span>
      </EmptyState>
    </div>
  );
}
