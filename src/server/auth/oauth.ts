import "server-only";
import { and, eq } from "drizzle-orm";
import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  verify as cryptoVerify,
} from "node:crypto";
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
/*   • CRYPTOGRAPHIC SIGNATURE VERIFICATION: ID token signature verified using  */
/*     trusted Google JWKS public keys (RSA-SHA256 / RS256);                    */
/*   • claims verified: iss, aud, exp, nonce, email_verified;                   */
/*   • Google stable account id (`sub`) is the authoritative provider identity; */
/*   • admin accounts are NEVER accessible or linkable via Google OAuth;        */
/*   • public Google auth cannot escalate or alter an existing user's role.     */
/* -------------------------------------------------------------------------- */

export const OAUTH_STATE_COOKIE = "ustoz_oauth_state";
export const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

export interface GoogleOAuthState {
  state: string;
  nonce: string;
  codeVerifier: string;
  role: "student" | "teacher";
  next?: string | null;
  issuedAt: number;
  expiresAt: number;
}

export type VerifyOAuthStateResult =
  | { ok: true; state: GoogleOAuthState }
  | {
      ok: false;
      code:
        | "unsigned_cookie"
        | "malformed_cookie"
        | "invalid_signature"
        | "expired_state"
        | "invalid_payload";
    };

let mockOAuthSecret: string | null = null;

/** Hook for tests to override OAuth state signing secret. */
export function setMockOAuthStateSecret(secret: string | null): void {
  mockOAuthSecret = secret;
}

/** Get secret used for signing and verifying OAuth state cookies. */
export function getOAuthStateSecret(): string {
  if (mockOAuthSecret !== null) return mockOAuthSecret;
  const env = serverEnv();
  if (env.AUTH_OAUTH_STATE_SECRET) return env.AUTH_OAUTH_STATE_SECRET;
  if (env.NODE_ENV === "test") {
    return "test-oauth-state-secret-at-least-32-chars-long-for-hmac-sha256";
  }
  throw new Error("AUTH_OAUTH_STATE_SECRET is not configured");
}

/**
 * Encode state cookie using versioned signed format:
 * v1.<base64url(payload)>.<base64url(hmac)>
 * HMAC-SHA256 covers the exact base64url-encoded payload.
 */
