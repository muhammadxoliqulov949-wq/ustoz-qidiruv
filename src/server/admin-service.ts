import "server-only";
import { count, eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";

/* -------------------------------------------------------------------------- */
/* admin-service — Phase 15 admin projections.                                  */
/*                                                                              */
/* This module owns the ONLY queries the admin area runs for aggregates. It      */
/* exists so that:                                                              */
/*   • the admin UI never builds a Drizzle query (layering rule 21);             */
/*   • every projection is written once, here, where it is easy to audit for     */
/*     privacy (rule 17).                                                        */
/*                                                                              */
/* A NOTE ON WHAT IS NOT SELECTED. Nothing in this file reads a password hash, a */
/* session row or a token, and no admin screen ever will: those columns are not  */
/* reachable from the admin area because no admin projection selects them.       */
/* -------------------------------------------------------------------------- */

export interface AdminOverview {
  /** Applications waiting for a decision — the admin's work queue. */
  pendingVerifications: number;
  /** Courses submitted and waiting for a publish/return decision. */
  pendingModeration: number;
  /** Teachers the marketplace currently treats as verified. */
  verifiedTeachers: number;
  /** Courses genuinely live in the public catalogue right now. */
  publishedCourses: number;
  /** Courses in teacher-owned `draft` state (never public). */
  draftCourses: number;
  /** Decisions recorded in the append-only audit log. */
  auditEvents: number;
}

/**
 * The dashboard's numbers.
 *
 * Every value is a COUNT over real rows — no estimate, no cached metric, no
 * chart input. If a number is zero the screen says zero, because "we have not
 * decided anything yet" is information the operator needs.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const db = getDb();

  const [
    pendingVerificationRows,
    verifiedTeacherRows,
    pendingModerationRows,
    publishedCourseRows,
    draftCourseRows,
    auditEventRows,
  ] = await Promise.all([
    db
      .select({ total: count(schema.teacherVerificationRequests.id) })
      .from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.status, "pending")),
    db
      .select({ total: count(schema.teacherProfiles.userId) })
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.verification, "verified")),
    db
      .select({ total: count(schema.courseModerationReviews.id) })
      .from(schema.courseModerationReviews)
      .where(eq(schema.courseModerationReviews.status, "pending")),
    db
      .select({ total: count(schema.courses.id) })
      .from(schema.courses)
      .where(eq(schema.courses.status, "published")),
    db
      .select({ total: count(schema.courses.id) })
      .from(schema.courses)
      .where(eq(schema.courses.status, "draft")),
    db.select({ total: count(schema.adminAuditEvents.id) }).from(schema.adminAuditEvents),
  ]);

  return {
    pendingVerifications: Number(pendingVerificationRows[0]?.total ?? 0),
    pendingModeration: Number(pendingModerationRows[0]?.total ?? 0),
    verifiedTeachers: Number(verifiedTeacherRows[0]?.total ?? 0),
    publishedCourses: Number(publishedCourseRows[0]?.total ?? 0),
    draftCourses: Number(draftCourseRows[0]?.total ?? 0),
    auditEvents: Number(auditEventRows[0]?.total ?? 0),
  };
}

/**
 * A minimal teacher lookup for the audit view's deep links.
 *
 * Deliberately tiny: given a teacher user id, return ONLY the slug needed to
 * build `/admin/teachers/<id>`. Returns null when the account no longer exists
 * or is not a teacher, so a stale audit row renders as plain text instead of a
 * link that 404s.
 */
export async function getTeacherHandle(
  teacherUserId: string,
): Promise<{ teacherUserId: string; name: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ userId: schema.teacherProfiles.userId, name: schema.teacherProfiles.name })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, teacherUserId))
    .limit(1);
  const row = rows[0];
  return row ? { teacherUserId: row.userId, name: row.name } : null;
}

/**
 * The single factual state line the admin shells and the overview show. Kept as
 * a function so the several admin routes cannot disagree about what "current"
 * means.
 *
 * Two independent COUNT queries on purpose: counting across a join would
 * multiply the teacher total by each teacher's course rows.
 */
export async function getAdminStatusLine(): Promise<string> {
  const db = getDb();
  const [teacherRows, courseRows] = await Promise.all([
    db.select({ total: count(schema.teacherProfiles.userId) }).from(schema.teacherProfiles),
    db.select({ total: count(schema.courses.id) }).from(schema.courses),
  ]);
  return `${Number(teacherRows[0]?.total ?? 0)} ustoz · ${Number(courseRows[0]?.total ?? 0)} kurs`;
}

/**
 * Course counts grouped by lifecycle state, for the moderation queue header.
 * A GROUP BY over real rows — the admin sees the actual distribution, including
 * the states that are NOT actionable.
 */
export async function getCourseStateCounts(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.courses.status, total: count(schema.courses.id) })
    .from(schema.courses)
    .groupBy(schema.courses.status);
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

/**
 * How many courses a teacher owns per state — used by the teacher DETAIL page so
 * a reviewer can see at a glance whether the applicant has anything waiting.
 *
 * Ownership comes from the `courses.teacher_user_id` column, so this can never
 * report another teacher's course.
 */
export async function countTeacherCoursesByState(
  teacherUserId: string,
): Promise<{ draft: number; ready: number; published: number }> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.courses.status, total: count(schema.courses.id) })
    .from(schema.courses)
    .where(eq(schema.courses.teacherUserId, teacherUserId))
    .groupBy(schema.courses.status);
  const byStatus = new Map(rows.map((row) => [row.status, Number(row.total)]));
  return {
    draft: byStatus.get("draft") ?? 0,
    ready: byStatus.get("ready") ?? 0,
    published: byStatus.get("published") ?? 0,
  };
}
