"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { StepProgress } from "@/components/onboarding/step-progress";
import { cn, focusRing } from "@/lib/utils";
import {
  buildEnrollHref,
  emptyEnrollDraft,
  ENROLL_DONE_INDEX,
  ENROLL_STEPS,
  enrollStepErrors,
  resolveEnrollGroup,
  type EnrollCourseLite,
  type EnrollFieldErrors,
} from "@/lib/enroll";
import { useEnrollStore } from "./enroll-store";
import { EnrollSummary } from "./enroll-summary";
import { GroupNotice, StepGroup, StepReview, StepSchedule, StepStudent } from "./enroll-steps";
import { submitEnrollmentRequestAction } from "@/server/actions/enrollment";
import { EnrollResult } from "./enroll-result";

/* -------------------------------------------------------------------------- */
/* EnrollFlow — the focused 4-step wizard (+ honest result) over /enroll/[slug]. */
/*   • course and group come from the URL (server-resolved props) — the draft    */
/*     only remembers picks/fields; invalid URL input never gets swapped         */
/*     silently (GroupNotice explains, selection stays empty);                   */
/*   • changing a group router.replace()s ?group= (shareable, same no-history   */
/*     rule as the detail page) so back/forward only moves between pages;        */
/*   • progress, Back / Continue, Enter-submit, focus the new step heading;     */
/*   • review edits jump back WITHOUT losing data (draft owns the values);      */
/*   • Phase 11: when a STUDENT session exists (resolved on the server and       */
/*     passed in as `canSubmitToServer`), submitting performs a REAL            */
/*     transactional write of an EnrollmentRequest row. Otherwise the flow      */
/*     keeps its honest Phase 7 local-only behaviour instead of pretending.     */
/*   • submitting on review flips a UI-state flag only — the result screen       */
/*     states plainly that nothing was sent.                                     */
/* The body mounts after hydration (like Phase 6), so initial state derives      */
/* from the live draft with no effects-flicker and no setState-in-effect.         */
/* -------------------------------------------------------------------------- */

export interface EnrollFlowProps {
  course: EnrollCourseLite;
  /** Canonical course id — needed for the real server write. */
  courseId: string;
  /** True only when the SERVER resolved a signed-in STUDENT session. */
  canSubmitToServer?: boolean;
  /** Raw ?group= search param (string) or null — resolveEnrollGroup applies
   *  the SAME pure rules on server and client, so no pre-filtering is needed. */
  requestedGroupId: string | null;
}

export function EnrollFlow(props: EnrollFlowProps) {
  const { ready } = useEnrollStore(props.course.slug);
  if (!ready) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-1.5 rounded-pill bg-line" />
        <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
          <div className="flex animate-pulse flex-col gap-4">
            <div className="h-8 w-1/2 rounded-lg bg-ink-900/[0.06]" />
            <div className="h-40 rounded-lg bg-ink-900/[0.04]" />
          </div>
        </div>
      </div>
    );
  }
  return <EnrollFlowBody {...props} />;
}