export function signOAuthState(
  payload: Omit<GoogleOAuthState, "issuedAt" | "expiresAt"> & {
    issuedAt?: number;
    expiresAt?: number;
  },
  secretOverride?: string,
): string {
  const signingSecret = secretOverride ?? getOAuthStateSecret();
  const now = Date.now();
  const fullPayload: GoogleOAuthState = {
    state: payload.state,
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
    role: payload.role,
    next: payload.next ?? null,
    issuedAt: payload.issuedAt ?? now,
    expiresAt: payload.expiresAt ?? now + OAUTH_STATE_TTL_SECONDS * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const hmac = createHmac("sha256", signingSecret).update(payloadB64).digest("base64url");
  return `v1.${payloadB64}.${hmac}`;
}

/**
 * Verify HMAC before parsing JSON or accessing any payload fields.
 * Uses constant-time signature comparison and verifies server-side expiration.
 */
export function verifyAndParseOAuthState(
  cookieValue: string | undefined | null,
  secretOverride?: string,
): VerifyOAuthStateResult {
  if (!cookieValue || typeof cookieValue !== "string") {
    return { ok: false, code: "unsigned_cookie" };
  }

  // Reject unsigned cookies (e.g. plain JSON, non-v1 format)
  if (!cookieValue.startsWith("v1.")) {
    return { ok: false, code: "unsigned_cookie" };
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return { ok: false, code: "malformed_cookie" };
  }

  const [version, payloadB64, signatureB64] = parts;
  if (version !== "v1" || !payloadB64 || !signatureB64) {
    return { ok: false, code: "malformed_cookie" };
  }

  const signingSecret = secretOverride ?? getOAuthStateSecret();
  const expectedHmac = createHmac("sha256", signingSecret).update(payloadB64).digest("base64url");

  // Constant-time HMAC comparison before JSON.parse or inspecting fields
  if (!safeEqual(signatureB64, expectedHmac)) {
    return { ok: false, code: "invalid_signature" };
  }

  // Parse JSON after cryptographic HMAC verification
  let raw: unknown;
  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    raw = JSON.parse(jsonStr);
  } catch {
    return { ok: false, code: "malformed_cookie" };
  }

  if (!raw || typeof raw !== "object") {
    return { ok: false, code: "invalid_payload" };
  }

  const p = raw as Record<string, unknown>;
  if (
    typeof p.state !== "string" ||
    typeof p.nonce !== "string" ||
    typeof p.codeVerifier !== "string" ||
    typeof p.issuedAt !== "number" ||
    typeof p.expiresAt !== "number"
  ) {
    return { ok: false, code: "invalid_payload" };
  }

  // Only student or teacher roles can be registered/authenticated via public Google flow
  if (p.role !== "student" && p.role !== "teacher") {
    return { ok: false, code: "invalid_payload" };
  }

  // Server-side timestamp/expiry check
  const now = Date.now();
  if (now > p.expiresAt) {
    return { ok: false, code: "expired_state" };
  }

  return {
    ok: true,
    state: {
      state: p.state,
      nonce: p.nonce,
      codeVerifier: p.codeVerifier,
      role: p.role,
      next: typeof p.next === "string" ? p.next : null,
      issuedAt: p.issuedAt,
      expiresAt: p.expiresAt,
    },
  };
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

export interface GoogleJwk extends Record<string, unknown> {
  kty: string;
  alg?: string;
  use?: string;
  kid: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: Map<string, GoogleJwk>;
  expiresAt: number;
}

export type GoogleAuthResult =
  | { ok: true; userId: string; role: "student" | "teacher"; next?: string | null }
  | { ok: false; code: string; message: string };

/* ------------------------------- JWKS Cache -------------------------------- */

let jwksCache: JwksCache | null = null;
let mockJwks: GoogleJwk[] | null = null;

/** Hook for tests to inject trusted test keys without calling Google. */
export function setMockGoogleJwks(keys: GoogleJwk[] | null): void {
  mockJwks = keys;
  jwksCache = null;
}

/** Fetch and cache Google's public JWKS keys. */
export async function getGoogleJwks(): Promise<Map<string, GoogleJwk>> {
  if (mockJwks !== null) {
    return new Map(mockJwks.map((k) => [k.kid, k]));
  }

  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${response.status}`);
  }

  const data = (await response.json()) as { keys?: GoogleJwk[] };
  const keyMap = new Map<string, GoogleJwk>();
  for (const key of data.keys ?? []) {
    if (key.kid && key.kty === "RSA") {
      keyMap.set(key.kid, key);
    }
  }

  // Cache for 1 hour
  jwksCache = { keys: keyMap, expiresAt: now + 3600 * 1000 };
  return keyMap;
}

/* ------------------------- Authorization Request --------------------------- */

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

  const statePayload: Omit<GoogleOAuthState, "issuedAt" | "expiresAt"> = {
    state,
    nonce,
    codeVerifier,
    role: options.role === "teacher" ? "teacher" : "student",
    next: options.next ?? null,
  };

  const signedState = signOAuthState(statePayload);

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, signedState, {
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

/* ------------------- Cryptographic Signature Verification ------------------ */

/**
 * Cryptographically verify the Google ID token signature against trusted Google JWKS.
 *
 * Algorithm restrictions:
 *   • strictly RS256 only (rejects symmetric "HS*", "none", or unapproved algos);
 *   • validates kid against Google's published JWKS;
 *   • verifies RSA-SHA256 digital signature over `header.payload`.
 */
export async function verifyGoogleIdTokenSignature(
  idToken: string,
): Promise<
  | { ok: true; header: { alg: string; kid: string }; payload: GoogleIdTokenClaims }
  | { ok: false; code: string; message: string }
> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return { ok: false, code: "malformed_token", message: "Google tokeni formati noto‘g‘ri." };
  }

  let header: { alg?: string; kid?: string };
  let payload: GoogleIdTokenClaims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "malformed_token", message: "Google tokeni qismlarini ochib bo‘lmadi." };
  }

  // 1. Strict algorithm restriction: RS256 only
  if (header.alg !== "RS256") {
    return {
      ok: false,
      code: "unsupported_algorithm",
      message: "Faqat RS256 algoritmi bilan imzolangan Google tokenlari qabul qilinadi.",
    };
  }

  if (!header.kid) {
    return { ok: false, code: "missing_kid", message: "Token sarlavhasida kalit identifikatori (kid) topilmadi." };
  }

  // 2. Fetch trusted Google public keys
  let jwks: Map<string, GoogleJwk>;
  try {
    jwks = await getGoogleJwks();
  } catch (err) {
    logError("Failed to fetch Google JWKS", err);
    return { ok: false, code: "jwks_fetch_failed", message: "Google imzo kalitlarini yuklab bo‘lmadi." };
  }

  let key = jwks.get(header.kid);
  if (!key && mockJwks === null) {
    // Retry once with fresh fetch for key rotation
    jwksCache = null;
    try {
      jwks = await getGoogleJwks();
      key = jwks.get(header.kid);
    } catch {
      // Ignore
    }
  }

  if (!key) {
    return { ok: false, code: "unknown_signing_key", message: "Google imzo kaliti topilmadi." };
  }

  // 3. Cryptographically verify signature using Node.js crypto
  try {
    const publicKey = createPublicKey({ key, format: "jwk" });
    const signedData = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], "base64url");
    const isValid = cryptoVerify("RSA-SHA256", signedData, publicKey, signature);

    if (!isValid) {
      return {
        ok: false,
        code: "invalid_signature",
        message: "Google tokeni imzosi haqiqiy emas (soxtalashtirilgan yoki o‘zgartirilgan).",
      };
    }
  } catch (err) {
    logError("Cryptographic signature verification failed", err);
    return { ok: false, code: "signature_verification_error", message: "Imzoni tekshirishda xatolik yuz berdi." };
  }

  return { ok: true, header: { alg: header.alg, kid: header.kid }, payload };
}

/** Validate ID token cryptographic signature and standard OIDC claims. */
export async function validateGoogleIdToken(
  idToken: string,
  expectedNonce: string,
  expectedClientId: string,
): Promise<{ ok: true; claims: GoogleIdTokenClaims } | { ok: false; code: string; message: string }> {
  // A. Cryptographic Signature Verification
  const sigResult = await verifyGoogleIdTokenSignature(idToken);
  if (!sigResult.ok) {
    return sigResult;
  }

  const claims = sigResult.payload;

  // B. Standard Claims Checks
  // 1. Issuer check (strict)
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!validIssuers.includes(claims.iss)) {
    return { ok: false, code: "invalid_issuer", message: "Google tokeni emitenti noto‘g‘ri." };
  }

  // 2. Audience check (strict)
  if (claims.aud !== expectedClientId) {
    return { ok: false, code: "invalid_audience", message: "Google tokeni auditoriyasi mos kelmadi." };
  }

  // 3. Expiration check (strict)
  const nowSec = Math.floor(Date.now() / 1000);
  if (claims.exp <= nowSec) {
    return { ok: false, code: "token_expired", message: "Google tokenining muddati tugagan." };
  }

  // 4. Nonce check (constant-time)
  if (!claims.nonce || !safeEqual(claims.nonce, expectedNonce)) {
    return { ok: false, code: "invalid_nonce", message: "Google sessiya xavfsizlik kodi mos kelmadi." };
  }

  // 5. Email verified check (strict)
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

/* ----------------------- User Resolution / Linking ------------------------- */

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

      // ADMIN PROTECTION: Operator accounts can NEVER authenticate via Google OAuth
      if (user.role === "admin") {
        return {
          ok: false,
          code: "admin_forbidden",
          message: "Administrator hisobiga umumiy Google orqali kirish taqiqlangan.",
        };
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
