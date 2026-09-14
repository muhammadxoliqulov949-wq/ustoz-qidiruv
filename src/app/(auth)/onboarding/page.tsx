import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingProvider } from "@/components/onboarding/draft-store";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { parseRoleParam } from "@/lib/onboarding";
import { parseSafeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth/session";

/* -------------------------------------------------------------------------- */
/* /onboarding — role-specific multi-step flow (student light / teacher         */
/* structured) over the PROTOTYPE draft store. Step headings are rendered by    */
/* the wizard itself, so there is no static h1 here. Refresh resumes from the   */
/* localStorage draft (input preservation). Phase 11: the session is resolved   */
/* HERE, on the server, and the real account role wins over ?role= — a visitor  */
/* cannot switch themselves into the teacher flow through the URL. Completing   */
/* the flow while signed in persists the answers to a real profile row.         */
/* ?role= is whitelist-parsed server-side and only seeds an undecided draft.    */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Onboarding",
  description:
    "USTOZ onboarding — o‘quvchi yoki ustoz profili uchun qisqa so‘rovnomalar.",
  robots: { index: false, follow: true },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  /*
   * An admin has no student/teacher profile and no onboarding to complete:
   * sending them here would offer a questionnaire that cannot be saved.
   * (Admins are created by the operator CLI, never by this flow.)
   */
  if (user?.role === "admin") redirect("/admin");
  // The authenticated role is authoritative; ?role= only seeds anonymous runs.
  const role = user?.role ?? parseRoleParam(params.role);
  // ?next= (validated) lets the enrollment flow round-trip through register →
  // onboarding and back; anything unsafe is dropped to null.
  const next = parseSafeNext(params.next);

  return (
    <div className="site-container py-14 sm:py-18 lg:py-24">
      <div className="mx-auto w-full max-w-[40rem]">
        <OnboardingProvider>
          <OnboardingWizard
            initialRole={role}
            initialNext={next}
            signedIn={user !== null}
          />
        </OnboardingProvider>
      </div>
    </div>
  );
}
