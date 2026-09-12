"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  emptyEnrollDraft,
  parseEnrollDraft,
  type EnrollDraft,
} from "@/lib/enroll";
import { readPrototypeDraft } from "@/components/onboarding/draft-store";

/* -------------------------------------------------------------------------- */
/* Enrollment draft store — Phase 7. Deliberately SEPARATE from the Phase 6     */
/* onboarding draft (different key, different shape, different lifecycle):       */
/*   • one namespaced localStorage key for the CURRENT enrollment only — a        */
/*     draft bound to another course slug is dropped, never merged;               */
/*   • every read re-parses through parseEnrollDraft() (whitelists + bounds);     */
/*   • structurally cannot hold passwords, tokens or fake ids (lib/enroll.ts);   */
/*   • "submitted" only drives the honest prototype completion screen — it is    */
/*     never presented as a server receipt.                                       */
/* Same useSyncExternalStore hydration pattern as the onboarding store, so SSR  */
/* and the first client paint match and nothing renders from unread storage.    */
/* -------------------------------------------------------------------------- */

export const ENROLL_STORAGE_KEY = "ustoz.enroll.draft.v1";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const notify of listeners) notify();
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(ENROLL_STORAGE_KEY);
  } catch {
    return null;
  }
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

function readStored(): EnrollDraft | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === null) return null;
  try {
    return parseEnrollDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStored(draft: EnrollDraft): void {
  try {
    window.localStorage.setItem(ENROLL_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage failures degrade to in-memory-only prototype state.
  }
  emitChange();
}

function clearStored(): void {
  try {
    window.localStorage.removeItem(ENROLL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emitChange();
}

export interface EnrollStore {
  /** false until the client snapshot is live (never render from stale state). */
  ready: boolean;
  /** The draft for THIS course; a foreign-course draft surfaces as null. */
  draft: EnrollDraft | null;
  update: (mutate: (draft: EnrollDraft) => EnrollDraft) => void;
  reset: () => void;
  /**
   * Seed student fields from the onboarding PROTOTYPE draft (read-only there;
   * never touches storage of the other flow). Only fills what is still empty.
   */
  prefillFromOnboarding: () => void;
}

export function useEnrollStore(courseSlug: string): EnrollStore {
  const hydration = useSyncExternalStore(subscribeNothing, () => "c", () => "s");
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const draft = useMemo<EnrollDraft | null>(() => {
    if (raw === null) return null;
    try {
      const parsed = parseEnrollDraft(JSON.parse(raw));
      return parsed && parsed.courseSlug === courseSlug ? parsed : null;
    } catch {
      return null;
    }
  }, [raw, courseSlug]);

  const update = useCallback(
    (mutate: (draft: EnrollDraft) => EnrollDraft) => {
      // Always mutate the LATEST stored value (multi-tab safe, no closures).
      const stored = readStored();
      const current =
        stored && stored.courseSlug === courseSlug
          ? stored
          : emptyEnrollDraft(courseSlug);
      writeStored(mutate(current));
    },
    [courseSlug],
  );

  const reset = useCallback(() => {
    clearStored();
  }, []);

  const prefillFromOnboarding = useCallback(() => {
    const onboarding = readPrototypeDraft();
    if (!onboarding) return;
    const student = onboarding.student;
    update((d) => {
      if (d.prefillApplied) return d; // never overwrite after the user has been in the flow
      const next = { ...d, prefillApplied: true };
      if (d.name === "" && student.name.trim() !== "") next.name = student.name.trim();
      if (d.phone === "" && student.phone !== "") next.phone = student.phone;
      return next;
    });
  }, [update]);

  return {
    ready: hydration === "c",
    draft,
    update,
    reset,
    prefillFromOnboarding,
  };
}
