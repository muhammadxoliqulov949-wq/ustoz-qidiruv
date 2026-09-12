import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/* Cryptographic helpers — standard library primitives only. */

/** URL-safe opaque id (users, sessions, courses created server-side). */
export function newId(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString("base64url")}`;
}

/** 256-bit opaque session token; only its hash is ever persisted. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
