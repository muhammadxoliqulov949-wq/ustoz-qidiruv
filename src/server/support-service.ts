import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { insertNotification, notifyActiveAdmins } from "./notification-service";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  canTransitionSupportTicket,
  type SupportCategory,
  type SupportRelatedType,
  type SupportStatus,
} from "@/lib/support";

/* -------------------------------------------------------------------------- */
/* Support/report service — Phase 23.                                          */
/*                                                                              */
/* The action layer authenticates the reporter/operator. This module still      */
/* re-checks operator role inside status transitions, locks the ticket row and  */
/* writes the reporter notification in the same transaction as the transition.  */
/* No ticket query selects password hashes, session tokens or provider secrets. */
/* -------------------------------------------------------------------------- */

type TicketRow = typeof schema.supportTickets.$inferSelect;

export type SupportErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_transition"
  | "invalid_input"
  | "server_error";

export type SupportResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: SupportErrorCode; message: string };

export interface SupportTicketView {
  id: string;
  category: SupportCategory;
  categoryLabel: string;
  message: string;
  relatedEntityType: SupportRelatedType | null;
  relatedEntityId: string | null;
  status: SupportStatus;
  statusLabel: string;
  reporterUserId: string | null;
  reporterRole: "student" | "teacher" | "admin" | null;
  reporterName: string | null;
  assignedAdminUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

function toView(row: TicketRow & {
  reporterRole?: "student" | "teacher" | "admin" | null;
  studentName?: string | null;
  teacherName?: string | null;
}): SupportTicketView {
  const status = row.status as SupportStatus;
  const category = row.category as SupportCategory;
  return {
    id: row.id,
    category,
    categoryLabel: SUPPORT_CATEGORY_LABEL[category],
    message: row.message,
    relatedEntityType: row.relatedEntityType as SupportRelatedType | null,
    relatedEntityId: row.relatedEntityId,
    status,
    statusLabel: SUPPORT_STATUS_LABEL[status],
    reporterUserId: row.reporterUserId,
    reporterRole: row.reporterRole ?? null,
    reporterName: row.studentName ?? row.teacherName ?? null,
    assignedAdminUserId: row.assignedAdminUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
  };
}

const adminProjection = {
  ticket: schema.supportTickets,
  reporterRole: schema.users.role,
  studentName: schema.studentProfiles.name,
  teacherName: schema.teacherProfiles.name,
} as const;

function adminQuery() {
  const db = getDb();
  return db
    .select(adminProjection)
    .from(schema.supportTickets)
    .leftJoin(schema.users, eq(schema.users.id, schema.supportTickets.reporterUserId))
    .leftJoin(schema.studentProfiles, eq(schema.studentProfiles.userId, schema.supportTickets.reporterUserId))
    .leftJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.supportTickets.reporterUserId));
}

/** Create a ticket and notify every active operator in the same transaction. */
export async function createSupportTicket(input: {
  reporterUserId: string;
  category: SupportCategory;
  message: string;
  relatedEntityType: SupportRelatedType | null;
  relatedEntityId: string | null;
}): Promise<SupportResult<{ ticketId: string }>> {
  const db = getDb();
  const message = input.message.trim();
  try {
    const ticketId = newId("sup");
    await db.transaction(async (tx) => {
      await tx.insert(schema.supportTickets).values({
        id: ticketId,
        reporterUserId: input.reporterUserId,
        category: input.category,
        message,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        status: "open",
      });
      await notifyActiveAdmins(tx, {
        type: "support_submitted",
        title: "Yangi yordam murojaati",
        body: `${SUPPORT_CATEGORY_LABEL[input.category]} bo‘yicha yangi murojaat navbatga qo‘shildi.`,
        href: `/admin/support/${ticketId}`,
      });
    });
    return { ok: true, data: { ticketId } };
  } catch (error) {
    console.error("createSupportTicket failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Murojaat yuborilmadi." };
  }
}

/** Reporter-scoped history. */
export async function listOwnSupportTickets(
  reporterUserId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<SupportTicketView[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const db = getDb();
  const rows = await db
    .select({ ticket: schema.supportTickets })
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.reporterUserId, reporterUserId))
    .orderBy(desc(schema.supportTickets.createdAt), desc(schema.supportTickets.id))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => toView(row.ticket));
}

export async function countOwnSupportTickets(reporterUserId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ total: count(schema.supportTickets.id) })
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.reporterUserId, reporterUserId));
  return Number(rows[0]?.total ?? 0);
}

