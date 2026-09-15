import "server-only";
import type { StorageVisibility } from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* Storage policy constants — Phase 18.                                        */
/*                                                                              */
/* Small, explicit and in ONE place, because each of these is a security        */
/* decision rather than a tuning knob:                                         */
/*   • how long a private read capability lives;                                */
/*   • what a shared cache is allowed to keep.                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lifetime of a private verification-document read URL: 10 minutes. Long enough
 * for a reviewer to click a document, far too short to survive in a chat
 * message, a screenshot folder or a browser cache from yesterday.
 */
export const PRIVATE_READ_SECONDS = 10 * 60;

/**
 * Cache policy BAKED INTO the object (and into the S3 presigned response):
 *   • public  — immutable by key, so avatars and covers are cacheable forever.
 *               A replacement writes a NEW key, which is what makes this safe;
 *   • private — never cached by a shared proxy, never stored by the browser.
 */
export const CACHE_CONTROL_BY_VISIBILITY: Record<StorageVisibility, string> = {
  public: "public, max-age=31536000, immutable",
  private: "private, no-store",
};

/** Response headers the DEV media route must send for private objects. */
export const PRIVATE_RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
};

/** Content types the app is willing to render inline from storage. */
export const INLINE_SAFE_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
