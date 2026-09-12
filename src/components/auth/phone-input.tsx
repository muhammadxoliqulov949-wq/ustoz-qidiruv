"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui";
import { formatUzPhone, extractUzPhoneDigits } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* PhoneField — controlled +998 input. The country prefix is baked in: every     */
/* keystroke is reduced to the 9 subscriber digits and re-grouped as            */
/* "+998 XX XXX XX XX", so deletion/backspace can never corrupt the prefix      */
/* and any paste (+998 (90)…, 99890…, 90 123…) normalizes on entry.            */
/* Caret contract: because the displayed value is re-formatted on every input,  */
/* the caret is snapped to the END on focus and after each value change —       */
/* without this, a click/focus at position 0 would type digits into the prefix. */
/* The parent owns the formatted string; validation lives in lib/onboarding.   */
/* -------------------------------------------------------------------------- */

export interface PhoneFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}

export function PhoneField({
  value,
  onChange,
  label = "Telefon raqami",
  hint,
  error,
  required,
  autoComplete = "tel",
}: PhoneFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const snapToEnd = () => {
    const el = inputRef.current;
    if (!el) return;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end);
    }
  };

  // After every re-formatted push from state, keep the caret trailing the digits.
  useLayoutEffect(snapToEnd, [value]);

  return (
    <Input
      ref={inputRef}
      id={id}
      label={label}
      hint={hint ?? "O‘zbekiston mobil raqami — +998 XX XXX XX XX"}
      error={error}
      required={required}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      leadingIcon={<Phone />}
      placeholder="+998 90 123 45 67"
      value={value}
      onFocus={snapToEnd}
      onChange={(event) => onChange(formatUzPhone(extractUzPhoneDigits(event.target.value)))}
    />
  );
}
