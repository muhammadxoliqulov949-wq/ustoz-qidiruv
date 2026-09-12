import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { LogoutButton } from "@/components/auth/logout-button";

/* -------------------------------------------------------------------------- */
/* Identity area — Phase 11: a SERVER component fed from the session.          */
/*                                                                              */
/* Previously this read the Phase 6 localStorage draft, which meant the name    */
/* on screen was whatever the browser happened to hold. It is now rendered on   */
/* the server from the authenticated user's profile row, so it cannot be        */
/* spoofed by editing localStorage and it costs no client JS. The phone number  */
/* is intentionally NOT displayed.                                              */
/* -------------------------------------------------------------------------- */

export function DashboardIdentity({
  name,
  onboardingCompleted,
}: {
  name: string;
  onboardingCompleted: boolean;
}) {
  const display = name.trim();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={display === "" ? "?" : display} size="md" fallback={display === "" ? "?" : undefined} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink-900">
            {display === "" ? "Ismsiz profil" : display}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
            <Badge variant="neutral">O‘quvchi</Badge>
            {onboardingCompleted ? null : (
              <Link
                href="/onboarding"
                className="font-medium text-accent-700 underline underline-offset-2"
              >
                Profilni to‘ldirish
              </Link>
            )}
          </p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
