"use client";

import { useMemo } from "react";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";
import { useEnrollDraftSnapshot } from "@/components/dashboard/enroll-snapshot";
import { useTeacherWorkspace } from "./workspace-store";
import {
  findWorkspace,
  hasTeacherDraft,
  teacherProfileCompleteness,
  toTeacherRequest,
  type TeacherDirectory,
  type TeacherProfileCompleteness,
  type TeacherProfileField,
  type TeacherRequestView,
  type TeacherWorkspaceLite,
} from "@/lib/teacher-workspace";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
  type TeacherAnswers,
} from "@/lib/onboarding";
import { courseLevelLabels } from "@/data/courses";

/* -------------------------------------------------------------------------- */
/* useTeacherState — the ONE derivation hook of the teacher dashboard.          */
/* Joins the prototype workspace selection (a canonical teacher id) and the     */
/* Phase 6 teacher onboarding draft + Phase 7 enrollment draft against the      */
/* server-built directory projection. Stores nothing; every screen is a pure     */
/* projection, so the teacher surface can never disagree with the catalog.      */
/*                                                                              */
/* Domain separation: this hook reads the TEACHER half of the onboarding draft  */
/* only, and never touches saved state or the student read models (Phase 8      */
/* remains a separate component tree).                                           */
/* -------------------------------------------------------------------------- */

export interface TeacherState {
  ready: boolean;
  /** null until a workspace is chosen — never auto-picked. */
  workspace: TeacherWorkspaceLite | null;
  /** Selection exists but no longer resolves to a canonical teacher. */
  unknownSelection: boolean;
  select: (teacherId: string | null) => void;
  /** Phase 6 teacher onboarding answers (draft layer). */
  answers: TeacherAnswers;
  hasDraft: boolean;
  profileFields: TeacherProfileField[];
  completeness: TeacherProfileCompleteness;
  /** At most one: the Phase 7 store holds a single draft, and only when it
   *  belongs to one of THIS teacher's courses does it appear here. */
  requests: TeacherRequestView[];
}

/**
 * Profile rows. Catalog values are the published truth; draft values come from
 * the Phase 6 onboarding prototype. Each row records its source so the UI can
 * label the backend-replacement seam instead of blending the two silently.
 */
export function teacherProfileFields(
  workspace: TeacherWorkspaceLite | null,
  answers: TeacherAnswers,
): TeacherProfileField[] {
  const draftText = (value: string): string | null =>
    value.trim() === "" ? null : value.trim();

  const catalog = (value: string | null): TeacherProfileField["source"] =>
    value === null ? "draft" : "catalog";

  const categoriesFromDraft =
    answers.categories.length === 0
      ? null
      : answers.categories
          .map((slug) => onboardingCategories.find((c) => c.slug === slug)?.name ?? slug)
          .join(", ");

  const expertise =
    workspace && workspace.categoryNames.length > 0
      ? workspace.categoryNames.join(", ")
      : categoriesFromDraft;

  const formats =
    workspace && workspace.formatLabels.length > 0
      ? workspace.formatLabels.join(", ")
      : answers.formats.length === 0
        ? null
        : answers.formats.length === 2
          ? "Online va offline"
          : answers.formats[0] === "online"
            ? "Online"
            : "Offline";

  const location =
    workspace && workspace.cityLabels.length > 0
      ? workspace.cityLabels.join(", ")
      : answers.city
        ? [onboardingCityLabel(answers.city), answers.district.trim()]
            .filter((part) => part !== "")
            .join(" · ")
        : null;

  const languages =
    workspace && workspace.languages.length > 0
      ? workspace.languages.map((tag) => languageLabel(tag)).join(", ")
      : answers.languages.length === 0
        ? null
        : answers.languages.map((tag) => languageLabel(tag)).join(", ");

  const experience =
    workspace !== null
      ? `${workspace.experienceYears} yil`
      : answers.experienceYears === null
        ? null
        : `${answers.experienceYears} yil`;

  const levels =
    answers.levels.length === 0
      ? null
      : answers.levels.map((level) => courseLevelLabels[level]).join(", ");

  const name = workspace?.name ?? draftText(answers.name);
  const bio = workspace?.bio ?? draftText(answers.bio);
  const approach = workspace?.approach ?? draftText(answers.approach);

  return [
    { label: "Ism", value: name, source: workspace ? "catalog" : "draft" },
    { label: "Yo‘nalishlar", value: expertise, source: workspace && workspace.categoryNames.length > 0 ? "catalog" : "draft" },
    { label: "Format", value: formats, source: workspace && workspace.formatLabels.length > 0 ? "catalog" : "draft" },
    { label: "Joylashuv", value: location, source: workspace && workspace.cityLabels.length > 0 ? "catalog" : "draft" },
    { label: "Tillar", value: languages, source: workspace && workspace.languages.length > 0 ? "catalog" : "draft" },
    { label: "Tajriba", value: experience, source: workspace ? "catalog" : "draft" },
    { label: "O‘quvchi darajalari", value: levels, source: "draft" },
    { label: "Telefon", value: answers.phone === "" ? null : answers.phone, source: "draft" },
    { label: "Bio", value: bio, source: catalog(workspace?.bio ?? null) },
    { label: "O‘qitish uslubi", value: approach, source: catalog(workspace?.approach ?? null) },
  ];
}

export function useTeacherState(directory: TeacherDirectory): TeacherState {
  const { ready: workspaceReady, teacherId, select } = useTeacherWorkspace();
  const { ready: onboardingReady, draft } = useOnboardingDraft();
  const { ready: enrollReady, draft: enrollDraft } = useEnrollDraftSnapshot();

  const answers = draft.teacher;

  return useMemo<TeacherState>(() => {
    const workspace = findWorkspace(directory, teacherId);
    const request =
      workspace && enrollDraft ? toTeacherRequest(workspace, enrollDraft) : null;
    const profileFields = teacherProfileFields(workspace, answers);

    return {
      ready: workspaceReady && onboardingReady && enrollReady,
      workspace,
      unknownSelection: teacherId !== null && workspace === null,
      select,
      answers,
      hasDraft: hasTeacherDraft(answers),
      profileFields,
      completeness: teacherProfileCompleteness(profileFields),
      requests: request ? [request] : [],
    };
  }, [
    answers,
    directory,
    enrollDraft,
    enrollReady,
    onboardingReady,
    select,
    teacherId,
    workspaceReady,
  ]);
}
