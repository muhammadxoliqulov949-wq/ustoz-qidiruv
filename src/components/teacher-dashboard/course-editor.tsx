"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { AuthNotice } from "@/components/auth/auth-notice";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StepProgress } from "@/components/onboarding/step-progress";
import { formatDateUz } from "@/components/course-detail/date";
import { cn, focusRing } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  COURSE_DRAFT_STATUS_LABELS,
  COURSE_REVIEW_INDEX,
  COURSE_STEPS,
  courseDraftReview,
  courseStepErrors,
  courseStepIndex,
  courseStepStatus,
  emptyCourseDraft,
  findOwnedDraft,
  isCourseDraftComplete,
  type CourseDraft,
  type CourseFieldErrors,
  type CourseStepId,
} from "@/lib/course-draft";
import { authoringLabel, type CourseAuthoringOptions } from "@/data/course-authoring";
import { useTeacherWorkspace } from "./workspace-store";
import { useCourseDraftStore } from "./course-draft-store";
import {
  StepBasics,
  StepDetail,
  StepFormat,
  StepGroups,
  StepPrice,
  StepSyllabus,
} from "./course-step-forms";
import { CourseReviewView } from "./course-review";

/* -------------------------------------------------------------------------- */
/* CourseEditor — the Phase 10 authoring island.                                */
/*                                                                              */
/*   • ownership first: it reads the Phase 9 prototype workspace id and asks    */
/*     findOwnedDraft() for the draft. A draft belonging to another teacher is  */
/*     indistinguishable from a non-existent one — same honest "not found".     */
/*   • steps are local UI state; ALL data lives in the versioned draft store,   */
/*     so refresh, route change and browser restart resume exactly where the    */
/*     teacher left off.                                                        */
/*   • validation is the pure courseStepErrors(); the review step is gated      */
/*     behind every editing step being clean, so structurally invalid data      */
/*     can never reach review.                                                  */
/*   • nothing is published: the final action stores the draft locally and      */
/*     flips an honest "ko‘rib chiqishga tayyor" flag.                          */
/* -------------------------------------------------------------------------- */

export interface CourseEditorProps {
  /** null = create a fresh draft for the current workspace. */
  draftId: string | null;
  options: CourseAuthoringOptions;
  /** Compact id→name pairs so the review shows the owning teacher without
   *  shipping the whole teacher directory into this island. */
  teachers: { id: string; name: string }[];
}

export function CourseEditor(props: CourseEditorProps) {
  const workspace = useTeacherWorkspace();
  const drafts = useCourseDraftStore();

  // Hydration-stable placeholder (Phase 8/9 CLS lesson): same height as the
  // resolved editor card, so nothing jumps when storage is read.
  if (!workspace.ready || !drafts.ready) {
    return (
      <div className="flex min-h-[46rem] flex-col gap-4" aria-busy="true">
        <div className="h-1.5 rounded-pill bg-line" />
        <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
          <p className="text-base text-ink-500" role="status">
            Brauzer holati o‘qilmoqda…
          </p>
        </div>
      </div>
    );
  }

  return <CourseEditorBody {...props} />;
}

