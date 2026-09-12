"use client";

import { useMemo } from "react";
import { useOnboardingDraft } from "@/components/onboarding/draft-store";
import { useSavedStore } from "@/components/saved/saved-store";
import { useEnrollDraftSnapshot } from "./enroll-snapshot";
import {
  dashboardRoleState,
  profileCompleteness,
  savedCourses,
  savedTeachers,
  toDashRequest,
  type DashCatalog,
  type DashCourseLite,
  type DashRequest,
  type DashTeacherLite,
  type ProfileCompleteness,
  type ProfileField,
} from "@/lib/dashboard";
import {
  languageLabel,
  onboardingCategories,
  onboardingCityLabel,
  type StudentAnswers,
} from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* useStudentState — the ONE derivation hook of the student dashboard.          */
/* It reads the three EXISTING prototype stores (Phase 6 onboarding draft,      */
/* Phase 7 enrollment draft, Phase 8 saved ids) and joins them against the      */
/* server-built catalog projection. Nothing is stored here; every screen is a   */
/* pure projection, so the dashboard can never disagree with the flows.         */
/* `ready` is false until all three stores have hydrated — screens render their */
/* loading-free skeleton copy instead of a wrong empty state.                   */
/* -------------------------------------------------------------------------- */

export interface StudentState {
  ready: boolean;
  role: "student" | "teacher" | "unknown";
  answers: StudentAnswers;
  /** Display name or null — never a fake "Foydalanuvchi" identity. */
  displayName: string | null;
  profileFields: ProfileField[];
  completeness: ProfileCompleteness;
  /** At most one request exists: the Phase 7 store holds one draft. */
  requests: DashRequest[];
  courses: DashCourseLite[];
  teachers: DashTeacherLite[];
  savedTotal: number;
  toggleSavedCourse: (id: string) => void;
  toggleSavedTeacher: (id: string) => void;
}

export function studentProfileFields(answers: StudentAnswers): ProfileField[] {
  const format =
    answers.format === "online"
      ? "Online"
      : answers.format === "offline"
        ? "Offline"
        : answers.format === "both"
          ? "Online va offline"
          : null;
  return [
    { label: "Ism", value: answers.name.trim() === "" ? null : answers.name.trim() },
    { label: "Telefon", value: answers.phone === "" ? null : answers.phone },
    { label: "Shahar", value: answers.city ? onboardingCityLabel(answers.city) : null },
    { label: "O‘qish formati", value: format },
    {
      label: "Tillar",
      value:
        answers.languages.length === 0
          ? null
          : answers.languages.map((tag) => languageLabel(tag)).join(", "),
    },
    {
      label: "Yo‘nalishlar",
      value:
        answers.interests.length === 0
          ? null
          : answers.interests
              .map(
                (slug) =>
                  onboardingCategories.find((c) => c.slug === slug)?.name ?? slug,
              )
              .join(", "),
    },
  ];
}

export function useStudentState(catalog: DashCatalog): StudentState {
  const { ready: onboardingReady, draft } = useOnboardingDraft();
  const { ready: savedReady, state: saved, toggle } = useSavedStore();
  const { ready: enrollReady, draft: enrollDraft } = useEnrollDraftSnapshot();

  const answers = draft.student;

  return useMemo<StudentState>(() => {
    const profileFields = studentProfileFields(answers);
    const request = enrollDraft ? toDashRequest(catalog, enrollDraft) : null;
    const courses = savedCourses(catalog, saved.courseIds);
    const teachers = savedTeachers(catalog, saved.teacherIds);

    return {
      ready: onboardingReady && savedReady && enrollReady,
      role: dashboardRoleState(draft.role),
      answers,
      displayName: answers.name.trim() === "" ? null : answers.name.trim(),
      profileFields,
      completeness: profileCompleteness(profileFields),
      requests: request ? [request] : [],
      courses,
      teachers,
      savedTotal: courses.length + teachers.length,
      toggleSavedCourse: (id: string) => toggle("course", id),
      toggleSavedTeacher: (id: string) => toggle("teacher", id),
    };
  }, [
    answers,
    catalog,
    draft.role,
    enrollDraft,
    enrollReady,
    onboardingReady,
    saved.courseIds,
    saved.teacherIds,
    savedReady,
    toggle,
  ]);
}
