"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { PhoneField } from "./phone-input";
import { PasswordField } from "./password-input";
import { AuthNotice } from "./auth-notice";
import {
  extractUzPhoneDigits,
  formatUzPhone,
  isValidUzPhoneDigits,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/onboarding";
import { withNext } from "@/lib/safe-next";

/* -------------------------------------------------------------------------- */
/* LoginForm — phone + password front-end contract. NEVER authenticates:        */
/* submit validates locally, shows a short busy state, then the honest          */
/* "auth service not connected" notice. No session, no cookie, no redirect     */
/* masquerading as a sign-in, and no fake OTP. Password recovery is a          */
/* clearly-labeled deferred state (inline panel, no fake submit).              */
/* -------------------------------------------------------------------------- */

interface FieldErrors {
  phone?: string;
  password?: string;
}

export interface LoginFormProps {
  /** Safe internal ?next= target (validated on the server). */
  initialNext?: string | null;
}

export function LoginForm({ initialNext = null }: LoginFormProps) {
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handlePhoneChange = useCallback((next: string) => {
    setPhone(next);
    setSubmitted(false);
    setErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const phoneError = validatePhoneField(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const passwordError = validatePasswordField(password);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false);
      return;
    }
    // Frontend contract ends here: there is no auth backend in this phase,
    // so we never fake a request. A brief busy state demonstrates the submit
    // UX, then the honest not-connected notice replaces any action result.
    setSubmitting(true);
    timerRef.current = setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  const phoneDigits = extractUzPhoneDigits(phone);
  const registerHref = withNext(
    isValidUzPhoneDigits(phoneDigits)
      ? `/register?phone=${encodeURIComponent(formatUzPhone(phoneDigits))}`
      : "/register",
    initialNext,
  );

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <PhoneField
          value={phone}
          onChange={handlePhoneChange}
          error={errors.phone}
          required
        />

        <div className="flex flex-col gap-1.5">
          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setSubmitted(false);
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
              className="rounded-md px-1 py-0.5 text-sm font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
            >
              Parolni unutdingizmi?
            </button>
          </div>
          {forgotOpen ? (
            <p
              id="forgot-password-panel"
              className="rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-ink-500"
            >
              Parolni tiklash SMS yoki e-po‘ta orqali tasdiqlashni talab qiladi
              va autentifikatsiya serveri ulangach ishga tushadi. Bu interfeys
              hozircha tiklashni bajara olmaydi — qayta urinib turing yoki yangi
              hisob yarating.
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

      {submitted ? (
        <div className="mt-4">
          <AuthNotice live title="Autentifikatsiya xizmati hali ulangagan">
            <p>
              Kirish so‘rovi faqat shu brauzerda tekshirildi. Hech qanday
              so‘rov yuborilmadi, sessiya yaratilmadi va parolingiz hech
              qayoqqa yozilmadi. Tizimga kirish imkoniyati backend ulanganda
              ishga tushadi.
            </p>
            {initialNext ? (
              <p className="mt-2">
                Yozilish jarayonida sahifaga qaytish — kirish talab qilinmaydi
                (prototip oqim):{" "}
                <Link
                  href={initialNext}
                  className="rounded-md font-medium text-accent-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
                >
                  Davom etish
                </Link>
              </p>
            ) : null}
          </AuthNotice>
        </div>
      ) : null}

      <p className="mt-4 border-t border-line pt-4 text-center text-sm text-ink-500">
        Hisobingiz yo‘qmi?{" "}
        <Link
          href={registerHref}
          className="rounded-md font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
        >
          Ro‘yxatdan o‘ting
        </Link>
      </p>
    </Card>
  );
}
