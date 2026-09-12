"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTeacherState } from "./use-teacher-state";
import type { TeacherDirectory, TeacherWorkspaceLite } from "@/lib/teacher-workspace";
import type { TeacherState } from "./use-teacher-state";

/* -------------------------------------------------------------------------- */
/* WorkspaceGate — the one place that resolves "which teacher are we looking    */
/* at". Every teacher screen renders through it, so the three states (hydrating */
/* / nothing chosen / stale id) are handled identically and no screen ever      */
/* silently falls back to an arbitrary teacher record.                           */
/* `minHeight` reserves the resolved panel height (Phase 8 CLS lesson).          */
/* -------------------------------------------------------------------------- */

export function WorkspaceGate({
  directory,
  heading,
  minHeight = "min-h-[30rem]",
  children,
}: {
  directory: TeacherDirectory;
  /** Section heading kept in the document pre-hydration for a11y/SSR. */
  heading: string;
  minHeight?: string;
  children: (workspace: TeacherWorkspaceLite, state: TeacherState) => ReactNode;
}) {
  const state = useTeacherState(directory);

  if (!state.ready) {
    return (
      <section aria-labelledby="tw-gate" className={`block ${minHeight}`}>
        <h2 id="tw-gate" className="text-xl font-semibold text-ink-900">
          {heading}
        </h2>
        <p className="mt-2 text-base text-ink-500" role="status">
          Brauzer holati o‘qilmoqda…
        </p>
      </section>
    );
  }

  if (state.workspace === null) {
    return (
      <div className={`flex flex-col gap-4 ${minHeight}`}>
        {state.unknownSelection ? (
          <AuthNotice variant="warning" title="Tanlangan ustoz topilmadi">
            Brauzeringizda saqlangan ish maydoni identifikatori katalogdagi
            hech bir ustozga mos kelmadi. Yon menyudan qaytadan tanlang.
          </AuthNotice>
        ) : null}
        <EmptyState title="Ish maydoni tanlanmagan" as="h2">
          Haqiqiy ustoz hisobi hali yo‘q, shuning uchun panel sizni avtomatik
          tanib olmaydi. Ko‘rish uchun yon menyudagi ro‘yxatdan katalogdagi
          ustozni tanlang — barcha ma’lumot o‘sha ustozning haqiqiy kurslaridan
          olinadi.
          <p className="mt-3">
            <Link
              href="/teachers"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Ustozlar katalogini ko‘rish
            </Link>
          </p>
        </EmptyState>
      </div>
    );
  }

  return <>{children(state.workspace, state)}</>;
}
