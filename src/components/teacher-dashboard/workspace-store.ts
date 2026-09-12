"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  emptyWorkspaceState,
  parseWorkspaceState,
  type TeacherWorkspaceState,
} from "@/lib/teacher-workspace";

/* -------------------------------------------------------------------------- */
/* Teacher workspace store — Phase 9.                                          */
/*                                                                              */
/* THIS IS NOT AUTHENTICATION. It holds ONE canonical teacher id so the         */
/* prototype teacher surface has something concrete to render; picking a        */
/* workspace is an explicit, visible user action and every screen states that   */
/* no account or session exists. It cannot express "logged in": there is no     */
/* token, no role claim, no expiry, no credential — only an id that must match  */
/* a canonical teacher record, or null.                                          */
/*                                                                              */
/* Mechanics follow the Phase 6/7/8 contract exactly: one namespaced+versioned  */
/* key, defensive re-parse on every read, useSyncExternalStore hydration (SSR   */
/* and first paint see the empty state), cross-tab sync via `storage`.          */
/* A real auth layer replaces this module wholesale; consumers keep the hook.   */
/* -------------------------------------------------------------------------- */

export const TEACHER_WORKSPACE_STORAGE_KEY = "ustoz.teacher.workspace.v1";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const notify of listeners) notify();
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(TEACHER_WORKSPACE_STORAGE_KEY);
  } catch {
    return null; // private mode / disabled storage → in-memory-less prototype
  }
}

function writeState(state: TeacherWorkspaceState): void {
  try {
    window.localStorage.setItem(
      TEACHER_WORKSPACE_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Quota/private-mode failures degrade to "nothing persisted" — honest.
  }
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function subscribeNothing(): () => void {
  return () => {};
}

export interface TeacherWorkspaceStore {
  /** false during SSR + the first client paint. */
  ready: boolean;
  /** Canonical teacher id, or null when no workspace has been chosen. */
  teacherId: string | null;
  /** Choose (or clear with null) the inspected workspace. */
  select: (teacherId: string | null) => void;
}

export function useTeacherWorkspace(): TeacherWorkspaceStore {
  const hydration = useSyncExternalStore(
    subscribeNothing,
    () => "client",
    () => "server",
  );
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const state = useMemo<TeacherWorkspaceState>(() => {
    if (raw === null) return emptyWorkspaceState();
    try {
      return parseWorkspaceState(JSON.parse(raw)) ?? emptyWorkspaceState();
    } catch {
      return emptyWorkspaceState();
    }
  }, [raw]);

  const select = useCallback((teacherId: string | null) => {
    writeState({ version: 1, teacherId });
  }, []);

  return {
    ready: hydration === "client",
    teacherId: state.teacherId,
    select,
  };
}
