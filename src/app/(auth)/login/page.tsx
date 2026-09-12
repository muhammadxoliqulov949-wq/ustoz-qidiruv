import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";

/* -------------------------------------------------------------------------- */
/* /login — phone + password entry for the (not yet connected) auth backend.     */
/* The page itself is a server component; only the form is a client island.     */
/* Auth pages are noindex by design (Phase 6 SEO rule) — marketing routes       */
/* keep their own metadata.                                                      */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Kirish",
  description:
    "USTOZ hisobingizga telefon raqami va parolingiz bilan kiring.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthPage
      title="Hisobingizga kiring"
      intro="Telefon raqami va parol — USTOZ’da hisob identifikatori telefon raqami."
    >
      <LoginForm />
    </AuthPage>
  );
}
