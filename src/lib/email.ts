/* -------------------------------------------------------------------------- */
/* Operator email helpers — pure, and shared by exactly four callers:           */
/*   • the login form              (fast client feedback — never trusted),      */
/*   • src/server/validation       (the authority for every request),           */
/*   • src/server/auth/credentials (normalizes before the operator lookup),     */
/*   • scripts/admin.ts            (the out-of-band operator CLI).              */
/*                                                                              */
/* One definition of "normalized" and one of "plausible", so the CLI can never  */
/* create an operator account that the login form would then refuse.            */
/*                                                                              */
/* NORMALIZATION = trim + lowercase, and nothing else. The database enforces    */
/* the same rule with a CHECK (`email = lower(btrim(email))`), so a             */
/* non-normalized value cannot be stored at all — which is what makes the       */
/* UNIQUE index case-insensitive in practice without the citext extension.      */
/*                                                                              */
/* Deliberately NOT an RFC 5322 parser: the rule is "exactly one @, no          */
/* whitespace, something after a dot" — enough to catch a typo, short enough    */
/* that it cannot reject a real address. There is no domain allowlist either;   */
/* which domains an operator may use is a deployment decision, not a code one.  */
/*                                                                              */
/* This module is client-safe on purpose (the login form imports it). It holds  */
/* no records and no secrets — only the shape of an identifier.                 */
/* -------------------------------------------------------------------------- */

/** RFC 5321 path limit. */
export const EMAIL_MAX_LENGTH = 254;
/** Shortest address the shape rule can accept ("a@b.co"). */
export const EMAIL_MIN_LENGTH = 6;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The one normalization every writer and reader applies. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** True when a value already IS normalized — the DB CHECK demands this. */
export function isNormalizedEmail(value: string): boolean {
  return value === normalizeEmail(value);
}

/** Shape + length check. Callers normalize first. */
export function isValidEmail(value: string): boolean {
  return (
    value.length >= EMAIL_MIN_LENGTH &&
    value.length <= EMAIL_MAX_LENGTH &&
    EMAIL_PATTERN.test(value)
  );
}

/** Field-level message for the login form; `null` when the value is acceptable. */
export function validateEmailField(raw: string): string | null {
  const value = normalizeEmail(raw);
  if (value === "") return "Email manzilini kiriting.";
  if (!isValidEmail(value)) {
    return "Email manzili noto‘g‘ri — masalan operator@ustoz.uz.";
  }
  return null;
}

/**
 * Mask for CLI and log output: first character + domain, nothing else.
 * Operator output may be pasted into an issue, so it never carries a full
 * address — the same rule `scripts/admin.ts` already applies to phone numbers.
 */
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "****";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}
