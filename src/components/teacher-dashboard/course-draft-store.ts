"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  emptyCourseDraftStore,
  parseCourseDraftStore,
  type CourseDraft,
  type CourseDraftStore,
} from "@/lib/course-draft";

/* -------------------------------------------------------------------------- */
/* Course draft store — Phase 10.                                              */
/*                                                                              */
/* One namespaced + versioned key holding ONLY authoring data: no canonical     */
/* course objects, no teacher records, no tokens, no server ids. Every read     */
/* re-parses through parseCourseDraftStore() so malformed or hand-edited        */
/* storage degrades to "no drafts" instead of crashing a screen.                */
/*                                                                              */
/* Mechanics are identical to the Phase 6/7/8/9 stores: useSyncExternalStore    */
/* (SSR + first paint see the empty state), cross-tab `storage` sync, writes    */
/* that silently no-op in private mode. Ownership is NOT enforced here — the    */
/* selectors in lib/course-draft.ts (draftsForTeacher / findOwnedDraft) are the */
/* single place that filters by the prototype workspace teacher id.             */
/* -------------------------------------------------------------------------- */

export const COURSE_DRAFTS_STORAGE_KEY = "ustoz.course.drafts.v1";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const notify of listeners) notify();
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(COURSE_DRAFTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStore(store: CourseDraftStore): void {
  try {
    window.localStorage.setItem(COURSE_DRAFTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode → nothing persisted. Honest, no fake success.
  }
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

function subscribeNothing(): () => void {
  return () => {};
}

export interface CourseDraftStoreApi {
  /** false during SSR and the first client paint. */
  ready: boolean;
  store: CourseDraftStore;
  /** Insert a fully-formed draft (created by the caller with a local id). */
  create: (draft: CourseDraft) => void;
  /** Patch one draft by id; unknown ids are a no-op. Bumps updatedAt. */
  update: (id: string, updater: (draft: CourseDraft) => CourseDraft) => void;
  /** Local-only deletion of a local-only draft. */
  remove: (id: string) => void;
}

export function useCourseDraftStore(): CourseDraftStoreApi {
  const hydration = useSyncExternalStore(
    subscribeNothing,
    () => "client",
    () => "server",
  );
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const store = useMemo<CourseDraftStore>(() => {
    if (raw === null) return emptyCourseDraftStore();
    try {
      return parseCourseDraftStore(JSON.parse(raw)) ?? emptyCourseDraftStore();
    } catch {
      return emptyCourseDraftStore();
    }
  }, [raw]);

  /** Always re-read storage before writing so concurrent tabs don't clobber. */
  const mutate = useCallback(
    (mapper: (current: CourseDraftStore) => CourseDraftStore) => {
      let current = emptyCourseDraftStore();
      const latest = readRaw();
      if (latest !== null) {
        try {
          current = parseCourseDraftStore(JSON.parse(latest)) ?? current;
        } catch {
          current = emptyCourseDraftStore();
        }
      }
      writeStore(mapper(current));
    },
    [],
  );

  const create = useCallback(
    (draft: CourseDraft) => {
      mutate((current) => ({
        version: 1,
        drafts: [draft, ...current.drafts.filter((item) => item.id !== draft.id)],
      }));
    },
    [mutate],
  );

  const update = useCallback(
    (id: string, updater: (draft: CourseDraft) => CourseDraft) => {
      mutate((current) => ({
        version: 1,
        drafts: current.drafts.map((draft) =>
          draft.id === id
            ? { ...updater(draft), id: draft.id, teacherId: draft.teacherId, updatedAt: new Date().toISOString() }
            : draft,
        ),
      }));
    },
    [mutate],
  );

  const remove = useCallback(
    (id: string) => {
      mutate((current) => ({
        version: 1,
        drafts: current.drafts.filter((draft) => draft.id !== id),
      }));
    },
    [mutate],
  );

  return { ready: hydration === "client", store, create, update, remove };
}
