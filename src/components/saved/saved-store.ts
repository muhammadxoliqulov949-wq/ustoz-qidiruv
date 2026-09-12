"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  emptySavedState,
  isSaved,
  parseSavedState,
  toggleSaved,
  type SavedKind,
  type SavedState,
} from "@/lib/saved";

/* -------------------------------------------------------------------------- */
/* Saved store — Phase 8. THE single saved-entity store for the whole app       */
/* (the Phase 1–5 SaveButton kept volatile useState; it now reads/writes here,   */
/* so there is exactly one source of truth and no second saved dataset).        */
/*   • one namespaced, versioned localStorage key holding CANONICAL IDS ONLY;    */
/*   • every read re-parses through parseSavedState() (whitelist + bounds);      */
/*   • same useSyncExternalStore hydration contract as the Phase 6/7 stores:     */
/*     SSR and the first client paint see the empty state, storage flows in      */
/*     after mount → no hydration mismatch, no setState-in-effect;               */
/*   • cross-tab sync via the `storage` event, in-tab via the listener set.      */
/* This is PROTOTYPE state, not an account: a real backend replaces this module  */
/* wholesale and components keep the same hook signature.                        */
/* -------------------------------------------------------------------------- */

export const SAVED_STORAGE_KEY = "ustoz.saved.v1";

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const notify of listeners) notify();
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SAVED_STORAGE_KEY);
  } catch {
    return null; // private mode / disabled storage → memory-less prototype
  }
}

/** Read + sanitize the stored saved-state (SSR-safe: empty on the server). */
export function readSavedState(): SavedState {
  if (typeof window === "undefined") return emptySavedState();
  const raw = readRaw();
  if (raw === null) return emptySavedState();
  try {
    return parseSavedState(JSON.parse(raw)) ?? emptySavedState();
  } catch {
    return emptySavedState();
  }
}

function writeSavedState(state: SavedState): void {
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota/private-mode failures degrade to "nothing persisted" — the honest
    // prototype behaviour; no fake success is reported.
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

export interface SavedStore {
  /** false during SSR + the first client paint (never render stale truth). */
  ready: boolean;
  state: SavedState;
  has: (kind: SavedKind, id: string) => boolean;
  /** Toggle (or force with `next`) — always applied to the LATEST stored value. */
  toggle: (kind: SavedKind, id: string, next?: boolean) => void;
}

export function useSavedStore(): SavedStore {
  const hydration = useSyncExternalStore(
    subscribeNothing,
    () => "client",
    () => "server",
  );
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);

  const state = useMemo<SavedState>(() => {
    if (raw === null) return emptySavedState();
    try {
      return parseSavedState(JSON.parse(raw)) ?? emptySavedState();
    } catch {
      return emptySavedState();
    }
  }, [raw]);

  const toggle = useCallback((kind: SavedKind, id: string, next?: boolean) => {
    // Read-modify-write against storage (multi-tab safe, no stale closures).
    writeSavedState(toggleSaved(readSavedState(), kind, id, next));
  }, []);

  const has = useCallback(
    (kind: SavedKind, id: string) => isSaved(state, kind, id),
    [state],
  );

  return { ready: hydration === "client", state, has, toggle };
}
