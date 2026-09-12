"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { RoleChoice } from "@/components/auth/role-choice";
import { PrototypeNotice } from "@/components/auth/auth-page";
import { cn } from "@/lib/utils";
import {
  doneIndexFor,
  stepErrorsFor,
  stepsFor,
  type FieldErrors,
  type OnboardingDraft,
  type StudentAnswers,
  type TeacherAnswers,
  type UserRole,
} from "@/lib/onboarding";
import { useOnboardingDraft } from "./draft-store";
import { StepProgress } from "./step-progress";
import { StudentStep } from "./student-steps";
import { TeacherStep } from "./teacher-steps";
import { OnboardingComplete } from "./onboarding-complete";

/* -------------------------------------------------------------------------- */
/* OnboardingWizard — the multi-step flow over the prototype draft store.        */
/*   • role gate → per-role step list (lib/onboarding.ts) → completion          */
/*   • visible progress (bar + "n / total"), Back / Continue, Enter submits     */
/*   • step validation BEFORE advancing; errors inline + a polite live line     */
/*   • the furthest step persists to the prototype draft → refresh resumes      */
/*   • student steps are skippable (per step + whole flow); the teacher flow    */
/*     is required (profile quality) and deliberately has no skip               */
/* No API, no session: everything routes through the localStorage draft store.  */
/* The body mounts only after hydration (WizardBody), so the initial step is   */
/* derived from the hydrated draft — no effects, no setState-on-mount.         */
/* -------------------------------------------------------------------------- */

export interface OnboardingWizardProps {
  /** Whitelisted ?role= from the server — seeds the draft when undecided. */
  initialRole: UserRole | null;
  /** Validated internal ?next= — completion offers a route back (enrollment). */
  initialNext?: string | null;
  /** Server-resolved session presence — never inferred on the client. */
  signedIn?: boolean;
}

