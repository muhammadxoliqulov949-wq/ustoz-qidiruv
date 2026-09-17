import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "../db/client";
import { isProduction, serverEnv } from "../env";
import { logError } from "../log";
import { hashToken, newId, newSessionToken } from "./ids";

/* -------------------------------------------------------------------------- */
/* Sessions — Phase 11.                                                        */
/*                                                                              */
/* Opaque, server-verifiable, revocable:                                        */
/*   • login mints 32 random bytes; the COOKIE holds the raw token, the DB      */
/*     holds only its SHA-256 — a database leak cannot be replayed as a login;  */
/*   • cookie is HttpOnly + SameSite=Lax + Path=/ and Secure in production, so  */
/*     it is unreadable from JavaScript and not sent on cross-site POSTs;       */
/*   • every request resolves the user from the database, never from a client   */
/*     claim; expiry is enforced in the SQL predicate as well as on delete;     */
/*   • logout deletes the row, so the token is dead everywhere immediately.     */
/*                                                                              */
/* No JWT, no localStorage, no client-readable identity.                        */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = "ustoz_session";
const SESSION_TTL_DAYS = 30;
/*
 * Phase 22: a user keeps at most this many live sessions. Every login mints a
 * new row, so without a cap the table grows with every sign-in on every
 * device; beyond the cap the oldest rows are revoked on the next login. Ten
 * is generous for real multi-device use and cheap to enforce.
 */
export const MAX_SESSIONS_PER_USER = 10;
/*
 * Phase 22: the expired-session sweep runs on ~10% of logins instead of every
 * one. Pruning is a write that every login used to pay; sampling keeps the
 * table clean without taxing the hot path, and the Phase 22
 * `sessions_expires_at_idx` index keeps each sweep an index range delete.
 */
const PRUNE_SAMPLE_PROBABILITY = 0.1;

export interface SessionUser {
  id: string;
  /**
   * The account's role, read from `users.role` on every request. Phase 15 adds
   * `admin`, which is settable ONLY by the operator CLI — never by any request.
   */
  role: "student" | "teacher" | "admin";
  /**
   * Private. Never rendered on a public page. NULL for an operator account that
   * logs in with an email instead (`admin:create-email`); the email itself is
   * not part of the session projection, because no surface needs it — identity
   * here is `id` + `role`, and that is all the guards consult.
   */
  phone: string | null;
  accountStatus: "active" | "deactivated";
}

export interface SessionCookieFlags {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  expires: Date;
}

/**
 * The session cookie flags, as a pure function of the environment — extracted
 * in Phase 22 so the test suite can assert every flag without a request
 * context. Production is always HttpOnly + Secure + SameSite=Lax + Path=/;
 * `Secure` drops only for explicit local http testing.
 */
export function sessionCookieOptions(
  expires: Date,
  options: { insecureCookies: boolean; production: boolean },
): SessionCookieFlags {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: options.production && !options.insecureCookies,
    expires,
  };
}

function cookieOptions(expires: Date): SessionCookieFlags {
  return sessionCookieOptions(expires, {
    insecureCookies: serverEnv().AUTH_INSECURE_COOKIES === "1",
    production: isProduction(),
  });
}

/** Creates a session row and sets the cookie. Returns nothing sensitive. */
export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.sessions).values({
    id: newId("ses"),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  // Best effort: a failed cap enforcement must never fail the login it
  // follows — the session already exists and the cookie below must be set.
  // The failure is still logged (code only), so a broken cap is visible.
  await enforceSessionCap(userId).catch((error: unknown) => {
    logError("enforceSessionCap failed", error);
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Revoke a user's oldest sessions beyond the cap, keeping the newest rows.
 * Exported for the test suite; `createSession` is the only production caller.
 * Returns how many sessions were revoked.
 */
export async function enforceSessionCap(userId: string): Promise<number> {
  const db = getDb();
  // Newest first (`id` breaks `created_at` ties deterministically), skipping
  // the rows the user keeps; OFFSET without LIMIT selects every overflow row.
  const overflow = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(desc(schema.sessions.createdAt), desc(schema.sessions.id))
    .offset(MAX_SESSIONS_PER_USER);
  if (overflow.length === 0) return 0;
  await db.delete(schema.sessions).where(
    inArray(
      schema.sessions.id,
      overflow.map((row) => row.id),
    ),
  );
  return overflow.length;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the authenticated user for THIS request.
 * `cache()` de-duplicates the query across a single render pass so a page and
 * its layout don't hit the database twice.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 16 || token.length > 200) return null;

  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      phone: schema.users.phone,
      accountStatus: schema.users.accountStatus,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
        eq(schema.users.accountStatus, "active"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
});

/**
 * Best-effort cleanup of expired rows. Deterministic and exported for tests;
 * production callers use `maybePruneExpiredSessions()` so the hot login path
 * pays for a sweep only on a sample of requests.
 */
export async function pruneExpiredSessions(): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}

/**
 * Sampled sweep for the login path: runs with `PRUNE_SAMPLE_PROBABILITY` and
 * never throws (a failed sweep must not fail a login).
 */
export async function maybePruneExpiredSessions(): Promise<void> {
  if (Math.random() >= PRUNE_SAMPLE_PROBABILITY) return;
  try {
    await pruneExpiredSessions();
  } catch {
    // Best effort: expired rows are inert (expiry is enforced in the session
    // lookup predicate), so a missed sweep is only untidiness.
  }
}
