"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { emptyDraft, parseDraft, type OnboardingDraft } from "@/lib/onboarding";

/* -------------------------------------------------------------------------- */
/* Onboarding draft store — PROTOTYPE state, deliberately not an account.        */
/*   • The only persistence is ONE localStorage key, namespaced and versioned.   */
/*     Every read is re-validated through parseDraft(), so a hand-edited value   */
/*     can never inject markup, enums or secrets into the UI.                    */
/*   • Passwords are NOT part of the draft shape (lib/onboarding.ts) — this      */
/*     store physically cannot persist them.                                     */
/*   • Consumers subscribe through useSyncExternalStore: the server render and   */
/*     the first client paint see the empty draft (no hydration mismatch), and   */
/*     storage value flows in after mount — the canonical hydration pattern,     */
/*     with zero setState-in-effect.                                             */
/*   • A real auth backend replaces this module wholesale: the draft type +     */
/*     read/write helpers are the only seam components touch.                    */
/* -------------------------------------------------------------------------- */

export const DRAFT_STORAGE_KEY = "ustoz.onboarding.draft.v1";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const notify of listeners) notify();
}

/* ------------------------------- raw storage ------------------------------- */

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null; // private mode / disabled storage → memory-only prototype
  }
}

/** Read + sanitize the prototype draft (SSR-safe: null on the server). */
export function readPrototypeDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === null) return null;
  try {
    return parseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePrototypeDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Quota/private-mode failures degrade to “nothing persisted”, which is
    // all a prototype may do. No user-facing error is faked.
  }
  emitChange();
}

export function clearPrototypeDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emitChange();
}

/* ------------------------------ subscriptions ------------------------------ */

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    // Cross-tab updates (e.g. “clear draft” clicked in another window).
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

/** "client" after mount, "server" during SSR + hydration paint. */
function useHydrationState(): "client" | "server" {
  return useSyncExternalStore(
    subscribeNothing,
    () => "client",
    () => "server",
  );
}

/** Live view of the stored draft — empty draft until hydration, then the
 *  sanitized localStorage value (kept in sync via the subscription). */
function usePrototypeDraft(): OnboardingDraft {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    if (raw === null) return emptyDraft();
    try {
      return parseDraft(JSON.parse(raw)) ?? emptyDraft();
    } catch {
      return emptyDraft();
    }
  }, [raw]);
}

/* ------------------------------- provider API ------------------------------ */

interface DraftStore {
  /** false during the server render + first client paint. */
  ready: boolean;
  draft: OnboardingDraft;
  /** Apply the mutation to the LATEST stored draft and persist. */
  update: (mutate: (draft: OnboardingDraft) => OnboardingDraft) => void;
  /** Forget this browser's draft entirely (UI-state reset, not an account op). */
  reset: () => void;
}

const DraftContext = createContext<DraftStore | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // The source of truth IS localStorage (via the subscription above); the
  // provider owns no copy, so update()/reset() can never desync the UI.
  const hydration = useHydrationState();
  const draft = usePrototypeDraft();

  const update = useCallback(
    (mutate: (draft: OnboardingDraft) => OnboardingDraft) => {
      const current = readPrototypeDraft() ?? emptyDraft();
      writePrototypeDraft(mutate(current));
    },
    [],
  );

  const reset = useCallback(() => {
    clearPrototypeDraft();
  }, []);

  const value = useMemo<DraftStore>(
    () => ({ ready: hydration === "client", draft, update, reset }),
    [hydration, draft, update, reset],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft(): DraftStore {
  const store = useContext(DraftContext);
  if (!store) {
    throw new Error("useOnboardingDraft must be used inside <OnboardingProvider>");
  }
  return store;
}

/** Hydration flag for consumers OUTSIDE the provider (e.g. /register's
 *  “pending draft” hint) — same useSyncExternalStore source of truth. */
export function usePrototypeDraftHydrated(): boolean {
  return useHydrationState() === "client";
}
