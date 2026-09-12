import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { RegisterForm } from "@/components/auth/register-form";
import { parsePhoneParam, parseRoleParam } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* /register — role-aware, deliberately minimal sign-up (role + name + phone     */
/* + password). ?role= (whitelisted) pre-selects the role card so entry          */
/* points like “Ustoz bo‘lish” can deep-link; ?phone= is the /login handoff.     */
/* Search params are parsed SERVER-side and validated through lib/onboarding —  */
/* the client form receives only clean, typed values.                           */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Ro‘yxatdan o‘tish",
  description:
    "USTOZ’da o‘quvchi yoki ustoz sifatida ro‘yxatdan o‘ting — bir necha daqiqada.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const role = parseRoleParam(params.role);
  const phone = parsePhoneParam(params.phone);

  return (
    <AuthPage
      title="Ro‘yxatdan o‘tish"
      intro="Boshlash uchun faqat rol, ism, telefon va parol kerak — qolganini onboardingda so‘raymiz."
    >
      <RegisterForm initialRole={role} initialPhone={phone} />
    </AuthPage>
  );
}
