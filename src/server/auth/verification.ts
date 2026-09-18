import "server-only";
import { eq, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb, schema } from "../db/client";
import { hashToken, newId } from "./ids";
import { normalizeEmail } from "@/lib/email";
import { serverEnv } from "../env";

/* -------------------------------------------------------------------------- */
/* Email verification token lifecycle — Phase 23.5.                           */
/*                                                                              */
/* Single-use, expiring verification tokens:                                    */
/*   • raw token is 32 cryptographically random bytes (base64url);              */
/*   • database stores only the SHA-256 hash (never the raw token);             */
/*   • issuing a new token invalidates/deletes all prior tokens for that user;   */
/*   • verification is transactional: marks user verified and deletes the token */
/*     row in the same atomic block (re-play / reuse is impossible);            */
/*   • expired tokens are cleanly rejected and deleted.                         */
/* -------------------------------------------------------------------------- */

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type VerifyEmailResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; code: "invalid_token" | "expired" | "already_verified" | "user_not_found"; message: string };

/**
 * Mint a single valid verification token for a user.
 * Mechanically invalidates any prior unused tokens for this user first.
 */
export async function createVerificationToken(
  userId: string,
  email: string,
  tx?: Tx,
): Promise<string> {
  const db = tx ?? getDb();
  const normalized = normalizeEmail(email);
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  // Invalidate any existing unused tokens for this user
  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, userId));

  await db.insert(schema.emailVerificationTokens).values({
    id: newId("evt"),
    userId,
    tokenHash,
    email: normalized,
    expiresAt,
  });

  return rawToken;
}

/**
 * Build the full verification link for email templates.
 */
export function buildVerificationUrl(token: string): string {
  const env = serverEnv();
  const base = env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Consume a verification token transactionally.
 * Single-use: deletes the token and marks the user email verified atomically.
 */
export async function verifyEmailToken(rawToken: string): Promise<VerifyEmailResult> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 256) {
    return {
      ok: false,
      code: "invalid_token",
      message: "Tasdiqlash kodi noto‘g‘ri yoki yaroqsiz.",
    };
  }

  const tokenHash = hashToken(rawToken);
  const db = getDb();

  return await db.transaction(async (tx) => {
    const tokenRows = await tx
      .select({
        id: schema.emailVerificationTokens.id,
        userId: schema.emailVerificationTokens.userId,
        email: schema.emailVerificationTokens.email,
        expiresAt: schema.emailVerificationTokens.expiresAt,
      })
      .from(schema.emailVerificationTokens)
      .where(eq(schema.emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    const tokenRow = tokenRows[0];
    if (!tokenRow) {
      return {
        ok: false,
        code: "invalid_token",
        message: "Tasdiqlash havolasi yaroqsiz yoki allaqachon ishlatilgan.",
      };
    }

    const now = new Date();
    if (tokenRow.expiresAt < now) {
      await tx
        .delete(schema.emailVerificationTokens)
        .where(eq(schema.emailVerificationTokens.id, tokenRow.id));
      return {
        ok: false,
        code: "expired",
        message: "Tasdiqlash havolasining muddati o‘tgan. Iltimos, yangi havola so‘rang.",
      };
    }

    const userRows = await tx
      .select({
        id: schema.users.id,
        accountStatus: schema.users.accountStatus,
        emailVerifiedAt: schema.users.emailVerifiedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, tokenRow.userId))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      await tx
        .delete(schema.emailVerificationTokens)
        .where(eq(schema.emailVerificationTokens.id, tokenRow.id));
      return {
        ok: false,
        code: "user_not_found",
        message: "Foydalanuvchi hisobi topilmadi.",
      };
    }

    // Single-use: delete the token row
    await tx
      .delete(schema.emailVerificationTokens)
      .where(eq(schema.emailVerificationTokens.id, tokenRow.id));

    // Update user's email verification timestamp
    await tx
      .update(schema.users)
      .set({
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));

    return {
      ok: true,
      userId: user.id,
      email: tokenRow.email,
    };
  });
}

/** Opportunistic sweep for expired verification tokens. */
export async function pruneExpiredVerificationTokens(): Promise<number> {
  const db = getDb();
  try {
    const deleted = await db
      .delete(schema.emailVerificationTokens)
      .where(lt(schema.emailVerificationTokens.expiresAt, new Date()))
      .returning();
    return deleted.length;
  } catch {
    return 0;
  }
}
