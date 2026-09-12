"use client";

import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";

/* -------------------------------------------------------------------------- */
/* Identity area — the honest replacement for an account header.                */
/* There is NO session: the name shown is whatever the Phase 6 onboarding       */
/* prototype draft holds in THIS browser, and the badge says so. When no draft  */
/* exists the area invites the student to fill the profile instead of inventing */
/* a user. A real auth layer replaces exactly this component's data source.     */
/* -------------------------------------------------------------------------- */

export function DashboardIdentity() {
  const { ready, draft } = useOnboardingDraft();
  const name = ready ? draft.student.name.trim() : "";

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name === "" ? "?" : name} size="md" fallback={name === "" ? "?" : undefined} />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-ink-900">
          {name === "" ? "Mehmon (profil to‘ldirilmagan)" : name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
          <Badge variant="neutral">O‘quvchi · prototip</Badge>
          {name === "" ? (
            <Link
              href="/dashboard/profile"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Profilni to‘ldirish
            </Link>
          ) : null}
        </p>
      </div>
    </div>
  );
}
