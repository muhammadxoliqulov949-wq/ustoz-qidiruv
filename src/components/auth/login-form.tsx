"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Button, Card, RadioCardGroup } from "@/components/ui";
import { PhoneField } from "./phone-input";
import { EmailField } from "./email-input";
import { PasswordField } from "./password-input";
import { AuthNotice } from "./auth-notice";
import {
  extractUzPhoneDigits,
  formatUzPhone,
  isValidUzPhoneDigits,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/onboarding";
import { validateEmailField } from "@/lib/email";
import { withNext } from "@/lib/safe-next";
import { adminLoginAction, loginAction } from "@/server/actions/auth";

/* -------------------------------------------------------------------------- */
/* LoginForm — ONE page, TWO identifier kinds.                                  */
/*                                                                              */
/*   Telefon raqami  → phone + password → `loginAction`                         */
/*                     students, teachers, and phone-bootstrapped operators.    */
/*                     This is the default and it is unchanged.                 */
/*   Operator emaili → email + password → `adminLoginAction`                    */
/*                     operator accounts created by `admin:create-email`.       */
/*                                                                              */
/* The choice is an explicit radio-card decision (the same control /register    */
/* uses for the student/teacher choice) rather than a guess from the input's    */
/* shape: two identity systems with different rules deserve a visible switch,   */
/* and guessing would turn a typo in an email into a confusing phone error.     */
/*                                                                              */
/* Submit calls the matching server action, which verifies the argon2id hash    */
/* and, on success, sets an HttpOnly session cookie and redirects server-side.  */
/* Local validation is kept purely for fast feedback — it is re-run on the      */
/* server and never trusted. Nothing is stored in localStorage, the password    */
/* never leaves the form, and failures return one generic message per mode so   */
/* the form cannot be used to discover which identifiers are registered.        */
/*                                                                              */
/* WHAT THIS FORM CANNOT DO: create an operator account. There is no register   */
/* link in operator mode and no action behind one — `adminLoginAction` only     */
/* authenticates, and the only writer of `users.role = 'admin'` is the          */
/* server-side CLI (scripts/admin.ts). Password recovery stays an honest        */
/* deferred state (needs SMS/e-mail delivery, which this product does not       */
/* implement).                                                                  */
/* -------------------------------------------------------------------------- */

type LoginMode = "phone" | "email";

const MODE_OPTIONS = [
  { value: "phone", label: "Telefon raqami", icon: Phone },
  { value: "email", label: "Operator emaili", icon: Mail },
];

interface FieldErrors {
  phone?: string;
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  /** Safe internal ?next= target (validated on the server). */
  initialNext?: string | null;
}

export function LoginForm({ initialNext = null }: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>("phone");
  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [submitting, startTransition] = useTransition();

  const clearMessages = useCallback(() => {
    setFormError(null);
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
    if (Object.keys(nextErrors).length > 0) return;

    // Real authentication. On success the server action redirects (it throws
    // Next.js's redirect signal), so no success branch runs here.
    startTransition(async () => {
      const payload = new FormData();
      if (mode === "phone") payload.set("phone", phone);
      else payload.set("email", email);
      payload.set("password", password);
      if (initialNext) payload.set("next", initialNext);
      try {
        const result =
          mode === "phone"
            ? await loginAction(payload)
            : await adminLoginAction(payload);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.message);
        }
      } catch (error) {
        // Re-throw framework navigation signals; only report real failures.
        if (error && typeof error === "object" && "digest" in error) throw error;
        setFormError("Ulanishda xatolik. Internetni tekshirib, qayta urining.");
      }
    });
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
        <RadioCardGroup
          legend="Qanday kirasiz?"
          value={mode}
          onChange={(next) => {
            setMode(next as LoginMode);
            clearMessages();
          }}
          options={MODE_OPTIONS}
          columns={2}
        />

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

      {formError ? (
        <div className="mt-4">
          <AuthNotice live title="Kirish amalga oshmadi">
            <p>{formError}</p>
          </AuthNotice>
        </div>
      ) : null}

      {mode === "phone" ? (
        <p className="mt-4 border-t border-line pt-4 text-center text-sm text-ink-500">
          Hisobingiz yo‘qmi?{" "}
          <Link
            href={registerHref}
            className="rounded-md font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
          >
            Ro‘yxatdan o‘ting
          </Link>
        </p>
      ) : (
        /* No registration path in operator mode — and that is the point. An
           operator account is bootstrapped on the server, never from a form. */
        <p className="mt-4 border-t border-line pt-4 text-center text-sm text-ink-500">
          Operator hisobi faqat serverda yaratiladi: bu sahifada ro‘yxatdan
          o‘tish yo‘li yo‘q.
        </p>
      )}
    </Card>
  );
}
