"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseEnrollDraft, type EnrollDraft } from "@/lib/enroll";
import { ENROLL_STORAGE_KEY } from "@/components/enroll/enroll-store";

/* -------------------------------------------------------------------------- */
/* Read-only view of the Phase 7 enrollment draft.                              */
/* The Phase 7 hook (useEnrollStore) is intentionally course-scoped — it hides   */
/* a draft belonging to another course. The dashboard needs the opposite: the    */
/* draft WHATEVER course it belongs to, and read-only.                           */
/*   • same storage key, same version, same parseEnrollDraft() sanitizer —       */
/*     the Phase 7 format is NOT changed, migrated or written to from here;      */
/*   • same useSyncExternalStore hydration contract (empty on the server).       */
/* -------------------------------------------------------------------------- */

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(ENROLL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Cross-tab only: within a tab the flow lives on another route, so a fresh
  // mount already re-reads storage.
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function subscribeNothing(): () => void {
  return () => {};
}

export interface EnrollDraftSnapshot {
  ready: boolean;
  /** The sanitized draft for ANY course, or null when none exists. */
  draft: EnrollDraft | null;
}

export function useEnrollDraftSnapshot(): EnrollDraftSnapshot {
  const hydration = useSyncExternalStore(
    subscribeNothing,
    () => "client",
    () => "server",
  );
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const draft = useMemo<EnrollDraft | null>(() => {
    if (raw === null) return null;
    try {
      return parseEnrollDraft(JSON.parse(raw));
    } catch {
      return null;
    }
  }, [raw]);

  return { ready: hydration === "client", draft };
}
