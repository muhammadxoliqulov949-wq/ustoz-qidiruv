/* -------------------------------------------------------------------------- */
/* Saved-entity model — Phase 8. PURE module (no React, no DOM), same          */
/* contract-first pattern as lib/onboarding.ts and lib/enroll.ts:              */
/*   • SavedState holds nothing but CANONICAL ids (course ids / teacher ids).   */
/*     Titles, prices and images are ALWAYS re-derived from the catalog, so a   */
/*     saved item can never drift from the dataset (no duplicated course data). */
/*   • parseSavedState() is the single sanitizer: versioned, whitelist-shaped,  */
/*     bounded, de-duplicated. A hand-edited storage value can inject nothing.  */
/*   • Structurally incapable of holding passwords, tokens or session ids.      */
/* A real backend replaces the store around this model; the model itself is     */
/* exactly what a `GET /me/saved` response would carry.                         */
/* -------------------------------------------------------------------------- */

export type SavedKind = "course" | "teacher";

export interface SavedState {
  version: 1;
  /** Canonical course ids, most recently saved FIRST. */
  courseIds: string[];
  /** Canonical teacher ids, most recently saved first. */
  teacherIds: string[];
}

/** Ids in our datasets are slug-ish ascii (`c-ielts-intensive`, `t-…`). */
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
/** Defensive cap — a prototype list, not a library. */
export const SAVED_MAX = 200;

export function emptySavedState(): SavedState {
  return { version: 1, courseIds: [], teacherIds: [] };
}

function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !ID_RE.test(item)) continue;
    if (out.includes(item)) continue;
    out.push(item);
    if (out.length >= SAVED_MAX) break;
  }
  return out;
}

/**
 * Defensive parse of anything read back from storage. Unknown/foreign/corrupt
 * shapes return null so the caller starts from emptySavedState().
 */
export function parseSavedState(value: unknown): SavedState | null {
  if (typeof value !== "object" || value === null) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return null;
  return {
    version: 1,
    courseIds: parseIdList(source.courseIds),
    teacherIds: parseIdList(source.teacherIds),
  };
}

function listFor(state: SavedState, kind: SavedKind): string[] {
  return kind === "course" ? state.courseIds : state.teacherIds;
}

export function isSaved(state: SavedState, kind: SavedKind, id: string): boolean {
  return listFor(state, kind).includes(id);
}

/** Pure toggle → a NEW state (newest first, capped). Invalid ids are no-ops. */
export function toggleSaved(
  state: SavedState,
  kind: SavedKind,
  id: string,
  next?: boolean,
): SavedState {
  if (!ID_RE.test(id)) return state;
  const current = listFor(state, kind);
  const has = current.includes(id);
  const shouldSave = next ?? !has;
  if (shouldSave === has) return state;
  const updated = shouldSave
    ? [id, ...current].slice(0, SAVED_MAX)
    : current.filter((entry) => entry !== id);
  return kind === "course"
    ? { ...state, courseIds: updated }
    : { ...state, teacherIds: updated };
}
