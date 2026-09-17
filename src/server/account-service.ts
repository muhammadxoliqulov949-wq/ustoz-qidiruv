import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { verifyPassword, hashPassword } from "./auth/password";

/* -------------------------------------------------------------------------- */
/* Account lifecycle and security.                                             */
/*                                                                              */
/* Deactivation is a reversible-data-preserving account state, not a cascade:   */
/* business rows, payments, enrollments and audit history remain available for   */
/* reconciliation. Authentication/session resolution rejects the state, and a   */
/* teacher's public profile is hidden so no private course can leak into the     */
/* marketplace. Password changes verify the existing hash and revoke sessions.  */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export type AccountStatus = (typeof schema.accountStatus.enumValues)[number];
export type AccountRole = (typeof schema.userRole.enumValues)[number];

export type AccountResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: "not_found" | "invalid_credentials" | "already_deactivated" | "forbidden" | "server_error"; message: string };

export interface AdminAccountView {
  id: string;
  role: AccountRole;
  accountStatus: AccountStatus;
  phone: string | null;
  email: string | null;
  name: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
}

async function lockAndReadUser(tx: Tx, userId: string) {
  await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
  const rows = await tx
    .select({
      id: schema.users.id,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
      accountStatus: schema.users.accountStatus,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Revoke every session, including sessions on other devices. */
export async function revokeAllUserSessions(userId: string, tx?: Tx): Promise<void> {
  const db = tx ?? getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<AccountResult> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const user = await lockAndReadUser(tx, input.userId);
      if (!user || user.accountStatus !== "active") {
        return { ok: false as const, code: "not_found" as const, message: "Hisob topilmadi." };
      }
      if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
        return { ok: false as const, code: "invalid_credentials" as const, message: "Joriy parol noto‘g‘ri." };
      }
      if (input.currentPassword === input.newPassword) {
        return { ok: false as const, code: "invalid_credentials" as const, message: "Yangi parol joriy paroldan farq qilsin." };
      }
      const passwordHash = await hashPassword(input.newPassword);
      await tx
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, input.userId));
      await revokeAllUserSessions(input.userId, tx);
      return { ok: true as const };
    });
  } catch (error) {
    console.error("changePassword failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Parol o‘zgartirilmadi." };
  }
}

/**
 * Deactivate an account without deleting business data. The password and the
 * literal confirmation are validated by the action layer; the service still
 * locks and rechecks the account to make concurrent requests idempotent-safe.
 */
export async function deactivateAccount(input: {
  userId: string;
  password: string;
}): Promise<AccountResult<{ alreadyDeactivated: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const user = await lockAndReadUser(tx, input.userId);
      if (!user) return { ok: false as const, code: "not_found" as const, message: "Hisob topilmadi." };
      if (user.accountStatus === "deactivated") {
        return { ok: true as const, data: { alreadyDeactivated: true } };
      }
      if (user.role === "admin") {
        return { ok: false as const, code: "forbidden" as const, message: "Administrator hisobini bu sahifadan deaktivasiyalab bo‘lmaydi." };
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) {
        return { ok: false as const, code: "invalid_credentials" as const, message: "Parol noto‘g‘ri." };
      }

      const now = new Date();
      await tx
        .update(schema.users)
        .set({ accountStatus: "deactivated", deactivatedAt: now, updatedAt: now })
        .where(and(eq(schema.users.id, input.userId), eq(schema.users.accountStatus, "active")));
      if (user.role === "teacher") {
        // Hide the public identity immediately; courses and financial history
        // remain for audit/reconciliation and are not hard-deleted.
        await tx
          .update(schema.teacherProfiles)
          .set({ isPublic: false, updatedAt: now })
          .where(eq(schema.teacherProfiles.userId, input.userId));
      }
      await revokeAllUserSessions(input.userId, tx);
      return { ok: true as const, data: { alreadyDeactivated: false } };
    });
  } catch (error) {
    console.error("deactivateAccount failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Hisob o‘chirilmadi." };
  }
}

const adminAccountProjection = {
  id: schema.users.id,
  role: schema.users.role,
  accountStatus: schema.users.accountStatus,
  phone: schema.users.phone,
  email: schema.users.email,
  createdAt: schema.users.createdAt,
  deactivatedAt: schema.users.deactivatedAt,
  studentName: schema.studentProfiles.name,
  teacherName: schema.teacherProfiles.name,
} as const;

function adminAccountQuery() {
  const db = getDb();
  return db
    .select(adminAccountProjection)
    .from(schema.users)
    .leftJoin(schema.studentProfiles, eq(schema.studentProfiles.userId, schema.users.id))
    .leftJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.users.id));
}

function accountView(row: {
  id: string;
  role: AccountRole;
  accountStatus: AccountStatus;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  studentName: string | null;
  teacherName: string | null;
}): AdminAccountView {
  return {
    id: row.id,
    role: row.role,
    accountStatus: row.accountStatus,
    phone: row.phone,
    email: row.email,
    name: row.studentName ?? row.teacherName ?? null,
    createdAt: row.createdAt,
    deactivatedAt: row.deactivatedAt,
  };
}

/** Admin view excludes password hashes, sessions and all provider secrets. */
export async function listAdminAccounts(options: {
  status?: AccountStatus | "all";
  role?: AccountRole | "all";
  limit?: number;
  offset?: number;
} = {}): Promise<AdminAccountView[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const predicates = [];
  if (options.status && options.status !== "all") predicates.push(eq(schema.users.accountStatus, options.status));
  if (options.role && options.role !== "all") predicates.push(eq(schema.users.role, options.role));
  const query = adminAccountQuery();
  const rows = await (predicates.length ? query.where(and(...predicates)) : query)
    .orderBy(desc(schema.users.createdAt), desc(schema.users.id))
    .limit(limit)
    .offset(offset);
  return rows.map(accountView);
}

export async function countAdminAccounts(options: { status?: AccountStatus | "all"; role?: AccountRole | "all" } = {}): Promise<number> {
  const db = getDb();
  const predicates = [];
  if (options.status && options.status !== "all") predicates.push(eq(schema.users.accountStatus, options.status));
  if (options.role && options.role !== "all") predicates.push(eq(schema.users.role, options.role));
  const rows = await db
    .select({ total: count(schema.users.id) })
    .from(schema.users)
    .where(predicates.length ? and(...predicates) : undefined);
  return Number(rows[0]?.total ?? 0);
}