/** Operator queue. Defaults to open work and never loads the whole table. */
export async function listSupportTickets(options: {
  status?: SupportStatus | "live" | "all";
  limit?: number;
  offset?: number;
} = {}): Promise<SupportTicketView[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const status = options.status ?? "live";
  const filter =
    status === "live"
      ? inArray(schema.supportTickets.status, ["open", "in_progress"])
      : status === "all"
        ? undefined
        : eq(schema.supportTickets.status, status);
  const query = adminQuery();
  const rows = await (filter ? query.where(filter) : query)
    .orderBy(asc(schema.supportTickets.createdAt), asc(schema.supportTickets.id))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => toView({
    ...row.ticket,
    reporterRole: row.reporterRole,
    studentName: row.studentName,
    teacherName: row.teacherName,
  }));
}

export async function countSupportTickets(options: {
  status?: SupportStatus | "live" | "all";
} = {}): Promise<number> {
  const db = getDb();
  const status = options.status ?? "live";
  const filter =
    status === "live"
      ? inArray(schema.supportTickets.status, ["open", "in_progress"])
      : status === "all"
        ? undefined
        : eq(schema.supportTickets.status, status);
  const rows = await db
    .select({ total: count(schema.supportTickets.id) })
    .from(schema.supportTickets)
    .where(filter);
  return Number(rows[0]?.total ?? 0);
}

export async function getSupportTicketForAdmin(ticketId: string): Promise<SupportTicketView | null> {
  const rows = await adminQuery().where(eq(schema.supportTickets.id, ticketId)).limit(1);
  const row = rows[0];
  return row
    ? toView({
        ...row.ticket,
        reporterRole: row.reporterRole,
        studentName: row.studentName,
        teacherName: row.teacherName,
      })
    : null;
}

export async function getSupportQueueCounts(): Promise<Record<SupportStatus | "live" | "all", number>> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.supportTickets.status, total: count(schema.supportTickets.id) })
    .from(schema.supportTickets)
    .groupBy(schema.supportTickets.status);
  const counts: Record<SupportStatus | "live" | "all", number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    live: 0,
    all: 0,
  };
  for (const row of rows) {
    counts[row.status] = Number(row.total);
    counts.all += Number(row.total);
    if (row.status === "open" || row.status === "in_progress") counts.live += Number(row.total);
  }
  return counts;
}

/**
 * Operator-only status transition. The role check is repeated inside the
 * transaction so a future caller cannot attribute a ticket action to a teacher.
 */
export async function transitionSupportTicket(input: {
  ticketId: string;
  status: SupportStatus;
  adminUserId: string;
}): Promise<SupportResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const admin = await tx
        .select({ role: schema.users.role, accountStatus: schema.users.accountStatus })
        .from(schema.users)
        .where(eq(schema.users.id, input.adminUserId))
        .limit(1);
      if (admin[0]?.role !== "admin" || admin[0].accountStatus !== "active") {
        return { ok: false as const, code: "forbidden" as const, message: "Bu amal faqat faol administrator uchun." };
      }

      await tx.execute(sql`SELECT id FROM support_tickets WHERE id = ${input.ticketId} FOR UPDATE`);
      const rows = await tx
        .select()
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.id, input.ticketId))
        .limit(1);
      const current = rows[0];
      if (!current) return { ok: false as const, code: "not_found" as const, message: "Murojaat topilmadi." };
      if (current.status === input.status) return { ok: true as const, data: { idempotent: true } };
      if (!canTransitionSupportTicket(current.status, input.status)) {
        return { ok: false as const, code: "invalid_transition" as const, message: "Bu holatga o‘tish mumkin emas." };
      }

      const now = new Date();
      await tx
        .update(schema.supportTickets)
        .set({
          status: input.status,
          assignedAdminUserId: input.adminUserId,
          updatedAt: now,
          resolvedAt: input.status === "resolved" ? now : input.status === "open" || input.status === "in_progress" ? null : current.resolvedAt,
          closedAt: input.status === "closed" ? now : input.status === "open" || input.status === "in_progress" ? null : current.closedAt,
        })
        .where(eq(schema.supportTickets.id, input.ticketId));

      if (current.reporterUserId) {
        await insertNotification(tx, {
          userId: current.reporterUserId,
          type: "support_status_changed",
          title: `Murojaat holati: ${SUPPORT_STATUS_LABEL[input.status]}`,
          body: input.status === "closed"
            ? "Murojaat yopildi. Muammo davom etsa, yangi murojaat yuboring."
            : "Operator murojaatingiz holatini yangiladi.",
          href: "/support",
        });
      }
      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    console.error("transitionSupportTicket failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Murojaat holati saqlanmadi." };
  }
}

/** Small safe count used by the maintenance script; no message payloads. */
export async function countClosedSupportTicketsBefore(cutoff: Date): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ total: count(schema.supportTickets.id) })
    .from(schema.supportTickets)
    .where(and(eq(schema.supportTickets.status, "closed"), sql`${schema.supportTickets.closedAt} < ${cutoff}`));
  return Number(rows[0]?.total ?? 0);
}
