"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button, Card, RadioCardGroup } from "@/components/ui";
import { PhoneField } from "./phone-input";
import { EmailField } from "./email-input";
import { PasswordField } from "./password-input";
import { AuthNotice } from "./auth-notice";
import { GoogleButton } from "./google-button";
import {
  extractUzPhoneDigits,
  formatUzPhone,
  isValidUzPhoneDigits,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/onboarding";
import { validateEmailField } from "@/lib/email";
import { withNext } from "@/lib/safe-next";
import {
  adminLoginAction,
  loginAction,
  loginEmailAction,
} from "@/server/actions/auth";

/* -------------------------------------------------------------------------- */
/* LoginForm — Phase 23.5.                                                     */
/*                                                                              */
/* Target UX:                                                                  */
/*   1. Primary: [ Continue with Google ]                                      */
/*   2. Fallback: Email + Password                                             */
/*   3. Legacy: Phone + Password                                               */
/*   4. Operator: Admin Email + Password                                       */
/* -------------------------------------------------------------------------- */

type LoginMode = "email" | "phone" | "operator";

const MODE_OPTIONS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Telefon (eski)", icon: Phone },
  { value: "operator", label: "Operator", icon: ShieldCheck },
];

interface FieldErrors {
  phone?: string;
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  /** Safe internal ?next= target (validated on the server). */
  initialNext?: string | null;
  /** OAuth error query if redirected from Google callback. */
  initialError?: string | null;
}

export function LoginForm({ initialNext = null, initialError = null }: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>("email");
  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    initialError ? formatOAuthError(initialError) : null,
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [submitting, startTransition] = useTransition();

  const clearMessages = useCallback(() => {
    setFormError(null);
    setUnverifiedEmail(null);
    setErrors({});
  }, []);

  const handlePhoneChange = useCallback((next: string) => {
    setPhone(next);
    setFormError(null);
    setErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
  }, []);

  const handleEmailChange = useCallback((next: string) => {
    setEmail(next);
    setFormError(null);
    setUnverifiedEmail(null);
    setErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (mode === "phone") {
      const phoneError = validatePhoneField(phone);
      if (phoneError) nextErrors.phone = phoneError;
    } else {
      const emailError = validateEmailField(email);
      if (emailError) nextErrors.email = emailError;
    }
    const passwordError = validatePasswordField(password);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    setFormError(null);
    setUnverifiedEmail(null);
    if (Object.keys(nextErrors).length > 0) return;

    startTransition(async () => {
      const payload = new FormData();
      if (mode === "phone") payload.set("phone", phone);
      else payload.set("email", email);
      payload.set("password", password);
      if (initialNext) payload.set("next", initialNext);

      try {
        let result;
        if (mode === "email") {
          result = await loginEmailAction(payload);
        } else if (mode === "phone") {
          result = await loginAction(payload);
        } else {
          result = await adminLoginAction(payload);
        }

        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.message);
          if (result.code === "unverified_email") {
            setUnverifiedEmail(email);
          }
        }
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error) throw error;
        setFormError("Ulanishda xatolik. Internetni tekshirib, qayta urining.");
      }
    });
  };

  const googleHref = withNext("/api/auth/google", initialNext);
  const phoneDigits = extractUzPhoneDigits(phone);
  const registerHref = withNext(
    isValidUzPhoneDigits(phoneDigits)
      ? `/register?phone=${encodeURIComponent(formatUzPhone(phoneDigits))}`
      : "/register",
    initialNext,
  );

  return (
    <Card className="flex flex-col gap-5">
      {/* 1. Primary: Continue with Google (hidden in operator mode) */}
      {mode !== "operator" ? (
        <>
          <div className="flex flex-col gap-2">
            <GoogleButton href={googleHref}>Continue with Google</GoogleButton>
          </div>

          {/* Divider */}
          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-3 font-medium text-ink-500">yoki</span>
            </div>
          </div>
        </>
      ) : null}

      {/* Identifier switcher */}
      <RadioCardGroup
        legend="Kirish usuli"
        value={mode}
        onChange={(next) => {
          setMode(next as LoginMode);
          clearMessages();
        }}
        options={MODE_OPTIONS}
        columns={3}
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {mode === "phone" ? (
          <PhoneField
            value={phone}
            onChange={handlePhoneChange}
            error={errors.phone}
            required
          />
        ) : (
          <EmailField
            value={email}
            onChange={handleEmailChange}
            error={errors.email}
            label={mode === "operator" ? "Operator emaili" : "Email"}
            required
          />
        )}

        <div className="flex flex-col gap-1.5">
          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setFormError(null);
              setErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
            }}
            error={errors.password}
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setForgotOpen((open) => !open)}
              aria-expanded={forgotOpen}
              aria-controls="forgot-password-panel"
              className="-my-1 rounded-md px-1 py-1 text-sm font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
            >
              Parolni unutdingizmi?
            </button>
          </div>
          {forgotOpen ? (
            <p
              id="forgot-password-panel"
              className="rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-ink-500"
            >
              Parolni tiklash bo‘yicha qo‘llab-quvvatlash xizmatiga murojaat qiling
              yoki yangi hisob yarating.
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          trailingIcon={submitting ? undefined : <ArrowRight />}
        >
          {submitting ? "Tekshirilmoqda…" : "Kirish"}
        </Button>
      </form>

      {formError ? (
        <AuthNotice live title="Kirish amalga oshmadi">
          <p>{formError}</p>
          {unverifiedEmail ? (
            <p className="mt-2">
              <Link
                href={`/verify-email?sent=1&email=${encodeURIComponent(unverifiedEmail)}`}
                className="font-medium text-accent-700 underline hover:text-accent-600"
              >
                Tasdiqlash xatini qayta yuborish sahifasiga o‘tish
              </Link>
            </p>
          ) : null}
        </AuthNotice>
      ) : null}

      {mode !== "operator" ? (
        <p className="border-t border-line pt-4 text-center text-sm text-ink-500">
          Hisobingiz yo‘qmi?{" "}
          <Link
            href={registerHref}
            className="rounded-md font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
          >
            Ro‘yxatdan o‘ting
          </Link>
        </p>
      ) : (
        <p className="border-t border-line pt-4 text-center text-sm text-ink-500">
          Operator hisobi faqat serverda yaratiladi: bu sahifada ro‘yxatdan
          o‘tish yo‘li yo‘q.
        </p>
      )}
    </Card>
  );
}

function formatOAuthError(code: string): string {
  switch (code) {
    case "google_cancelled":
      return "Google orqali kirish bekor qilindi.";
    case "email_not_verified":
      return "Google hisobidagi email tasdiqlanmagan.";
    case "admin_forbidden":
      return "Administrator hisobiga umumiy Google orqali kirish taqiqlangan.";
    case "account_deactivated":
      return "Hisobingiz faolsizlantirilgan.";
    default:
      return "Google orqali autentifikatsiyada xatolik yuz berdi.";
  }
}
