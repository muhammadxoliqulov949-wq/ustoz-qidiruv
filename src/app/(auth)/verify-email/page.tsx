import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { AuthPage } from "@/components/auth/auth-page";
import { Card, ButtonLink } from "@/components/ui";
import { verifyEmailToken } from "@/server/auth/verification";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = {
  title: "Emailni tasdiqlash",
  description: "USTOZ hisobingiz email manzilini tasdiqlash sahifasi.",
  robots: { index: false, follow: true },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const sent = params.sent === "1";
  const maskedEmail = typeof params.email === "string" ? params.email : "";

  // 1. Direct token verification
  if (token) {
    const result = await verifyEmailToken(token);
    if (result.ok) {
      return (
        <AuthPage
          title="Email tasdiqlandi"
          intro="Hisobingiz muvaffaqiyatli faollashtirildi. Endi platformaga kirishingiz mumkin."
        >
          <Card className="flex flex-col items-center gap-5 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-semibold text-ink-900">
                Email muvaffaqiyatli tasdiqlandi!
              </h2>
              <p className="text-sm text-ink-500">
                Hisobingiz tayyor. Tizimga kirib ta’lim yoki dars berishni boshlashingiz mumkin.
              </p>
            </div>
            <ButtonLink href="/login" size="lg" fullWidth>
              Kirish sahifasiga o‘tish
            </ButtonLink>
          </Card>
        </AuthPage>
      );
    }

    return (
      <AuthPage
        title="Havola yaroqsiz"
        intro="Tasdiqlash havolasining muddati tugagan yoki u allaqachon ishlatilgan."
      >
        <Card className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3.5 text-danger">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-sm font-medium">{result.message}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-600">
              Yangi tasdiqlash havolasini olish uchun emailingizni kiriting:
            </p>
            <ResendVerificationForm />
          </div>
          <div className="border-t border-line pt-4 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-accent-700 hover:text-accent-500"
            >
              Kirish sahifasiga qaytish
            </Link>
          </div>
        </Card>
      </AuthPage>
    );
  }

  // 2. Sent notice after registration
  if (sent) {
    return (
      <AuthPage
        title="Emailingizni tekshiring"
        intro="Agar ushbu email tasdiqlanmagan hisobga tegishli bo‘lsa, tasdiqlash xati yuborildi."
      >
        <Card className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-xl bg-accent-50/70 p-4 text-accent-900">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-white">
              <Mail className="size-5" />
            </div>
            <div className="flex flex-col text-sm">
              <span className="font-semibold text-ink-900">
                {maskedEmail
                  ? `Kiritilgan manzil: ${maskedEmail}`
                  : "Tasdiqlash holati"}
              </span>
              <span className="text-ink-600">
                Agar ushbu email tasdiqlanmagan hisobga tegishli bo‘lsa, tasdiqlash xati yuborildi. Xatdagi havolani bosib hisobingizni faollashtiring.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-ink-500">
            <p>
              Xat bir necha daqiqa ichida yetib keladi. Agar kelmasa, spam jildini tekshiring yoki quyida qayta yuborishni so‘rang.
            </p>
          </div>

          <ResendVerificationForm initialEmail={maskedEmail} />

          <div className="border-t border-line pt-4 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-accent-700 hover:text-accent-500"
            >
              Kirish sahifasiga o‘tish
            </Link>
          </div>
        </Card>
      </AuthPage>
    );
  }

  // 3. Fallback request form
  return (
    <AuthPage
      title="Tasdiqlash xatini so‘rash"
      intro="Emailingiz tasdiqlanmagan bo‘lsa, quyidagi shakl orqali yangi havola oling."
    >
      <Card className="flex flex-col gap-5">
        <ResendVerificationForm />
        <div className="border-t border-line pt-4 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-accent-700 hover:text-accent-500"
          >
            Kirish sahifasiga qaytish
          </Link>
        </div>
      </Card>
    </AuthPage>
  );
}
