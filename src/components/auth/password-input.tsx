"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* PasswordField — the Input skin + a show/hide toggle. The toggle is a real    */
/* button with its own accessible name and press state; visibility is UI-only   */
/* (the value never changes when toggling, so reveal is announced to SRs).     */
/* -------------------------------------------------------------------------- */

export interface PasswordFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  /** "current-password" for login, "new-password" for registration. */
  autoComplete: "current-password" | "new-password";
}

export function PasswordField({
  value,
  onChange,
  label = "Parol",
  hint,
  error,
  autoComplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      label={label}
      hint={hint}
      error={error}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      leadingIcon={<Lock />}
      placeholder={visible ? "" : "••••••••"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      trailingSlot={
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-pressed={visible}
          aria-label={visible ? "Parolni yashirish" : "Parolni ko‘rsatish"}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md text-ink-400",
            "transition-colors duration-fast hover:text-ink-700",
            "focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
          )}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-[18px]" />
          ) : (
            <Eye aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      }
    />
  );
}
