"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthNotice } from "@/components/auth/auth-notice";

/* -------------------------------------------------------------------------- */
/* RoleNotice — Phase 11 rewrite.                                              */
/*                                                                              */
/* The dashboard layout now GUARDS the route server-side (`requireRolePage`),   */
/* so this component no longer decides anything about access: an anonymous      */
/* visitor never reaches it, and a teacher is redirected before render. Its     */
/* only remaining job is to explain the redirect that already happened, which   */
/* the guard signals with ?role=student-required.                              */
/*                                                                              */
/* It deliberately no longer reads the localStorage onboarding draft — client   */
/* state must never describe, let alone determine, the visitor's role.          */
/* -------------------------------------------------------------------------- */

export function RoleNotice() {
  const params = useSearchParams();
  if (params.get("role") !== "student-required") return null;

  return (
    <AuthNotice variant="warning" title="Bu amal o‘quvchi hisobini talab qiladi">
      Siz ustoz hisobidasiz, shuning uchun o‘quvchi bo‘limiga o‘tkazildingiz.
      Kurslarni boshqarish uchun{" "}
      <Link
        href="/teacher/dashboard"
        className="font-medium text-accent-700 underline underline-offset-2"
      >
        ustoz paneliga
      </Link>{" "}
      qayting.
    </AuthNotice>
  );
}
