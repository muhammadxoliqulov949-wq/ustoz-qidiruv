/* -------------------------------------------------------------------------- */
/* Safe `?next=` handling — Phase 7. ONE pure guard shared by every auth          */
/* handoff (/login, /register, the enrollment flow). Rules:                         */
/*   • must be an internal path: starts with "/", NOT "//" or "/\"                  */
/*     (protocol-relative → external host) and contains no "\" at all;            */
/*   • no scheme, no whitespace, capped length;                                   */
/*   • anything else collapses to null — callers then behave exactly like a       */
/*     plain /login / /register visit. Open redirects are impossible because       */
/*     only values that survive this parser are ever rendered as hrefs.            */
/* -------------------------------------------------------------------------- */

const NEXT_MAX = 400;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Validate a raw ?next= search param → safe internal path or null. */
export function parseSafeNext(
  value: string | string[] | undefined,
): string | null {
  const raw = first(value);
  if (!raw || raw.length === 0 || raw.length > NEXT_MAX) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\") || raw.startsWith("\\\\"))
    return null;
  if (raw.includes("\\")) return null;
  if (/\s/.test(raw)) return null;
  // Reject embedded schemes/credentials that could survive odd encodings.
  if (raw.includes("://") || raw.includes("@")) return null;
  return raw;
}

/** True when an already-parsed value is a safe internal path (used at render). */
export function isSafeNext(path: string | null): path is string {
  return path !== null && parseSafeNext(path) === path;
}

/** Append `next=` to an auth route href only when the target is safe. */
export function withNext(base: string, next: string | null): string {
  if (!isSafeNext(next)) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}next=${encodeURIComponent(next)}`;
}