export function OnboardingWizard({ initialRole, initialNext = null, signedIn = false }: OnboardingWizardProps) {
  const { ready } = useOnboardingDraft();

  if (!ready) {
    // Placeholder until the storage snapshot flows in — guarantees the
    // server HTML and the first client paint match exactly.
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-1.5 rounded-pill bg-line" />
        <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
          <div className="flex animate-pulse flex-col gap-4">
            <div className="h-8 w-2/3 rounded-lg bg-ink-900/[0.06]" />
            <div className="h-24 rounded-lg bg-ink-900/[0.04]" />
            <div className="h-24 rounded-lg bg-ink-900/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  return <WizardBody initialRole={initialRole} initialNext={initialNext} signedIn={signedIn} />;
}

function WizardBody({ initialRole, initialNext, signedIn = false }: OnboardingWizardProps) {
  const { draft, update, reset } = useOnboardingDraft();
  // A decided draft always wins over ?role= — switching role mid-flow would
  // silently orphan the other flow's answers.
  const role: UserRole | null = draft.role ?? initialRole;
  const steps = stepsFor(role);
  const doneIdx = doneIndexFor(role);

  const [step, setStep] = useState<number>(() => {
    if (draft.completed) return doneIdx;
    return Math.max(0, Math.min(draft.furthest, doneIdx));
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [liveMessage, setLiveMessage] = useState("");
  const [gateRole, setGateRole] = useState<UserRole | null>(null);
  const [gateError, setGateError] = useState<string | undefined>(undefined);

  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /** Persist a mutation; the first write also adopts ?role= into the draft. */
  const apply = (mutate: (d: OnboardingDraft) => OnboardingDraft) =>
    update((d) => mutate(d.role === null && initialRole ? { ...d, role: initialRole } : d));

  /** Focus the step heading + glide the card under the sticky header.
   *  Plain page scroll only (scroll-mt handles the header offset) — never
   *  scrollIntoView inside rails (Phase 4 lesson). */
  const announceStep = () => {
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  /* ------------------------------ role gate ------------------------------ */

  if (role === null) {
    return (
      <div className="flex flex-col gap-4">
        <PrototypeNotice />
        <div className="rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-ink-900 outline-none"
          >
            Onboarding — kim uchun?
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Rolga qarab sizga faqat kerakli savollar beriladi.
          </p>
          <form
            className="mt-6 flex flex-col gap-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (gateRole === null) {
                setGateError("Rolni tanlang — o‘quvchimisiz yoki ustozmi?");
                return;
              }
              setGateError(undefined);
              update((d) => ({ ...d, role: gateRole, furthest: 0, completed: false }));
              setStep(0);
              setErrors({});
            }}
          >
            <RoleChoice
              value={gateRole}
              legend="Siz kimsiz?"
              error={gateError}
              onChange={(next) => {
                setGateRole(next);
                setGateError(undefined);
              }}
            />
            <Button type="submit" size="lg" fullWidth trailingIcon={<ArrowRight />}>
              Boshlash
            </Button>
          </form>
        </div>
      </div>
    );
  }

  /* ------------------------------ step shell ------------------------------ */

  const stepDef = steps[Math.min(step, doneIdx)];
  const isDone = step === doneIdx;
  const canSkipStep = role === "student" && !isDone && step > 0;

  const patchStudent = (patch: Partial<StudentAnswers>) =>
    apply((d) => ({ ...d, student: { ...d.student, ...patch } }));
  const patchTeacher = (patch: Partial<TeacherAnswers>) =>
    apply((d) => ({ ...d, teacher: { ...d.teacher, ...patch } }));

  const handleContinue = (event: React.FormEvent) => {
    event.preventDefault();
    const next = Math.min(step + 1, doneIdx);
    const stepErrors = stepErrorsFor(role, stepDef.id, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setLiveMessage("Iltimos, ushbu qadamdagi belgilangan maydonlarni to‘ldiring.");
      return;
    }
    setErrors({});
    setLiveMessage("");
    apply((d) => ({
      ...d,
      furthest: Math.max(d.furthest, next),
      completed: d.completed || next === doneIdx,
    }));
    setStep(next);
    announceStep();
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
    setErrors({});
    setLiveMessage("");
    announceStep();
  };

  /** Student-only: advance without answering this step (values stay empty). */
  const handleSkipStep = () => {
    const next = Math.min(step + 1, doneIdx);
    apply((d) => ({
      ...d,
      furthest: Math.max(d.furthest, next),
      completed: d.completed || next === doneIdx,
    }));
    setStep(next);
    setErrors({});
    setLiveMessage("");
    announceStep();
  };

  /** Student-only: jump straight to the completion screen. */
  const handleSkipAll = () => {
    apply((d) => ({ ...d, skipped: true, completed: true, furthest: doneIdx }));
    setStep(doneIdx);
    setErrors({});
    announceStep();
  };

  /** Forget the prototype draft (UI-state reset — not an account operation). */
  const handleRestart = () => {
    reset();
    setStep(0);
    setErrors({});
    setLiveMessage("");
    setGateRole(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <PrototypeNotice />

      <div className="flex items-center justify-between gap-4">
        <StepProgress
          index={Math.min(step, doneIdx)}
          total={steps.length}
          className="min-w-0 flex-1"
        />
        {role === "student" && !isDone ? (
          <button
            type="button"
            onClick={handleSkipAll}
            className={cn(
              "shrink-0 rounded-md px-1.5 py-1 text-sm font-medium text-ink-500",
              "transition-colors duration-fast hover:text-ink-900",
              "focus-visible:outline-none focus-visible:ring-[length:var(--size-focus-ring)] focus-visible:ring-accent-600/35",
            )}
          >
            Butunlay o‘tkazish
          </button>
        ) : null}
      </div>

      <div
        ref={cardRef}
        className={cn(
          "scroll-mt-[calc(var(--height-header)+1.5rem)] rounded-xl border border-line bg-surface p-5 shadow-xs",
          "sm:p-6",
        )}
      >
        <header className="flex flex-col gap-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-ink-900 outline-none"
          >
            {stepDef.title}
          </h1>
          <p className="text-sm text-ink-500">{stepDef.hint}</p>
        </header>

        {isDone ? (
          <div className="mt-6">
            <OnboardingComplete
              role={role}
              onRestart={handleRestart}
              signedIn={signedIn}
              resumeHref={initialNext}
            />
          </div>
        ) : (
          <form onSubmit={handleContinue} noValidate>
            <div className="mt-6">
              {role === "student" ? (
                <StudentStep
                  stepId={stepDef.id}
                  answers={draft.student}
                  errors={errors}
                  onChange={patchStudent}
                />
              ) : (
                <TeacherStep
                  stepId={stepDef.id}
                  answers={draft.teacher}
                  errors={errors}
                  onChange={patchTeacher}
                />
              )}
            </div>

            <p role="status" aria-live="polite" className="mt-3 text-sm text-danger">
              {liveMessage}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button
                type="button"
                variant="outline"
                leadingIcon={<ArrowLeft />}
                onClick={handleBack}
                disabled={step === 0}
              >
                Orqaga
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {canSkipStep ? (
                  <Button type="button" variant="ghost" onClick={handleSkipStep}>
                    O‘tkazish
                  </Button>
                ) : null}
                <Button type="submit" trailingIcon={<ArrowRight />}>
                  {step === doneIdx - 1 ? "Yakunlash" : "Davom etish"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
