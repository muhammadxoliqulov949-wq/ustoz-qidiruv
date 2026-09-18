"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Button, Card, Input, RadioCardGroup } from "@/components/ui";
import { PhoneField } from "./phone-input";
import { EmailField } from "./email-input";
import { PasswordField } from "./password-input";
import { RoleChoice } from "./role-choice";
import { AuthNotice } from "./auth-notice";
import { GoogleButton } from "./google-button";
import {
  emptyDraft,
  validateName,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/onboarding";
import { validateEmailField } from "@/lib/email";
import { withNext } from "@/lib/safe-next";
import { registerAction, registerEmailAction } from "@/server/actions/auth";
import {
  readPrototypeDraft,
  usePrototypeDraftHydrated,
  writePrototypeDraft,
} from "@/components/onboarding/draft-store";

/* -------------------------------------------------------------------------- */
/* RegisterForm — Phase 23.5.                                                 */
/*                                                                              */
/* Target UX:                                                                  */
/*   1. Role selection: O‘quvchi / Ustoz                                       */
/*   2. Primary: [ Google orqali davom etish ]                                 */
/*   3. Fallback: Email + Password (with email verification)                   */
/*   4. Legacy: Phone + Password                                               */
/* -------------------------------------------------------------------------- */

type RegisterMethod = "email" | "phone";

const METHOD_OPTIONS = [
  { value: "email", label: "Email orqali", icon: Mail },
  { value: "phone", label: "Telefon (eski)", icon: Phone },
];

interface FieldErrors {
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export interface RegisterFormProps {
  /** ?role= whitelist-parsed on the server — starts the flow mid-decision. */
  initialRole: "student" | "teacher" | null;
  /** ?phone= handoff from /login (already canonical), or null. */
  initialPhone: string | null;
  /** Safe internal ?next= (e.g. an enrollment flow to return to). */
  initialNext?: string | null;
}

export function RegisterForm({
  initialRole,
  initialPhone,
  initialNext = null,
}: RegisterFormProps) {
  const [role, setRole] = useState<"student" | "teacher" | null>(initialRole);
  const [method, setMethod] = useState<RegisterMethod>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(initialPhone ?? "+998");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();

  const hydrated = usePrototypeDraftHydrated();
  const pendingDraft = useMemo(() => {
    if (!hydrated) return null;
    const draft = readPrototypeDraft();
    if (draft && (draft.role !== null || draft.student.name || draft.teacher.name))
      return draft;
    return null;
  }, [hydrated]);

  const activeRole = role ?? readPrototypeDraft()?.role ?? "student";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};

    if (role === null && readPrototypeDraft()?.role == null) {
      nextErrors.role = "Rolni tanlang — o‘quvchimisiz yoki ustozmi?";
    }

    const nameError = validateName(name);
    if (nameError) nextErrors.name = nameError;

    if (method === "email") {
      const emailError = validateEmailField(email);
      if (emailError) nextErrors.email = emailError;
      const passwordError = validatePasswordField(password);
      if (passwordError) nextErrors.password = passwordError;
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Kiritilgan parollar bir-biriga mos kelmadi.";
      }
    } else {
      const phoneError = validatePhoneField(phone);
      if (phoneError) nextErrors.phone = phoneError;
      const passwordError = validatePasswordField(password);
      if (passwordError) nextErrors.password = passwordError;
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const base = readPrototypeDraft() ?? emptyDraft();
    const finalRole = role ?? base.role ?? "student";

    const nextDraft = {
      ...base,
      role: finalRole,
      student: { ...base.student, name: base.student.name || name.trim() },
      teacher: { ...base.teacher, name: base.teacher.name || name.trim() },
    };
    writePrototypeDraft(nextDraft);

    startTransition(async () => {
      const payload = new FormData();
      payload.set("role", finalRole);
      payload.set("name", name.trim());
      payload.set("password", password);
      if (initialNext) payload.set("next", initialNext);

      try {
        let result;
        if (method === "email") {
          payload.set("email", email);
          payload.set("confirmPassword", confirmPassword);
          result = await registerEmailAction(payload);
        } else {
          payload.set("phone", phone);
          result = await registerAction(payload);
        }

        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.message);
        }
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error) throw error;
        setFormError("Ulanishda xatolik. Internetni tekshirib, qayta urining.");
      }
    });
  };

  const googleHref = withNext(
    `/api/auth/google?role=${encodeURIComponent(activeRole)}`,
    initialNext,
  );

  return (
    <div className="flex flex-col gap-4">
      {pendingDraft ? (
        <AuthNotice title="Bu brauzerda onboarding holati mavjud">
          Avvalgi to‘ldirilgan onboarding ma’lumotlarini yo‘qotmasdan
          <Link
            href={withNext("/onboarding", initialNext)}
            className="ml-1 rounded-md font-medium text-accent-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
          >
            davom ettirish
          </Link>{" "}
          mumkin.
        </AuthNotice>
      ) : null}

      <Card className="flex flex-col gap-5">
        {/* Role Choice */}
        <RoleChoice
          columns={1}
          value={role}
          onChange={(next) => {
            setRole(next);
            setErrors((prev) => (prev.role ? { ...prev, role: undefined } : prev));
          }}
          error={errors.role}
        />

        {/* 1. Primary: Continue with Google */}
        <div className="flex flex-col gap-2">
          <GoogleButton href={googleHref}>Google orqali davom etish</GoogleButton>
        </div>

        {/* Divider */}
        <div className="relative text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-3 font-medium text-ink-400">yoki</span>
          </div>
        </div>

        {/* Method switcher */}
        <RadioCardGroup
          legend="Ro‘yxatdan o‘tish usuli"
          value={method}
          onChange={(next) => {
            setMethod(next as RegisterMethod);
            setFormError(null);
            setErrors({});
          }}
          options={METHOD_OPTIONS}
          columns={2}
        />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="To‘liq ism"
            placeholder="Masalan: Malika Ergasheva"
            autoComplete="name"
            value={name}
            error={errors.name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
            }}
            required
          />

          {method === "email" ? (
            <EmailField
              value={email}
              error={errors.email}
              onChange={(next) => {
                setEmail(next);
                setErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
              }}
              required
            />
          ) : (
            <PhoneField
              value={phone}
              error={errors.phone}
              onChange={(next) => {
                setPhone(next);
                setErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
              }}
              required
            />
          )}

          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
            }}
            autoComplete="new-password"
            hint="Kamida 8 ta belgi. Parol serverda argon2id bilan xeshlanadi."
            error={errors.password}
          />

          {method === "email" ? (
            <PasswordField
              label="Parolni tasdiqlang"
              value={confirmPassword}
              onChange={(next) => {
                setConfirmPassword(next);
                setErrors((prev) =>
                  prev.confirmPassword ? { ...prev, confirmPassword: undefined } : prev,
                );
              }}
              autoComplete="new-password"
              error={errors.confirmPassword}
            />
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              trailingIcon={submitting ? undefined : <ArrowRight />}
            >
              {submitting ? "Yaratilmoqda…" : "Davom etish"}
            </Button>

            {formError ? (
              <AuthNotice live title="Hisob yaratilmadi">
                <p>{formError}</p>
              </AuthNotice>
            ) : null}

            <p className="text-center text-xs leading-relaxed text-ink-400">
              {method === "email"
                ? "Davom etish bilan hisobingiz yaratiladi va email manzilingizga tasdiqlash xati yuboriladi."
                : "Davom etish bilan hisobingiz yaratiladi va onboarding savollariga o‘tasiz."}
            </p>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-500">
        Hisobingiz bormi?{" "}
        <Link
          href="/login"
          className="rounded-md font-medium text-accent-700 transition-colors duration-fast hover:text-accent-500 focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35"
        >
          Kirish
        </Link>
      </p>
    </div>
  );
}
