import "server-only";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, schema } from "../db/client";
import { isProduction, serverEnv } from "../env";
import { newId, safeEqual } from "./ids";
import { normalizeEmail } from "@/lib/email";
import { slugifyName, uniqueTeacherSlug } from "../slug";
import { logError } from "../log";

/* -------------------------------------------------------------------------- */
/* Google OAuth 2.0 / OIDC Authentication — Phase 23.5.                       */
/*                                                                              */
/* Standard OpenID Connect Authorization Code Flow with PKCE:                   */
/*   • state, nonce, and code_verifier generated cryptographically server-side; */
/*   • stored in an HttpOnly, SameSite=Lax, Secure cookie during the flow;      */
/*   • server exchanges authorization code directly with Google token endpoint; */
/*   • ID token claims verified: iss, aud, exp, nonce, email_verified;          */
/*   • Google stable account id (`sub`) is the authoritative provider identity; */
/*   • admin accounts are NEVER accessible or linkable via Google OAuth;        */
/*   • public Google auth cannot escalate or alter an existing user's role.     */
/* -------------------------------------------------------------------------- */

export const OAUTH_STATE_COOKIE = "ustoz_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

export interface GoogleOAuthState {
  state: string;
  nonce: string;
  codeVerifier: string;
  role: "student" | "teacher";
  next?: string | null;
}

export interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  iss: string;
  aud: string;
  exp: number;
  nonce?: string;
}

export type GoogleAuthResult =
  | { ok: true; userId: string; role: "student" | "teacher" | "admin"; next?: string | null }
  | { ok: false; code: string; message: string };

