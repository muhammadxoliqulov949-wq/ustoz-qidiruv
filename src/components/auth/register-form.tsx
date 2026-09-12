"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { PhoneField } from "./phone-input";
import { PasswordField } from "./password-input";
import { RoleChoice } from "./role-choice";
import { AuthNotice } from "./auth-notice";
import {
  emptyDraft,
  validateName,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/onboarding";
import { withNext } from "@/lib/safe-next";
import {
  readPrototypeDraft,
  usePrototypeDraftHydrated,
  writePrototypeDraft,
} from "@/components/onboarding/draft-store";

/* -------------------------------------------------------------------------- */
/* RegisterForm — role-aware sign-up, intentionally minimal: role + name +      */
/* phone + password. No teacher professional details here — those belong to    */
/* teacher onboarding (Phase 6 spec). Submit does NOT create an account: it     */
/* validates, writes the prototype onboarding draft (role/name/phone only —   */
/* passwords are never persisted), and hands off to /onboarding where the      */
/* flow completes as a UI state.                                               */
/* -------------------------------------------------------------------------- */

interface FieldErrors {
  role?: string;
  name?: string;
  phone?: string;
  password?: string;
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
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher" | null>(initialRole);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone ?? "+998");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // Hydration-safe peek (useSyncExternalStore in the draft store): this
  // browser already holds a (prototype) onboarding draft → offer to resume
  // it. No state is synced here — the banner appears after mount only.
  const hydrated = usePrototypeDraftHydrated();
  const pendingDraft = useMemo(() => {
    if (!hydrated) return null;
    const draft = readPrototypeDraft();
    if (draft && (draft.role !== null || draft.student.name || draft.teacher.name))
      return draft;
    return null;
  }, [hydrated]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (role === null && readPrototypeDraft()?.role == null)
      nextErrors.role = "Rolni tanlang — o‘quvchimisiz yoki ustozmi?";
    const nameError = validateName(name);
    if (nameError) nextErrors.name = nameError;
    const phoneError = validatePhoneField(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const passwordError = validatePasswordField(password);
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Seed the onboarding draft (never the password). Existing answers in a
    // pending draft are preserved — only identity fields are refreshed. A
    // returning user who left the selector untouched keeps their stored role.
    const base = readPrototypeDraft() ?? emptyDraft();
    const finalRole = role ?? base.role;
    if (finalRole === null) {
      setErrors({ role: "Rolni tanlang — o‘quvchimisiz yoki ustozmi?" });
      return;
    }
    const nextDraft = {
      ...base,
      role: finalRole,
      student: { ...base.student, name: base.student.name || name.trim(), phone },
      teacher: { ...base.teacher, name: base.teacher.name || name.trim(), phone },
    };
    writePrototypeDraft(nextDraft);
    router.push(withNext("/onboarding", initialNext));
  };

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
          mumkin. Qayta ro‘yxatdan o‘tsangiz faqat ism, telefon va rol yangilanadi.
        </AuthNotice>
      ) : null}

      <Card>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <RoleChoice
            columns={1}
            value={role}
            onChange={(next) => {
              setRole(next);
              setErrors((prev) => (prev.role ? { ...prev, role: undefined } : prev));
            }}
            error={errors.role}
          />

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
          />

          <PhoneField
            value={phone}
            error={errors.phone}
            onChange={(next) => {
              setPhone(next);
              setErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
            }}
          />

          <PasswordField
            value={password}
            onChange={(next) => {
              setPassword(next);
              setErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
            }}
            autoComplete="new-password"
            hint="Parol hozircha faqat shu oynada tekshiriladi — u hech qayerda saqlanmaydi."
            error={errors.password}
          />

          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" fullWidth trailingIcon={<ArrowRight />}>
              Davom etish
            </Button>
            <p className="text-center text-xs leading-relaxed text-ink-400">
              Hisob yaratish server tomonida hali ishga tushmagan. Davom etish
              onboarding interfeysiga olib kiradi — ma’lumotlar faqat
              brauzeringizdagi vaqtinchalik holatda saqlanadi.
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
