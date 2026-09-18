import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/server/auth/guards";
import { ChangePasswordForm, DeactivateAccountForm } from "@/components/account/account-security-forms";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Hisob xavfsizligi", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUserPage("/account");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <div><ButtonLink href={user.role === "teacher" ? "/teacher/dashboard" : user.role === "admin" ? "/admin" : "/dashboard"} variant="ghost" size="sm">← Panelga qaytish</ButtonLink></div>
        <h1 className="text-3xl font-semibold tracking-[-0.015em] text-ink-900">Hisob xavfsizligi</h1>
        <p className="text-base leading-relaxed text-ink-500">Parol va hisob holatini shu yerda boshqaring. Hisob ma’lumotlari o‘zgarganda mavjud sessiyalar serverda qayta tekshiriladi.</p>
      </header>
      <ChangePasswordForm />
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
        <h2 className="text-xl font-semibold text-ink-900">Yordam kerakmi?</h2>
        <p className="text-sm leading-relaxed text-ink-600">Kirish, kurs, to‘lov yoki boshqa muammo bo‘lsa, operatorga ilova ichidagi murojaat yuboring.</p>
        <div><Link href="/support" className="font-medium text-accent-700 underline underline-offset-2">Yordam va murojaatlar</Link></div>
      </section>
      {user.role === "admin" ? (
        <section className="rounded-xl border border-line bg-surface-muted p-5">
          <h2 className="text-xl font-semibold text-ink-900">Administrator hisobi</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Administrator hisobini deaktivasiyalash ilova ichida bajarilmaydi. Zarur bo‘lsa, serverdagi operator tartibidan foydalaning.
          </p>
        </section>
      ) : <DeactivateAccountForm />}
    </main>
  );
}
