"use client";

import { Mail } from "lucide-react";
import { Input } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* EmailField — the OPERATOR identifier field (admin login).                    */
/*                                                                              */
/* Same skin as PhoneField: both wrap the one Input primitive, so a login form  */
/* never re-declares field chrome. The behavioural difference is deliberate —   */
/* there is NO per-keystroke reformatting here. A phone number has a grouping   */
/* worth preserving; an email address does not, and rewriting what somebody is  */
/* typing would only fight the keyboard. Normalization (trim + lowercase)       */
/* happens once, in lib/email.ts, on the way to the server — and the server     */
/* does it again, because the client is never trusted.                          */
/*                                                                              */
/* autoComplete is "username", not "email": this field is a LOGIN identifier,   */
/* which is what password managers key on, and it must not be autofilled with   */
/* a marketplace contact address.                                               */
/* -------------------------------------------------------------------------- */

export interface EmailFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}

export function EmailField({
  value,
  onChange,
  label = "Email",
  hint,
  error,
  required,
  autoComplete = "username",
}: EmailFieldProps) {
  return (
    <Input
      label={label}
      hint={hint ?? "Operator hisobi — email va parol bilan kiriladi"}
      error={error}
      required={required}
      type="email"
      inputMode="email"
      autoComplete={autoComplete}
      leadingIcon={<Mail />}
      placeholder="operator@ustoz.uz"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
