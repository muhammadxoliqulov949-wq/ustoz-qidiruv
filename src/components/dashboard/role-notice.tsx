"use client";

import Link from "next/link";
import { AuthNotice } from "@/components/auth/auth-notice";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";
import { dashboardRoleState } from "@/lib/dashboard";

/* -------------------------------------------------------------------------- */
/* RoleNotice — Phase 8 ships the STUDENT dashboard only. A prototype draft      */
/* whose role is "teacher" must not be silently shown student screens, and       */
/* nothing may pretend a teacher panel exists (Phase 9). A draft with no role     */
/* at all gets the honest "no session" line instead of a fake account.           */
/* -------------------------------------------------------------------------- */

export function RoleNotice() {
  const { ready, draft } = useOnboardingDraft();
  if (!ready) return null;

  const role = dashboardRoleState(draft.role);
  if (role === "student") return null;

  if (role === "teacher") {
    return (
      <AuthNotice variant="warning" title="Bu bo‘lim o‘quvchilar uchun">
        Brauzeringizdagi prototip profili <strong>ustoz</strong> rolida. Ustozlar
        paneli hali qurilmagan — u keyingi bosqichda qo‘shiladi. Shu sahifadagi
        ma’lumotlar faqat o‘quvchi holatini ko‘rsatadi.{" "}
        <Link
          href="/onboarding?role=student"
          className="font-medium text-accent-700 underline underline-offset-2"
        >
          O‘quvchi sifatida to‘ldirish
        </Link>
        .
      </AuthNotice>
    );
  }

  return (
    <AuthNotice title="Haqiqiy hisob hali yo‘q">
      Autentifikatsiya backendi ulanmagan, shuning uchun bu kabinet sizni
      tizimga kirgan deb hisoblamaydi. Quyidagi ma’lumotlar faqat shu
      brauzerdagi prototip holatidan olingan.{" "}
      <Link
        href="/onboarding?role=student"
        className="font-medium text-accent-700 underline underline-offset-2"
      >
        O‘quvchi profilini to‘ldirish
      </Link>
      .
    </AuthNotice>
  );
}
