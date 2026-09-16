import "server-only";

/* -------------------------------------------------------------------------- */
/* Production-safe error logging — Phase 22.                                    */
/*                                                                              */
/* ONE rule: a log line carries a scope, a code and whitelisted scalar context. */
/* It NEVER carries a message from a thrown error (which may embed a query, a   */
/* key, a URL or a credential), a request payload, a token, a signed URL or     */
/* anything read from the database besides an opaque id.                        */
/*                                                                              */
/* Existing call sites already follow this shape with inline `console.error`;    */
/* this helper exists so NEW code gets it right by construction instead of by   */
/* copying the pattern.                                                         */
/* -------------------------------------------------------------------------- */

export type LogContextValue = string | number | boolean | null | undefined;

function codeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0 && code.length <= 32) return code;
  }
  return "unknown";
}

export function errorCode(error: unknown): string {
  return codeOf(error);
}

export function isUniqueViolation(error: unknown): boolean {
  return codeOf(error) === "23505";
}

export function logError(
  scope: string,
  error: unknown,
  extra?: Record<string, LogContextValue>,
): void {
  console.error(scope, { code: codeOf(error), ...(extra ?? {}) });
}