function CourseEditorBody({ draftId, options, teachers }: CourseEditorProps) {
  const { teacherId } = useTeacherWorkspace();
  const { store, create, update, remove } = useCourseDraftStore();
  const router = useRouter();

  const draft = useMemo(
    () => (draftId === null ? null : findOwnedDraft(store, teacherId, draftId)),
    [store, teacherId, draftId],
  );

  // Creating: make the local draft once, then move to its stable edit URL so a
  // refresh resumes the same draft instead of creating another one.
  const createdRef = useRef(false);
  useEffect(() => {
    if (draftId !== null || teacherId === null || createdRef.current) return;
    createdRef.current = true;
    const fresh = emptyCourseDraft(teacherId, new Date().toISOString());
    create(fresh);
    router.replace(`/teacher/dashboard/courses/${fresh.id}/edit`);
  }, [draftId, teacherId, create, router]);

  if (teacherId === null) {
    return (
      <div className="flex min-h-[30rem] flex-col gap-4">
        <AuthNotice variant="warning" title="Ish maydoni tanlanmagan">
          Kurs qoralamasi qaysidir ustozga tegishli bo‘lishi kerak. Hisob va
          autentifikatsiya yo‘q, shuning uchun avval yon menyudan prototip ish
          maydonini tanlang — qoralama o‘sha ustozga bog‘lanadi.
        </AuthNotice>
        <EmptyState title="Avval ustozni tanlang" as="h2">
          Tanlamasdan kurs yaratib bo‘lmaydi: aks holda qoralama tasodifiy
          ustozning nomidan yaratilgandek ko‘rinardi.
          <p className="mt-3">
            <Link
              href="/teacher/dashboard/courses"
              className="font-medium text-accent-700 underline underline-offset-2"
            >
              Kurslarim bo‘limiga qaytish
            </Link>
          </p>
        </EmptyState>
      </div>
    );
  }

  if (draft === null) {
    if (draftId === null) {
      return (
        <div className="min-h-[30rem]" aria-busy="true">
          <p className="text-base text-ink-500" role="status">
            Yangi qoralama tayyorlanmoqda…
          </p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[30rem] flex-col gap-4">
        <AuthNotice variant="warning" title="Qoralama topilmadi">
          Bu identifikator bo‘yicha shu brauzerda, shu ish maydoniga tegishli
          qoralama yo‘q. U o‘chirilgan, boshqa qurilmada yaratilgan yoki boshqa
          ustozga tegishli bo‘lishi mumkin — boshqa ustozning qoralamasi bu
          yerda ochilmaydi.
        </AuthNotice>
        <EmptyState title="Qoralamani ochib bo‘lmadi" as="h2">
          Ro‘yxatdan mavjud qoralamani oching yoki yangisini yarating.
          <span className="mt-4 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/teacher/dashboard/courses" variant="outline" size="sm">
              Kurslarim
            </ButtonLink>
            <ButtonLink href="/teacher/dashboard/courses/new" size="sm">
              Yangi kurs yaratish
            </ButtonLink>
          </span>
        </EmptyState>
      </div>
    );
  }

  return (
    <EditorForm
      key={draft.id}
      draft={draft}
      options={options}
      teacherName={
        teachers.find((teacher) => teacher.id === draft.teacherId)?.name ??
        "Noma’lum ustoz"
      }
      onPatch={(partial) => update(draft.id, (current) => ({ ...current, ...partial }))}
      onRemove={() => {
        remove(draft.id);
        router.replace("/teacher/dashboard/courses");
      }}
    />
  );
}

/* ---------------------------------- form ----------------------------------- */

function EditorForm({
  draft,
  options,
  teacherName,
  onPatch,
  onRemove,
}: {
  draft: CourseDraft;
  options: CourseAuthoringOptions;
  teacherName: string;
  onPatch: (partial: Partial<CourseDraft>) => void;
  onRemove: () => void;
}) {
  // Deep link: ?step=review opens the read-only review directly ("Ko‘rish"),
  // but only when the draft actually validates — an invalid draft can never
  // land on review, by URL or otherwise.
  const requestedStep = useSearchParams().get("step");
  const [step, setStep] = useState(() =>
    requestedStep === "review" && isCourseDraftComplete(draft) ? COURSE_REVIEW_INDEX : 0,
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const movedRef = useRef(false);

  const current = COURSE_STEPS[step];
  const isReview = current.id === "review";

  const stepErrors: CourseFieldErrors = useMemo(
    () => (isReview ? {} : courseStepErrors(draft, current.id)),
    [draft, current.id, isReview],
  );
  const shownErrors = touched[current.id] ? stepErrors : {};
  const statuses = useMemo(() => courseStepStatus(draft), [draft]);
  const complete = isCourseDraftComplete(draft);

  // Focus the new step heading — the standard Phase 6/7 step-change behaviour.
  useEffect(() => {
    if (!movedRef.current) return;
    movedRef.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);

  const goTo = useCallback((next: number) => {
    movedRef.current = true;
    setStep(Math.max(0, Math.min(next, COURSE_REVIEW_INDEX)));
  }, []);

  const goToStepId = useCallback(
    (id: CourseStepId) => goTo(courseStepIndex(id)),
    [goTo],
  );

  const next = () => {
    if (Object.keys(stepErrors).length > 0) {
      setTouched((t) => ({ ...t, [current.id]: true }));
      return;
    }
    goTo(step + 1);
  };

  const review = useMemo(
    () =>
      courseDraftReview(draft, teacherName, {
        category: authoringLabel(options.categories, draft.categoryId),
        level: authoringLabel(options.levels, draft.level),
        format: authoringLabel(options.formats, draft.format),
        city: authoringLabel(options.cities, draft.city),
        languages: draft.teachingLanguages.map(
          (tag) => authoringLabel(options.languages, tag) ?? tag,
        ),
        price:
          draft.pricing === "free"
            ? "Bepul"
            : draft.priceUzs === null
              ? "Kiritilmagan"
              : `${formatPrice(draft.priceUzs)} / oyiga`,
      }),
    [draft, options, teacherName],
  );

  const formProps = {
    draft,
    errors: shownErrors,
    patch: onPatch,
    options,
  };

  return (
    <div className="flex flex-col gap-5">
      <StepProgress index={step} total={COURSE_STEPS.length} />

      {/* Step switcher: real links-as-buttons, keyboard operable, current step
          marked with aria-current and a text status (never color alone). */}
      <nav aria-label="Kurs yaratish qadamlari">
        <ol className="flex snap-x gap-2 overflow-x-auto pb-1">
          {COURSE_STEPS.map((definition, index) => {
            const status = statuses.find((item) => item.id === definition.id);
            const invalid = status !== undefined && status.errorCount > 0;
            const active = index === step;
            const blocked = definition.id === "review" && !complete;
            return (
              <li key={definition.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  disabled={blocked}
                  onClick={() => goTo(index)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm font-medium",
                    focusRing,
                    active
                      ? "border-accent-600 bg-accent-50 text-accent-700"
                      : "border-line-strong bg-surface text-ink-700 hover:border-ink-300",
                    blocked && "opacity-55",
                  )}
                >
                  <span className="tabular-nums">{index + 1}.</span>
                  {definition.title}
                  {definition.id !== "review" ? (
                    invalid ? (
                      <span className="text-xs font-normal text-ink-500">
                        to‘ldirilmagan
                      </span>
                    ) : (
                      <Check aria-hidden="true" className="size-3.5" />
                    )
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-ink-900 outline-none"
          >
            {current.title}
          </h2>
          <p className="text-sm text-ink-500">{current.hint}</p>
        </div>

        {current.id === "basics" ? <StepBasics {...formProps} /> : null}
        {current.id === "format" ? <StepFormat {...formProps} /> : null}
        {current.id === "price" ? <StepPrice {...formProps} /> : null}
        {current.id === "groups" ? <StepGroups {...formProps} /> : null}
        {current.id === "syllabus" ? <StepSyllabus {...formProps} /> : null}
        {current.id === "detail" ? <StepDetail {...formProps} /> : null}

        {isReview ? (
          <CourseReviewView
            review={review}
            onEditStep={goToStepId}
            startDateLabel={formatDateUz}
          />
        ) : null}

        {!isReview && touched[current.id] && Object.keys(stepErrors).length > 0 ? (
          <p className="text-sm text-danger" role="alert">
            Bu qadamda to‘ldirilmagan yoki noto‘g‘ri maydonlar bor — yuqoridagi
            izohlarga qarang.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button
            variant="outline"
            disabled={step === 0}
            leadingIcon={<ArrowLeft aria-hidden="true" />}
            onClick={() => goTo(step - 1)}
          >
            Orqaga
          </Button>

          {isReview ? (
            <Button
              disabled={!complete}
              onClick={() =>
                onPatch({ status: complete ? "ready" : "draft" })
              }
            >
              Ko‘rib chiqishga tayyor deb belgilash
            </Button>
          ) : (
            <Button trailingIcon={<ArrowRight aria-hidden="true" />} onClick={next}>
              Davom etish
            </Button>
          )}

          <span className="ms-auto flex items-center gap-2 text-sm text-ink-500">
            <Badge variant={draft.status === "ready" ? "success" : "neutral"}>
              {COURSE_DRAFT_STATUS_LABELS[draft.status]}
            </Badge>
            Avtomatik saqlanadi (shu brauzerda)
          </span>
        </div>
      </Card>

      {draft.status === "ready" ? (
        <AuthNotice title="Qoralama “ko‘rib chiqishga tayyor” deb belgilandi">
          Bu holat faqat sizning brauzeringizdagi belgi. Kurs katalogda
          chiqmagan, moderatsiyaga yuborilmagan va o‘quvchilar uni ko‘rmaydi.
          Haqiqiy e’lon qilish backend bilan birga keladi.{" "}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPatch({ status: "draft" })}
          >
            Qoralamaga qaytarish
          </Button>
        </AuthNotice>
      ) : null}

      {/* Local-only deletion, explicitly labelled as such. */}
      <Card className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-ink-900">
          Mahalliy qoralamani o‘chirish
        </h3>
        <p className="text-sm text-ink-500">
          Faqat shu brauzerdagi qoralama o‘chadi. Katalogdagi hech qanday kursga
          ta’sir qilmaydi.
        </p>
        <div className="flex flex-wrap gap-2">
          {confirmRemove ? (
            <>
              <Button variant="danger" size="sm" onClick={onRemove}>
                Ha, mahalliy qoralamani o‘chirish
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                Bekor qilish
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)}>
              Qoralamani o‘chirish
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
