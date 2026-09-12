import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import { parseSafeNext } from "@/lib/safe-next";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?next= is whitelist-validated server-side (internal paths only — an
  // open redirect is impossible) and only ever rendered as a plain link.
  const next = parseSafeNext((await searchParams).next);
  return (
    <AuthPage
      title="Hisobingizga kiring"
      intro="Telefon raqami va parol — USTOZ’da hisob identifikatori telefon raqami."
    >
      <LoginForm initialNext={next} />
    </AuthPage>
  );
}
