import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";

/* -------------------------------------------------------------------------- */
/* Admin audit log — Phase 15.                                                 */
/*                                                                              */
/* APPEND-ONLY. This module can INSERT and SELECT. There is deliberately no     */
/* update or delete path anywhere in the codebase for `admin_audit_events`, so  */
/* an admin action cannot be quietly rewritten after the fact.                  */
/*                                                                              */
/* `recordAdminEvent` is always called INSIDE the transaction that performs the */
/* decision, for the same reason notifications are: an audit row must never     */
/* describe something that rolled back, and a decision must never commit        */
/* without leaving a trace.                                                     */
/*                                                                              */
/* WHAT GOES IN `metadata`: a short, safe, human-readable summary — a slug, an  */
/* identifier, a status word. NEVER a payload dump, never a secret, never       */
/* student data, never a password hash, never provider credentials.             */
/* -------------------------------------------------------------------------- */

export type AdminAuditAction = (typeof schema.adminAuditAction.enumValues)[number];
/**
 * Which kind of record an action was performed on.
 *
 * Phase 17 adds `refund`: a refund decision has a financial consequence, so it
 * is audited exactly like a verification or a moderation decision. The database
 * CHECK lists the same three values.
 */
export type AdminAuditEntityType = "teacher" | "course" | "refund";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export interface AdminAuditInput {
  adminUserId: string;
  action: AdminAuditAction;
  entityType: AdminAuditEntityType;
  entityId: string;
  /** Optional safe summary. Truncated defensively; the DB also CHECKs ≤ 300. */
  metadata?: string | null;
}

function safeMetadata(metadata: string | null | undefined): string | null {
  if (metadata === null || metadata === undefined) return null;
  const trimmed = metadata.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, 300);
}

/**
 * Append one audit row. Called inside the decision transaction.
 * `id` is a random opaque id — never derived from the entity.
 */
export async function recordAdminEvent(tx: Tx, input: AdminAuditInput): Promise<void> {
  await tx.insert(schema.adminAuditEvents).values({
    id: newId("aud"),
    adminUserId: input.adminUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: safeMetadata(input.metadata),
  });
}

/**
 * Narrow the free-text `entity_type` column to the three values the CHECK
 * constraint allows. Anything unexpected is treated as a teacher record, which
 * is the behaviour this reader had before refunds existed.
 */
function narrowEntityType(value: string): AdminAuditEntityType {
  if (value === "course") return "course";
  if (value === "refund") return "refund";
  return "teacher";
}

/* --------------------------------- reading --------------------------------- */

export interface AuditEventView {
  id: string;
  action: AdminAuditAction;
  /** Narrowed from the text column: the table CHECK allows only these two. */
  entityType: AdminAuditEntityType;
  entityId: string;
  metadata: string | null;
  createdAt: Date;
  /** Display only — the admin's phone is NEVER selected. */
  adminName: string;
}

/**
 * The audit trail, newest first.
 *
 * The admin's NAME is joined in for readability; their phone number, sessions
 * and credentials are deliberately not selected. `entity_id` may point at a
 * deleted row (the log outlives its subject), so nothing here joins to the
 * entity itself.
 */
export async function listAuditEvents(options: { limit?: number } = {}): Promise<AuditEventView[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.adminAuditEvents.id,
      action: schema.adminAuditEvents.action,
      entityType: schema.adminAuditEvents.entityType,
      entityId: schema.adminAuditEvents.entityId,
      metadata: schema.adminAuditEvents.metadata,
      createdAt: schema.adminAuditEvents.createdAt,
      adminId: schema.adminAuditEvents.adminUserId,
      teacherName: schema.teacherProfiles.name,
    })
    .from(schema.adminAuditEvents)
    .leftJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.adminAuditEvents.adminUserId),
    )
    .orderBy(desc(schema.adminAuditEvents.createdAt))
    .limit(options.limit ?? 100);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    /*
     * Phase 17 widened this from a two-way guess to an explicit narrowing: the
     * old `=== "course" ? "course" : "teacher"` turned a REFUND decision into a
     * "teacher" decision, which would have misfiled the audit trail and pointed
     * the activity page at the wrong detail route.
     */
    entityType: narrowEntityType(row.entityType),
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt,
    // Admins normally have no teacher profile, so the id is the honest fallback.
    adminName: row.teacherName ?? row.adminId,
  }));
}

/** Total number of recorded decisions — a factual count, nothing more. */
export async function countAuditEvents(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.adminAuditEvents.id })
    .from(schema.adminAuditEvents);
  return rows.length;
}
