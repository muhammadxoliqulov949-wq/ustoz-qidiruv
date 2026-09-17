import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { LogoutButton } from "@/components/auth/logout-button";

/* -------------------------------------------------------------------------- */
/* Teacher identity panel — Phase 11: a SERVER component fed from the session.  */
/*                                                                              */
/* This replaces the Phase 9 workspace picker. That picker chose a teacher from   */
/* the catalogue and remembered the choice in localStorage; useful as a demo,   */
/* but it must never be confused with being signed in. Identity now comes       */
/* exclusively from the session cookie resolved on the server.                  */
/*                                                                              */
/* Verification is displayed honestly and read-only — nothing in the product    */
/* can move a teacher to "verified" in this phase.                              */
/* -------------------------------------------------------------------------- */

export function TeacherIdentityPanel({
  name,
  verification,
  onboardingCompleted,
}: {
  name: string;
  verification: "unverified" | "pending" | "verified";
  onboardingCompleted: boolean;
}) {
  const display = name.trim();
  const label =
    verification === "verified"
      ? "Tasdiqlangan"
      : verification === "pending"
        ? "Tekshiruv kutilmoqda"
        : "Tasdiqlanmagan";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={display === "" ? "?" : display} size="md" fallback={display === "" ? "?" : undefined} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink-900">
            {display === "" ? "Ismsiz profil" : display}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
            <Badge variant={verification === "verified" ? "accent" : "neutral"}>
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              {label}
            </Badge>
          </p>
        </div>
      </div>
      {onboardingCompleted ? null : (
        <Link
          /* The editable persisted profile lives in the teacher's own cabinet —
           * that is where the verification fields are filled in. */
          href="/teacher/dashboard/profile"
          className="text-sm font-medium text-accent-700 underline underline-offset-2"
        >
          Profilni to‘ldirish
        </Link>
      )}
      <LogoutButton />
    </div>
  );
}
