import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { normalizeEmail } from "@/lib/email";
import { verifyPassword } from "./password";

/* -------------------------------------------------------------------------- */
/* Credential verification — the ONLY place a password is checked.              */
/*                                                                              */
/* Two identifier kinds, two functions, one rule set:                           */
/*   authenticatePhone      — students and teachers, plus the operators         */
/*                            bootstrapped by `admin:create`;                   */
/*   authenticateAdminEmail — operators created by `admin:create-email`.        */
/*                                                                              */
/* Neither function touches cookies, sessions or navigation. They answer one    */
/* question — "is this credential valid, and whose is it?" — and the server     */
/* actions in src/server/actions/auth.ts own the session and the redirect. That */
/* split is what makes the auth decision testable against a real database       */
/* without a request context (see tests/admin.test.ts).                         */
/*                                                                              */
/* SEPARATION IS THE POINT. The email path can only ever return an `admin`:     */
/* `users_email_admin_only` makes an email on a marketplace row impossible, and */
/* the role is re-checked here so this path does not DEPEND on that constraint. */
/* The phone path is unchanged in behaviour — it still authenticates whatever   */
/* role the row has, and the caller decides where that role is allowed to go.   */
/*                                                                              */
/* ENUMERATION AND TIMING. "No such identifier" and "wrong password" return the */
/* same result, and a miss still burns one argon2id verification against a      */
/* fixed dummy hash, so neither the message nor the response time says whether  */
/* an account exists. The dummy is a constant shape, not a credential.          */
/* -------------------------------------------------------------------------- */

/** A well-formed argon2id PHC string that no chosen password can match. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export type AccountRole = "student" | "teacher" | "admin";

export type CredentialResult =
  | { ok: true; id: string; role: AccountRole }
  | { ok: false };

/** One verification for both branches, so a miss costs the same as a hit. */
async function verify(storedHash: string | null, password: string): Promise<boolean> {
  return verifyPassword(storedHash ?? DUMMY_HASH, password);
}

/**
 * Phone + password — the marketplace login, unchanged since Phase 11.
 * `phone` must already be canonical ("+998XXXXXXXXX"); `phoneSchema` does that.
 */
export async function authenticatePhone(
  phone: string,
  password: string,
): Promise<CredentialResult> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(and(eq(schema.users.phone, phone), eq(schema.users.accountStatus, "active")))
    .limit(1);

  const user = rows[0];
  if (!user) {
    await verify(null, password);
    return { ok: false };
  }
  return (await verify(user.passwordHash, password))
    ? { ok: true, id: user.id, role: user.role }
    : { ok: false };
}

/**
 * Email + password — the OPERATOR login. Returns an account only when the row
 * is `role = 'admin'`; anything else is indistinguishable from "no such
 * address". The address is normalized here as well as in the schema, so a
 * caller that forgets cannot produce a lookup that misses a stored account.
 */
export async function authenticateAdminEmail(
  email: string,
  password: string,
): Promise<CredentialResult> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(and(eq(schema.users.email, normalizeEmail(email)), eq(schema.users.accountStatus, "active")))
    .limit(1);

  const user = rows[0];
  if (!user || user.role !== "admin") {
    await verify(null, password);
    return { ok: false };
  }
  return (await verify(user.passwordHash, password))
    ? { ok: true, id: user.id, role: user.role }
    : { ok: false };
}

export type MarketplaceEmailResult =
  | { ok: true; id: string; role: "student" | "teacher" }
  | { ok: false; code: "invalid_credentials" | "unverified_email"; email?: string };

/**
 * Email + password — the MARKETPLACE login (students and teachers) — Phase 23.5.
 *
 * Rules:
 *   • operator accounts (role='admin') are strictly refused and return the same
 *     generic error as unknown accounts (enumeration safe);
 *   • OAuth-only accounts without a password hash burn a dummy verification
 *     and return invalid credentials;
 *   • unverified email accounts are blocked from receiving a session until
 *     their address has been verified through the token lifecycle;
 *   • returns the user id and verified student/teacher role on success.
 */
export async function authenticateMarketplaceEmail(
  email: string,
  password: string,
): Promise<MarketplaceEmailResult> {
  const db = getDb();
  const normalized = normalizeEmail(email);

  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(and(eq(schema.users.email, normalized), eq(schema.users.accountStatus, "active")))
    .limit(1);

  const user = rows[0];
  // Admins must use authenticateAdminEmail; marketplace login treats them as non-existent
  if (!user || user.role === "admin" || !user.passwordHash) {
    await verify(null, password);
    return { ok: false, code: "invalid_credentials" };
  }

  const isValidPassword = await verify(user.passwordHash, password);
  if (!isValidPassword) {
    return { ok: false, code: "invalid_credentials" };
  }

  // Email verification policy: must have verified email
  if (!user.emailVerifiedAt) {
    return {
      ok: false,
      code: "unverified_email",
      email: user.email ?? normalized,
    };
  }

  return {
    ok: true,
    id: user.id,
    role: user.role as "student" | "teacher",
  };
}
