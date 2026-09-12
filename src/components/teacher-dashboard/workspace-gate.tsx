"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useTeacherState } from "./use-teacher-state";
import type { TeacherDirectory, TeacherWorkspaceLite } from "@/lib/teacher-workspace";
import type { TeacherState } from "./use-teacher-state";

/* -------------------------------------------------------------------------- */
/* WorkspaceGate — Phase 11.                                                    */
/*                                                                              */
/* The Phase 9 workspace selection is now a DEMO-ONLY catalogue inspector and   */
/* is off by default (`demoEnabled`, resolved on the server from                */
/* DEMO_TEACHER_WORKSPACE and always false in production). It never granted     */
/* access and now it cannot even be mistaken for identity: with the flag off,   */
/* these panels render an explanatory read-only state instead of a "choose who  */
/* you are" control. Real identity lives in the session (see the layout), and   */
/* the catalogue itself stays canonical read-only data until Phase 12.          */
/*                                                                              */
/* `minHeight` reserves the resolved panel height (Phase 8 CLS lesson).          */
/* -------------------------------------------------------------------------- */

export function WorkspaceGate({
  directory,
  heading,
  demoEnabled = false,
  minHeight = "min-h-[30rem]",
  children,
}: {
  directory: TeacherDirectory;
  /** Server-resolved demo flag. Never derived from client state. */
  demoEnabled?: boolean;
  /** Section heading kept in the document pre-hydration for a11y/SSR. */
  heading: string;
  minHeight?: string;
  children: (workspace: TeacherWorkspaceLite, state: TeacherState) => ReactNode;
}) {
  const state = useTeacherState(directory);

  if (!demoEnabled) {
    return (
      <section aria-labelledby="tw-gate" className={`flex flex-col gap-4 ${minHeight}`}>
        <h2 id="tw-gate" className="text-xl font-semibold text-ink-900">
          {heading}
        </h2>
        <AuthNotice title="Katalog ma’lumotlari bu panelga hali ulanmagan">
          Ommaviy katalogdagi kurslar hozircha alohida manbadan o‘qiladi va
          hisobingizga bog‘lanmagan — bu ulanish keyingi bosqichda bajariladi.
          Shu sababli bu bo‘limda avvalgi “ish maydonini tanlash” boshqaruvi
          olib tashlandi: u hech qachon hisob bo‘lmagan va endi chalkashtirmasligi
          kerak. Hisobingizdagi haqiqiy ma’lumotlar yuqorida ko‘rsatiladi.
          <p className="mt-3">
            <Link
              href="/teachers"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Ommaviy ustozlar katalogini ko‘rish
            </Link>
          </p>
        </AuthNotice>
      </section>
    );
  }

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
