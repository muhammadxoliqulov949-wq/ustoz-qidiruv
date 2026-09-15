import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/* -------------------------------------------------------------------------- */
/* Signed private reads — Phase 18.                                            */
/*                                                                              */
/* The S3 provider gets its capability from the provider itself (a presigned    */
/* GET). The LOCAL provider still needs the same guarantee — a private object    */
/* must not be fetchable by knowing its key — so it mints an equivalent         */
/* capability: key + expiry + HMAC signature, verified in constant time.        */
/*                                                                              */
/* Both paths therefore share one authorization model: possession of a          */
/* short-lived, server-minted token, scoped to ONE object, with no session      */
/* required to replay it. Signed URLs are never persisted.                      */
/* -------------------------------------------------------------------------- */

export const MEDIA_URL_PARAM_EXPIRES = "e";
export const MEDIA_URL_PARAM_SIGNATURE = "s";

/** Hard ceiling for a private read URL, whatever a caller asks for. */
export const MAX_PRIVATE_READ_SECONDS = 15 * 60;

export function clampPrivateReadSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 5 * 60;
  return Math.min(Math.round(seconds), MAX_PRIVATE_READ_SECONDS);
}

/** HMAC over `key\nexpiry` so a signature can never be replayed for another key. */
export function signPrivateKey(input: {
  key: string;
  expiresAtEpochSeconds: number;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.key}\n${input.expiresAtEpochSeconds}`)
    .digest("hex");
}

export type PrivateKeyVerdict = "valid" | "expired" | "forged" | "malformed";

/**
 * Verify a capability. Order matters: the signature is checked BEFORE the
 * expiry is reported, so probing an expired-but-forged token cannot distinguish
 * "wrong signature" from "expired" in the response.
 */
export function verifyPrivateKey(input: {
  key: string;
  expiresAtEpochSeconds: number | null;
  signature: string | null;
  secret: string;
  nowSeconds: number;
}): PrivateKeyVerdict {
  if (input.expiresAtEpochSeconds === null || !input.signature) return "malformed";
  if (input.signature.length !== 64) return "forged";

  const expected = signPrivateKey({
    key: input.key,
    expiresAtEpochSeconds: input.expiresAtEpochSeconds,
    secret: input.secret,
  });
  const provided = Buffer.from(input.signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (provided.length !== wanted.length) return "forged";
  if (!timingSafeEqual(provided, wanted)) return "forged";

  if (input.expiresAtEpochSeconds <= input.nowSeconds) return "expired";
  return "valid";
}
