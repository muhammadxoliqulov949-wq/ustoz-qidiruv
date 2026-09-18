import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import { parseSafeNext } from "@/lib/safe-next";

/* -------------------------------------------------------------------------- */
/* /login — the ONE sign-in page, for two identifier kinds.                     */
/*                                                                              */
/*   • students and teachers: phone number + password (unchanged);              */
/*   • operators (role = 'admin'): email + password, for the accounts created   */
/*     by `npm run admin:create-email`.                                         */
/*                                                                              */
/* The page is a server component; only the form is a client island, and it     */
/* picks the matching server action (`loginAction` / `adminLoginAction`).       */
/*                                                                              */
/* This is an AUTHENTICATION surface only. Nothing here — and nothing anywhere  */
/* else over HTTP — can create an operator account or grant the admin role:     */
/* registration is phone-only and validates against a two-value role schema,    */
/* and the sole writer of `users.role = 'admin'` is the server-side CLI.        */
/*                                                                              */
/* Auth pages are noindex by design (Phase 6 SEO rule) — marketing routes       */
/* keep their own metadata.                                                     */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: "Kirish",
  description:
    "USTOZ hisobingizga kiring: o‘quvchi va ustozlar telefon raqami bilan, " +
    "operator hisobi email va parol bilan.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // ?next= is whitelist-validated server-side (internal paths only — an
  // open redirect is impossible) and only ever rendered as a plain link.
  const next = parseSafeNext(params.next);
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <AuthPage
      title="Hisobingizga kiring"
      intro="Google yoki emailingiz bilan kiring. Telefon orqali ochilgan mavjud hisoblar ham qo‘llab-quvvatlanadi."
    >
      <LoginForm initialNext={next} initialError={error} />
    </AuthPage>
  );
}
