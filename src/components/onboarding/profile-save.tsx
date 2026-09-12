"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { useOnboardingDraft } from "./draft-store";
import { saveStudentProfileAction, saveTeacherProfileAction } from "@/server/actions/profile";
import type { UserRole } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* ProfileSave — the bridge from the Phase 6 localStorage draft to the REAL     */
/* profile row (Phase 11).                                                      */
/*                                                                              */
/* Design decisions:                                                            */
/*  • The save is EXPLICIT (a button), not an effect. An auto-POST on mount     */
/*    would fire on every refresh and would silently overwrite a profile the    */
/*    user edited elsewhere.                                                    */
/*  • Only whitelisted answer fields are sent — the draft object is never       */
/*    handed to the server wholesale, so a tampered localStorage value cannot   */
/*    smuggle `role`, `verification` or a user id into the write (the server    */
/*    schema is `.strict()` and would reject it anyway).                        */
/*  • Identity comes from the session cookie on the server. The draft's own     */
/*    name/phone fields are treated as form content, never as credentials.      */
/*  • Anonymous visitors don't see this at all; the flow stays a preview.       */
/*  • The result is announced in a live region for screen readers.              */
/* -------------------------------------------------------------------------- */

export function ProfileSave({ role }: { role: UserRole }) {
  const { draft } = useOnboardingDraft();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const payload = new FormData();
      payload.set("onboardingCompleted", "1");
      let result;
      if (role === "student") {
        const answers = draft.student;
        payload.set("name", answers.name);
        payload.set("city", answers.city ?? "");
        payload.set("preferredFormat", answers.format ?? "");
        for (const language of answers.languages) payload.append("languages", language);
        for (const interest of answers.interests) payload.append("interests", interest);
        result = await saveStudentProfileAction(payload);
      } else {
        const answers = draft.teacher;
        payload.set("name", answers.name);
        payload.set("city", answers.city ?? "");
        payload.set("district", answers.district);
        payload.set(
          "experienceYears",
          answers.experienceYears === null ? "" : String(answers.experienceYears),
        );
        payload.set("bio", answers.bio);
        payload.set("approach", answers.approach);
        for (const category of answers.categories) payload.append("categories", category);
        for (const level of answers.levels) payload.append("levels", level);
        for (const format of answers.formats) payload.append("formats", format);
        for (const language of answers.languages) payload.append("languages", language);
        result = await saveTeacherProfileAction(payload);
      }

      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.message);
      }
    });
  };

  if (saved) {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted p-4 text-sm leading-relaxed text-ink-700"
      >
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-700" />
        <p>
          Profil saqlandi. Endi bu ma’lumotlar hisobingizga bog‘langan va
          kabinetingizda ko‘rinadi.
          {role === "teacher"
            ? " Tasdiqlash holati hozircha “tasdiqlanmagan” bo‘lib qoladi — uni o‘zingiz o‘zgartira olmaysiz."
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button type="button" size="lg" fullWidth loading={pending} onClick={handleSave}>
        {pending ? "Saqlanmoqda…" : "Profilni saqlash"}
      </Button>
      {error ? (
        <AuthNotice live title="Saqlanmadi">
          <p>{error}</p>
        </AuthNotice>
      ) : null}
    </div>
  );
}
