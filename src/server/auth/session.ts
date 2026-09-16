import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "../db/client";
import { isProduction, serverEnv } from "../env";
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
}

function cookieOptions(expires: Date) {
  const insecure = serverEnv().AUTH_INSECURE_COOKIES === "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProduction() && !insecure,
    expires,
  };
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

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
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
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
});

/** Best-effort cleanup of expired rows (called after login). */
export async function pruneExpiredSessions(): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}
