import type { Metadata } from "next";
import { OnboardingProvider } from "@/components/onboarding/draft-store";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { parseRoleParam } from "@/lib/onboarding";
import { parseSafeNext } from "@/lib/safe-next";

/* -------------------------------------------------------------------------- */
/* /onboarding — role-specific multi-step flow (student light / teacher         */
/* structured) over the PROTOTYPE draft store. Step headings are rendered by    */
/* the wizard itself, so there is no static h1 here. Refresh resumes from the   */
/* localStorage draft (input preservation); there is intentionally no API call. */
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
  const role = parseRoleParam(params.role);
  // ?next= (validated) lets the enrollment flow round-trip through register →
  // onboarding and back; anything unsafe is dropped to null.
  const next = parseSafeNext(params.next);

  return (
    <div className="site-container py-14 sm:py-18 lg:py-24">
      <div className="mx-auto w-full max-w-[40rem]">
        <OnboardingProvider>
          <OnboardingWizard initialRole={role} initialNext={next} />
        </OnboardingProvider>
      </div>
    </div>
  );
}