function EnrollFlowBody({
  course,
  courseId,
  canSubmitToServer = false,
  requestedGroupId,
}: EnrollFlowProps) {
  const { draft, update, reset, prefillFromOnboarding } = useEnrollStore(course.slug);
  const router = useRouter();
  const live = draft ?? emptyEnrollDraft(course.slug);

  // URL first, then the remembered pick — one resolution, shared everywhere.
  const resolution = resolveEnrollGroup(course.groups, requestedGroupId, draft?.groupId ?? null);
  const selectedGroup =
    course.groups.find((group) => group.id === resolution.selectedGroupId) ?? null;

  const [step, setStep] = useState<number>(() => {
    // The done screen is only ever a resume target for an ACTUAL submit
    // (editing afterwards clears `submitted`, so refresh returns to review).
    if (draft?.submitted) return ENROLL_DONE_INDEX;
    return Math.max(0, Math.min(draft?.furthest ?? 0, ENROLL_DONE_INDEX - 1));
  });
  const [errors, setErrors] = useState<EnrollFieldErrors>({});
  const [liveMessage, setLiveMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Seed name/phone from the onboarding PROTOTYPE draft exactly once per visit.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    prefilledRef.current = true;
    prefillFromOnboarding();
  }, [prefillFromOnboarding]);

  const announce = useCallback(() => {
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      setStep(next);
      setErrors({});
      setLiveMessage("");
      announce();
    },
    [announce],
  );

  const patch = (partial: Partial<typeof live>) => update((d) => ({ ...d, ...partial }));

  const selectGroup = (groupId: string) => {
    update((d) => ({ ...d, groupId }));
    router.replace(buildEnrollHref(course, groupId), { scroll: false });
  };

  const advanceFrom = (current: number) => {
    const stepDef = ENROLL_STEPS[current];
    const stepErrors = enrollStepErrors(stepDef.id, live, resolution.selectedGroupId);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setLiveMessage("Iltimos, belgilangan maydonlarni to‘ldiring.");
      return;
    }
    const next = Math.min(current + 1, ENROLL_DONE_INDEX);
    update((d) => ({ ...d, furthest: Math.max(d.furthest, next) }));
    goTo(next);
  };

  const handleSubmit = () => {
    // Defense-in-depth: if the URL/draft was changed elsewhere, route back to
    // the offending step instead of showing a result over invalid data.
    if (resolution.selectedGroupId === null) {
      goTo(0);
      return;
    }
    const studentErrors = enrollStepErrors("student", live, resolution.selectedGroupId);
    if (Object.keys(studentErrors).length > 0) {
      setErrors(studentErrors);
      goTo(1);
      return;
    }
    setSubmitting(true);
    setServerError(null);

    if (!canSubmitToServer) {
      // No student session → no server write, and the result screen says so.
      timerRef.current = setTimeout(() => {
        setSubmitting(false);
        update((d) => ({ ...d, submitted: true, furthest: ENROLL_DONE_INDEX }));
        goTo(ENROLL_DONE_INDEX);
      }, 700);
      return;
    }

    void (async () => {
      const payload = new FormData();
      payload.set("courseId", courseId);
      payload.set("groupId", resolution.selectedGroupId as string);
      payload.set("note", live.note);
      try {
        const result = await submitEnrollmentRequestAction(payload);
        setSubmitting(false);
        if (result.ok || result.code === "duplicate_request") {
          update((d) => ({ ...d, submitted: true, furthest: ENROLL_DONE_INDEX }));
          goTo(ENROLL_DONE_INDEX);
          router.refresh();
        } else {
          setServerError(result.message);
        }
      } catch {
        setSubmitting(false);
        setServerError("So‘rov yuborilmadi. Internetni tekshirib, qayta urining.");
      }
    })();
  };

  const handleContinue = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 3) {
      handleSubmit();
      return;
    }
    advanceFrom(step);
  };

  const editAgain = () => {
    update((d) => ({ ...d, submitted: false }));
    goTo(0);
  };

  const clearAll = () => {
    reset();
    goTo(0);
  };

  const stepDef = ENROLL_STEPS[Math.min(step, ENROLL_DONE_INDEX)];
  const isDone = step === ENROLL_DONE_INDEX;
  const stepProps = {
    course,
    group: selectedGroup,
    draft: live,
    errors,
    patch,
    onEdit: goTo,
    onSelectGroup: selectGroup,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Flow context — course stays reachable, marketing stays out of the way */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/courses/${course.slug}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-ink-500",
            "transition-colors duration-fast hover:text-ink-900",
            focusRing,
          )}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Kurs sahifasiga qaytish
        </Link>
        {/* Honest, session-derived label — no blanket "prototype" claim now
            that a signed-in student's request is really persisted. */}
        <Badge variant="neutral">
          <span aria-hidden="true" className="size-1.5 rounded-pill bg-warning" />
          {canSubmitToServer ? "To‘lovsiz so‘rov" : "Kirish talab qilinadi"}
        </Badge>
      </div>

      <StepProgress
        index={Math.min(step, ENROLL_DONE_INDEX)}
        total={ENROLL_STEPS.length}
        className="max-w-md"
      />

      {/* Single summary tree: FIRST in DOM (top of the mobile flow, always
          showing what is being booked); on desktop it becomes the right
          sticky rail via grid order. No duplicated markup, no drift. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
        <div className="lg:sticky lg:top-[calc(var(--height-header)+1.5rem)] lg:order-2 lg:max-h-[calc(100dvh-var(--height-header)-3rem)] lg:overflow-y-auto">
          <EnrollSummary course={course} group={selectedGroup} />
        </div>

        <div
          ref={cardRef}
          className={cn(
            "scroll-mt-[calc(var(--height-header)+1.5rem)] rounded-xl border border-line bg-surface p-5 shadow-xs",
            "sm:p-6 lg:order-1",
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
              <EnrollResult
                course={course}
                group={selectedGroup}
                draft={live}
                persisted={canSubmitToServer}
                onEditAgain={editAgain}
                onClear={clearAll}
              />
            </div>
          ) : (
            <form onSubmit={handleContinue} noValidate>
              <div className="mt-6 flex flex-col gap-4">
                {serverError ? (
                  <p role="alert" className="rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-danger">
                    {serverError}
                  </p>
                ) : null}
                {step === 0 && resolution.requestedUnknown ? (
                  <GroupNotice kind="unknown" />
                ) : null}
                {step === 0 && resolution.requestedFull ? <GroupNotice kind="full" /> : null}

                {step === 0 ? <StepGroup {...stepProps} /> : null}
                {step === 1 ? <StepStudent {...stepProps} /> : null}
                {step === 2 ? <StepSchedule {...stepProps} /> : null}
                {step === 3 ? <StepReview {...stepProps} /> : null}
              </div>

              <p role="status" aria-live="polite" className="mt-3 text-sm text-danger">
                {liveMessage}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <Button
                  type="button"
                  variant="outline"
                  leadingIcon={<ArrowLeft />}
                  onClick={() => goTo(Math.max(0, step - 1))}
                  disabled={step === 0}
                >
                  Orqaga
                </Button>
                <Button
                  type="submit"
                  trailingIcon={step === 3 && submitting ? undefined : <ArrowRight />}
                  loading={submitting}
                >
                  {submitting
                    ? "Tayyorlanmoqda…"
                    : step === 2
                      ? "So‘rovni ko‘rib chiqish"
                      : step === 3
                        ? "So‘rovni yuborish"
                        : "Davom etish"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
