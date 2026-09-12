import type { Metadata } from "next";
import { ProfilePanel } from "@/components/dashboard/profile-panel";

export const metadata: Metadata = {
  title: "Profil",
};

/* /dashboard/profile — editor over the Phase 6 StudentAnswers schema. */
export default function DashboardProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">
          Profil
        </h1>
        <p className="max-w-prose text-base text-ink-500">
          O‘quvchi ma’lumotlari va o‘qish afzalliklari — onboarding bilan bir xil
          maydonlar.
        </p>
      </header>
      <ProfilePanel />
    </div>
  );
}
