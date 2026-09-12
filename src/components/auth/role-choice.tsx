"use client";

import { GraduationCap, Presentation } from "lucide-react";
import { RadioCardGroup } from "@/components/ui/radio-card";
import type { UserRole } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* RoleChoice — thin wrapper: the two product roles (RadioCardGroup skin).      */
/* Used on /register and at the /onboarding role gate so both entry points      */
/* present the exact same decision UI. The role decision is a first-class      */
/* two-card choice — never a dropdown (Phase 6 spec).                          */
/* -------------------------------------------------------------------------- */

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "O‘quvchi",
  teacher: "Ustoz",
};

const ROLE_OPTIONS = [
  {
    value: "student",
    label: "O‘quvchiman",
    description: "Kurs va ustozlarni qidiraman, o‘zim uchun mosini topib o‘qiyman.",
    icon: GraduationCap,
  },
  {
    value: "teacher",
    label: "Ustozman",
    description: "Dars beraman — profil yarataman va keyinchalik kurs joylashtiraman.",
    icon: Presentation,
  },
];

export interface RoleChoiceProps {
  value: UserRole | null;
  onChange: (role: UserRole) => void;
  legend?: string;
  error?: string;
  /** Narrow form contexts (register card) read better stacked; default 2. */
  columns?: 1 | 2;
}

export function RoleChoice({
  value,
  onChange,
  legend = "Siz kimsiz?",
  error,
  columns = 2,
}: RoleChoiceProps) {
  return (
    <RadioCardGroup
      legend={legend}
      value={value}
      onChange={(next) => onChange(next as UserRole)}
      options={ROLE_OPTIONS}
      columns={columns}
      error={error}
    />
  );
}