/** Build Google OAuth Authorization URL and store state cookie. */
export async function createGoogleAuthRedirect(options: {
  role?: "student" | "teacher";
  next?: string | null;
}): Promise<string> {
  const env = serverEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const base = env.APP_BASE_URL ?? "http://localhost:3000";
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${base}/api/auth/google/callback`;

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const statePayload: GoogleOAuthState = {
    state,
    nonce,
    codeVerifier,
    role: options.role === "teacher" ? "teacher" : "student",
    next: options.next ?? null,
  };

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, JSON.stringify(statePayload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProduction() && env.AUTH_INSECURE_COOKIES !== "1",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseJwtPayload<T>(jwt: string): T | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

/** Token exchange test mock hook. */
type TokenExchangeFn = (
  code: string,
  verifier: string,
  redirectUri: string,
) => Promise<{ id_token: string; access_token?: string }>;

let mockTokenExchange: TokenExchangeFn | null = null;

export function setMockGoogleTokenExchange(fn: TokenExchangeFn | null): void {
  mockTokenExchange = fn;
}

/** Exchange code for tokens at Google OAuth endpoint. */
export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ id_token: string }> {
  if (mockTokenExchange) {
    return mockTokenExchange(code, codeVerifier, redirectUri);
  }

  const env = serverEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logError("Google token exchange failed", { status: response.status, body: errText });
    throw new Error(`Google token exchange returned ${response.status}`);
  }

  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("Google token exchange response did not include id_token");
  }
  return { id_token: data.id_token };
}

/** Validate ID token claims against standard OIDC constraints. */
export function validateGoogleIdToken(
  idToken: string,
  expectedNonce: string,
  expectedClientId: string,
): { ok: true; claims: GoogleIdTokenClaims } | { ok: false; code: string; message: string } {
  const claims = parseJwtPayload<GoogleIdTokenClaims>(idToken);
  if (!claims) {
    return { ok: false, code: "malformed_token", message: "Google tokeni formati noto‘g‘ri." };
  }

  // 1. Issuer check
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!validIssuers.includes(claims.iss)) {
    return { ok: false, code: "invalid_issuer", message: "Google tokeni emitenti noto‘g‘ri." };
  }

  // 2. Audience check
  if (claims.aud !== expectedClientId) {
    return { ok: false, code: "invalid_audience", message: "Google tokeni auditoriyasi mos kelmadi." };
  }

  // 3. Expiration check
  const nowSec = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowSec) {
    return { ok: false, code: "token_expired", message: "Google tokenining muddati tugagan." };
  }

  // 4. Nonce check
  if (!claims.nonce || !safeEqual(claims.nonce, expectedNonce)) {
    return { ok: false, code: "invalid_nonce", message: "Google sessiya xavfsizlik kodi mos kelmadi." };
  }

  // 5. Email verified check
  if (claims.email_verified !== true) {
    return {
      ok: false,
      code: "email_not_verified",
      message: "Google hisobidagi email tasdiqlanmagan. Tasdiqlangan email orqali kiring.",
    };
  }

  if (!claims.sub || typeof claims.sub !== "string" || claims.sub.trim() === "") {
    return { ok: false, code: "missing_sub", message: "Google hisob identifikatori topilmadi." };
  }

  if (!claims.email || typeof claims.email !== "string") {
    return { ok: false, code: "missing_email", message: "Google hisob email manzili topilmadi." };
  }

  return { ok: true, claims };
}

/**
 * Resolve or link a verified Google identity to an application user.
 *
 * Rules:
 *   1. Look up auth_accounts by (provider='google', provider_account_id=sub).
 *   2. If found, verify active status and return existing user (role cannot change).
 *   3. If not found, check if users.email matches:
 *      - If user is admin -> REFUSE linking.
 *      - If student/teacher -> link auth_accounts atomically in transaction.
 *   4. If user does not exist -> create new active user with email_verified_at=now(),
 *      password_hash=null, role=desiredRole ('student' | 'teacher'), profile and auth_accounts.
 */
export async function resolveGoogleUser(
  claims: GoogleIdTokenClaims,
  desiredRole: "student" | "teacher",
): Promise<GoogleAuthResult> {
  const db = getDb();
  const normalizedEmail = normalizeEmail(claims.email);

  return await db.transaction(async (tx) => {
    // 1. Primary lookup by Google sub
    const existingAccounts = await tx
      .select({
        id: schema.authAccounts.id,
        userId: schema.authAccounts.userId,
      })
      .from(schema.authAccounts)
      .where(
        and(
          eq(schema.authAccounts.provider, "google"),
          eq(schema.authAccounts.providerAccountId, claims.sub),
        ),
      )
      .limit(1);

    const existingAccount = existingAccounts[0];
    if (existingAccount) {
      const userRows = await tx
        .select({
          id: schema.users.id,
          role: schema.users.role,
          accountStatus: schema.users.accountStatus,
        })
        .from(schema.users)
        .where(eq(schema.users.id, existingAccount.userId))
        .limit(1);

      const user = userRows[0];
      if (!user) {
        return { ok: false, code: "user_not_found", message: "Foydalanuvchi topilmadi." };
      }

      if (user.accountStatus === "deactivated") {
        return { ok: false, code: "account_deactivated", message: "Hisobingiz faolsizlantirilgan." };
      }

      // Existing user role is never mutated by Google auth
      return { ok: true, userId: user.id, role: user.role };
    }

    // 2. Secondary lookup by verified email
    const usersByEmail = await tx
      .select({
        id: schema.users.id,
        role: schema.users.role,
        accountStatus: schema.users.accountStatus,
        emailVerifiedAt: schema.users.emailVerifiedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    const matchedUser = usersByEmail[0];
    if (matchedUser) {
      // ADMIN PROTECTION: Operator accounts can NEVER be linked via public Google OAuth
      if (matchedUser.role === "admin") {
        return {
          ok: false,
          code: "admin_forbidden",
          message: "Administrator hisobiga umumiy Google orqali kirish taqiqlangan.",
        };
      }

      if (matchedUser.accountStatus === "deactivated") {
        return { ok: false, code: "account_deactivated", message: "Hisobingiz faolsizlantirilgan." };
      }

      // Link provider identity
      await tx.insert(schema.authAccounts).values({
        id: newId("acc"),
        userId: matchedUser.id,
        provider: "google",
        providerAccountId: claims.sub,
        providerEmail: normalizedEmail,
      });

      // Update email_verified_at if it wasn't verified already
      if (!matchedUser.emailVerifiedAt) {
        await tx
          .update(schema.users)
          .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.users.id, matchedUser.id));
      }

      // Existing role is preserved
      return { ok: true, userId: matchedUser.id, role: matchedUser.role };
    }

    // 3. New user registration via Google
    // Public registration can ONLY create student or teacher (never admin)
    const finalRole: "student" | "teacher" =
      desiredRole === "teacher" ? "teacher" : "student";
    const userId = newId("usr");
    const name = (claims.name?.trim() || "Foydalanuvchi").slice(0, 70);

    const now = new Date();
    await tx.insert(schema.users).values({
      id: userId,
      role: finalRole,
      email: normalizedEmail,
      phone: null,
      passwordHash: null,
      accountStatus: "active",
      emailVerifiedAt: now,
    });

    if (finalRole === "student") {
      await tx.insert(schema.studentProfiles).values({
        userId,
        role: "student",
        name,
        languages: [],
        interests: [],
        onboardingCompleted: false,
      });
    } else {
      const slug = await uniqueTeacherSlug(tx, slugifyName(name));
      await tx.insert(schema.teacherProfiles).values({
        userId,
        role: "teacher",
        slug,
        name,
        categories: [],
        levels: [],
        formats: [],
        languages: [],
        verification: "unverified",
        onboardingCompleted: false,
      });
    }

    await tx.insert(schema.authAccounts).values({
      id: newId("acc"),
      userId,
      provider: "google",
      providerAccountId: claims.sub,
      providerEmail: normalizedEmail,
    });

    return { ok: true, userId, role: finalRole };
  });
}
