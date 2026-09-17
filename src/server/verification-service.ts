import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { notifyActiveAdmins } from "./notification-service";
import { recordAdminEvent } from "./audit-service";
import {
  DOCUMENT_REVIEW_NOTICE,
  VERIFICATION_DOCUMENTS_REQUIRED_NOTE,
  isVerificationEligible,
  missingVerificationRequirements,
  type VerificationRequestState,
  type VerificationState,
} from "@/lib/teacher-verification";
import {
  attachDocumentsToRequest,
  listVerificationRequestDocuments,
  verificationDocumentsReadyInTx,
  type VerificationDocumentView,
} from "./file-service";

/* -------------------------------------------------------------------------- */
/* Teacher verification service — Phase 15.                                     */
/*                                                                              */
/* The teacher's PROFILE COLUMN (`teacher_profiles.verification`) is current    */
/* state; the REQUEST ROW is the application and its history. Both are written  */
/* in ONE transaction, so "pending" can never be persisted without an actual    */
/* application behind it (and vice versa).                                     */
/*                                                                              */
/* CONCURRENCY. Every decision starts by re-reading the request row with        */
/* SELECT … FOR UPDATE and re-checking that it is still `pending`. Two admins   */
/* racing the same application therefore serialise on that row: the first        */
/* commits a decision, the second sees a decided row and returns the SAME       */
/* deterministic answer WITHOUT writing a second audit row or notification.      */
/* That is also what makes a retried HTTP submission safe.                      */
/*                                                                              */
/* AUTHORIZATION. Nothing here accepts an admin id or a teacher id from a       */
/* caller's *claim*: `adminUserId` / `teacherUserId` are always the session     */
/* user resolved by the guard in the action layer. Ownership of a submission    */
/* comes from the session, never a form field.                                  */
/* -------------------------------------------------------------------------- */

export type VerificationErrorCode =
  | "not_found"
  | "invalid_transition"
  | "already_pending"
  | "ineligible"
  /** Phase 18: the required evidence is missing, so there is nothing to review. */
  | "missing_documents"
  /** The caller's identity is not an admin account (defence in depth). */
  | "forbidden"
  | "server_error";

export type VerificationResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: VerificationErrorCode; message: string };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

type RequestRow = typeof schema.teacherVerificationRequests.$inferSelect;

/* ------------------------------- projections ------------------------------- */

export interface VerificationRequestView {
  id: string;
  status: VerificationRequestState;
  submittedAt: Date;
  reviewedAt: Date | null;
  feedback: string | null;
}

function toRequestView(row: RequestRow): VerificationRequestView {
  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    feedback: row.feedback,
  };
}

/** One application row with the teacher it belongs to (admin queue). */
export interface VerificationQueueRow {
  requestId: string;
  teacherUserId: string;
  teacherSlug: string;
  teacherName: string;
  specialization: string | null;
  city: string | null;
  experienceYears: number | null;
  /** Profile trust state right now (a decided row may differ from it). */
  verification: VerificationState;
  requestStatus: VerificationRequestState;
  submittedAt: Date;
  feedback: string | null;
}

/* --------------------------- teacher-facing reads -------------------------- */

export interface TeacherVerificationState {
  state: VerificationState;
  /** The live application, if one is awaiting a decision. */
  pending: VerificationRequestView | null;
  /** Newest first. Includes the pending one when it exists. */
  history: VerificationRequestView[];
  /** Profile requirements still missing — empty means "may submit". */
  missing: ReturnType<typeof missingVerificationRequirements>;
  eligible: boolean;
}

/** Everything the teacher's verification surface needs, in one read. */
export async function getTeacherVerificationState(
  teacherUserId: string,
): Promise<TeacherVerificationState> {
  const db = getDb();
  const [profileRows, requestRows] = await Promise.all([
    db
      .select()
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.userId, teacherUserId))
      .limit(1),
    db
      .select()
      .from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherUserId))
      .orderBy(desc(schema.teacherVerificationRequests.createdAt)),
  ]);

  const profile = profileRows[0];
  const history = requestRows.map(toRequestView);
  const pending = history.find((request) => request.status === "pending") ?? null;

  /*
   * Eligibility is computed from the SAME pure requirement list the UI shows,
   * so the form never offers a submission the server would refuse.
   */
  const missing = profile
    ? missingVerificationRequirements({
        name: profile.name,
        specialization: profile.specialization,
        city: profile.city,
        languages: profile.languages,
        bio: profile.bio,
        approach: profile.approach,
        experienceYears: profile.experienceYears,
      })
    : [];

  return {
    state: profile?.verification ?? "unverified",
    pending,
    history,
    missing,
    eligible: profile !== null && missing.length === 0,
  };
}

/* --------------------------- teacher submission ---------------------------- */

/**
 * Submit (or re-submit) a verification application for the SESSION teacher.
 *
 * The teacher id is a server-side argument, never a form field. The whole
 * submission runs in one transaction:
 *   • the profile row is locked, so a concurrent submission cannot slip past;
 *   • profile completeness is re-checked HERE — the disabled button in the UI
 *     is convenience, not enforcement;
 *   • the profile moves to `pending` and a pending application row is created
 *     together, or neither happens.
 *
 * A second submission while one is live is refused by the partial unique index
 * as well as by the explicit check above it.
 */
export async function submitVerificationRequest(
  teacherUserId: string,
): Promise<VerificationResult<{ requestId: string }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      // Serialisation point: a double submit waits here, then sees `pending`.
      await tx.execute(
        sql`SELECT user_id FROM teacher_profiles WHERE user_id = ${teacherUserId} FOR UPDATE`,
      );

      const profileRows = await tx
        .select()
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, teacherUserId))
        .limit(1);
      const profile = profileRows[0];
      if (!profile) {
        return { ok: false as const, code: "not_found" as const, message: "Profil topilmadi." };
      }

      const live = await tx
        .select({ id: schema.teacherVerificationRequests.id })
        .from(schema.teacherVerificationRequests)
        .where(
          and(
            eq(schema.teacherVerificationRequests.teacherUserId, teacherUserId),
            eq(schema.teacherVerificationRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (live.length > 0) {
        return {
          ok: false as const,
          code: "already_pending" as const,
          message: "Sizda allaqachon ko‘rib chiqilayotgan ariza bor.",
        };
      }

      // Already verified? Re-applying is meaningless and would be dishonest.
      if (profile.verification === "verified") {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Profilingiz allaqachon tasdiqlangan.",
        };
      }

      /*
       * Completeness is enforced on the SERVER. `isVerificationEligible` is the
       * same pure predicate the dashboard renders, so the two cannot drift.
       */
      if (
        !isVerificationEligible({
          name: profile.name,
          specialization: profile.specialization,
          city: profile.city,
          languages: profile.languages,
          bio: profile.bio,
          approach: profile.approach,
          experienceYears: profile.experienceYears,
        })
      ) {
        return {
          ok: false as const,
          code: "ineligible" as const,
          message: "Ariza yuborishdan oldin profil ma’lumotlarini to‘ldiring.",
        };
      }

      /*
       * PHASE 18 EVIDENCE REQUIREMENT. Readiness is evaluated INSIDE this
       * transaction against the teacher's own ACTIVE documents, so the rows the
       * decision is made on are the rows that will be frozen a few lines later.
       * Nothing here trusts a client-supplied asset id: the set is derived from
       * `owner_user_id = session user`.
       */
      const readiness = await verificationDocumentsReadyInTx(tx, teacherUserId);
      if (!readiness.ready) {
        return {
          ok: false as const,
          code: "missing_documents" as const,
          message: VERIFICATION_DOCUMENTS_REQUIRED_NOTE,
        };
      }

      const requestId = newId("vrf");
      await tx.insert(schema.teacherVerificationRequests).values({
        id: requestId,
        teacherUserId,
        status: "pending",
      });

      /*
       * FREEZE THE EVIDENCE. From here the documents belong to this application,
       * a `delete` of the asset is refused by the FK and by the file service, and
       * the reviewer's record can never be edited after the fact.
       */
      const attached = await attachDocumentsToRequest(tx, {
        teacherUserId,
        verificationRequestId: requestId,
      });
      if (attached.missing.length > 0) {
        // Defensive: the readiness check above already covers this on the same
        // transaction, and a rollback here would be a bug, not a policy.
        return {
          ok: false as const,
          code: "missing_documents" as const,
          message: VERIFICATION_DOCUMENTS_REQUIRED_NOTE,
        };
      }

      // The profile column reflects current state. `verified` is never set here.
      await tx
        .update(schema.teacherProfiles)
        .set({ verification: "pending", updatedAt: new Date() })
        .where(eq(schema.teacherProfiles.userId, teacherUserId));

      await notifyActiveAdmins(tx, {
        type: "verification_submitted",
        title: "Yangi ustoz tasdiqlash arizasi",
        body: "Ustoz tasdiqlash uchun ariza va hujjatlarini yubordi.",
        href: `/admin/teachers/${teacherUserId}`,
      });

      return { ok: true as const, data: { requestId } };
    });
  } catch (error) {
    // A unique violation means a racing submit won: report it as such rather
    // than as a server fault, because that is what it is.
    if ((error as { code?: string }).code === "23505") {
      return {
        ok: false,
        code: "already_pending",
        message: "Sizda allaqachon ko‘rib chiqilayotgan ariza bor.",
      };
    }
    console.error("submitVerificationRequest failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Ariza yuborilmadi." };
  }
}

/* -------------------------------- admin reads ------------------------------ */

/**
 * The review queue. Oldest submission first by default, because a queue that
 * does not age-order is a queue that starves whoever applied first.
 *
 * Privacy: the teacher's phone number is NOT selected. An admin reviewing a
 * profile needs the profile, not the account's credential identifier.
 */
export async function listVerificationQueue(
  options: { status?: VerificationRequestState | "all"; limit?: number; offset?: number } = {},
): Promise<VerificationQueueRow[]> {
  const db = getDb();
  const status = options.status ?? "pending";
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const order = status === "pending"
    ? [asc(schema.teacherVerificationRequests.submittedAt), asc(schema.teacherVerificationRequests.id)]
    : [desc(schema.teacherVerificationRequests.submittedAt), desc(schema.teacherVerificationRequests.id)];

  const rows = await db
    .select({
      requestId: schema.teacherVerificationRequests.id,
      teacherUserId: schema.teacherVerificationRequests.teacherUserId,
      requestStatus: schema.teacherVerificationRequests.status,
      submittedAt: schema.teacherVerificationRequests.submittedAt,
      feedback: schema.teacherVerificationRequests.feedback,
      teacherSlug: schema.teacherProfiles.slug,
      teacherName: schema.teacherProfiles.name,
      specialization: schema.teacherProfiles.specialization,
      city: schema.teacherProfiles.city,
      experienceYears: schema.teacherProfiles.experienceYears,
      verification: schema.teacherProfiles.verification,
    })
    .from(schema.teacherVerificationRequests)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.teacherVerificationRequests.teacherUserId),
    )
    .where(
      status === "all"
        ? undefined
        : eq(schema.teacherVerificationRequests.status, status),
    )
    .orderBy(...order)
    .limit(limit)
    .offset(offset);

  return rows;
}

/** Factual queue sizes for the overview. Counts, never estimates. */
export async function getVerificationQueueCounts(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  verifiedTeachers: number;
}> {
  const db = getDb();
  const [statusRows, verifiedRows] = await Promise.all([
    db
      .select({
        status: schema.teacherVerificationRequests.status,
        total: count(schema.teacherVerificationRequests.id),
      })
      .from(schema.teacherVerificationRequests)
      .groupBy(schema.teacherVerificationRequests.status),
    db
      .select({ total: count(schema.teacherProfiles.userId) })
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.verification, "verified")),
  ]);

  const byStatus = new Map(statusRows.map((row) => [row.status, Number(row.total)]));
  return {
    pending: byStatus.get("pending") ?? 0,
    approved: byStatus.get("approved") ?? 0,
    rejected: byStatus.get("rejected") ?? 0,
    verifiedTeachers: Number(verifiedRows[0]?.total ?? 0),
  };
}

export interface TeacherReviewDetail {
  teacherUserId: string;
  slug: string;
  name: string;
  specialization: string | null;
  city: string | null;
  district: string | null;
  languages: string[];
  experienceYears: number | null;
  bio: string | null;
  approach: string | null;
  verification: VerificationState;
  isPublic: boolean;
  /** The live application, if any — the only thing actions may target. */
  pending: VerificationRequestView | null;
  history: VerificationRequestView[];
  /** Owned courses, minimal projection (title + lifecycle state). */
  courses: { id: string; title: string; status: string }[];
  /** Evidence of the LIVE application (frozen at submission). */
  documents: VerificationDocumentView[];
  /** Evidence of EVERY application, keyed by request id — history included. */
  documentsByRequest: Map<string, VerificationDocumentView[]>;
  documentReviewNotice: string;
}

/**
 * Full review context for one teacher. Returned to the admin ONLY.
 *
 * Not selected on purpose: phone, password hash, sessions, payments, and any
 * student data. Moderation never needs them, so they are not fetched.
 */
export async function getTeacherReviewDetail(
  teacherUserId: string,
): Promise<TeacherReviewDetail | null> {
  const db = getDb();
  const rows = await db
    .select({
      userId: schema.teacherProfiles.userId,
      slug: schema.teacherProfiles.slug,
      name: schema.teacherProfiles.name,
      specialization: schema.teacherProfiles.specialization,
      city: schema.teacherProfiles.city,
      district: schema.teacherProfiles.district,
      languages: schema.teacherProfiles.languages,
      experienceYears: schema.teacherProfiles.experienceYears,
      bio: schema.teacherProfiles.bio,
      approach: schema.teacherProfiles.approach,
      verification: schema.teacherProfiles.verification,
      isPublic: schema.teacherProfiles.isPublic,
    })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, teacherUserId))
    .limit(1);
  const teacher = rows[0];
  if (!teacher) return null;

  const [requestRows, courseRows] = await Promise.all([
    db
      .select()
      .from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherUserId))
      .orderBy(desc(schema.teacherVerificationRequests.createdAt)),
    db
      .select({
        id: schema.courses.id,
        title: schema.courses.title,
        status: schema.courses.status,
      })
      .from(schema.courses)
      .where(eq(schema.courses.teacherUserId, teacherUserId))
      .orderBy(desc(schema.courses.createdAt)),
  ]);

  const history = requestRows.map(toRequestView);

  /*
   * PHASE 18. Documents come from the FROZEN join table, so an admin reviewing a
   * request from months ago sees the evidence that was submitted WITH it — not
   * whatever the teacher happens to have uploaded since.
   */
  const pending = history.find((request) => request.status === "pending") ?? null;
  const documentsByRequest = new Map<string, VerificationDocumentView[]>();
  for (const request of history) {
    documentsByRequest.set(request.id, await listVerificationRequestDocuments(request.id));
  }

  return {
    teacherUserId: teacher.userId,
    slug: teacher.slug,
    name: teacher.name,
    specialization: teacher.specialization,
    city: teacher.city,
    district: teacher.district,
    languages: teacher.languages,
    experienceYears: teacher.experienceYears,
    bio: teacher.bio,
    approach: teacher.approach,
    verification: teacher.verification,
    isPublic: teacher.isPublic,
    pending,
    history,
    documents: pending ? (documentsByRequest.get(pending.id) ?? []) : [],
    documentsByRequest,
    courses: courseRows,
    documentReviewNotice: DOCUMENT_REVIEW_NOTICE,
  };
}

/* ------------------------------ admin decisions ---------------------------- */

type DecideOutcome =
  | "applied"
  | "already_decided"
  | "conflicting_decision"
  /** The caller's `adminUserId` is not an admin account (see decideVerification). */
  | "not_admin";

interface DecideResult {
  outcome: DecideOutcome;
  teacherUserId: string;
  teacherName: string;
  /** Set when the request had already been decided — for the caller's message. */
  existingStatus?: Exclude<VerificationRequestState, "pending">;
}

/**
 * Shared decision path for approve/reject.
 *
 * `nextRequestStatus` / `nextProfileStatus` are resolved by the TWO callers, so
 * this function contains no product policy — only the transactional shape:
 * lock, re-read, decide once, write exactly one audit row and one notification.
 */
async function decideVerification(
  tx: Tx,
  input: {
    requestId: string;
    adminUserId: string;
    nextRequestStatus: Exclude<VerificationRequestState, "pending">;
    nextProfileStatus: VerificationState;
    feedback: string | null;
  },
): Promise<DecideResult | null> {
  /*
   * 0. Re-check the REVIEWER'S ROLE inside the transaction.
   *
   * The action layer already required an admin session, and this is the second
   * lock on the same door: `reviewed_by_admin_user_id` is a plain FK to `users`,
   * so without this check a caller that passed a teacher's id would happily
   * record that teacher as the reviewer. Checking here means the audit trail
   * ("an ADMIN decided this") is true even if a future caller is wrong, and a
   * forged id can never reach a write.
   */
  const adminRows = await tx
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, input.adminUserId))
    .limit(1);
  if (adminRows[0]?.role !== "admin") {
    return { outcome: "not_admin", teacherUserId: "", teacherName: "" };
  }

  // 1. Lock the application row. A concurrent decision waits here.
  await tx.execute(
    sql`SELECT id FROM teacher_verification_requests WHERE id = ${input.requestId} FOR UPDATE`,
  );

  const currentRows = await tx
    .select()
    .from(schema.teacherVerificationRequests)
    .where(eq(schema.teacherVerificationRequests.id, input.requestId))
    .limit(1);
  const current = currentRows[0];
  if (!current) return null;

  const teacherRows = await tx
    .select({ name: schema.teacherProfiles.name })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, current.teacherUserId))
    .limit(1);
  const teacherName = teacherRows[0]?.name ?? "Ustoz";

  /*
   * 2. Already decided?
   *    • SAME decision replayed → idempotent no-op: no new audit row, no new
   *      notification, and the caller reports success deterministically.
   *    • a DIFFERENT decision → refused. An admin must not be able to flip a
   *      decided application from a stale tab; the decision is final.
   */
  if (current.status !== "pending") {
    return {
      outcome: current.status === input.nextRequestStatus ? "already_decided" : "conflicting_decision",
      teacherUserId: current.teacherUserId,
      teacherName,
      existingStatus: current.status,
    };
  }

  const now = new Date();

  // 3. Decide the application.
  await tx
    .update(schema.teacherVerificationRequests)
    .set({
      status: input.nextRequestStatus,
      reviewedAt: now,
      reviewedByAdminUserId: input.adminUserId,
      feedback: input.feedback,
      updatedAt: now,
    })
    .where(eq(schema.teacherVerificationRequests.id, input.requestId));

  /*
   * 4. Apply the CONSEQUENCE to the profile.
   *
   * Approving also sets `is_public`. Verification is the trust gate that makes
   * a profile publishable, and the public teacher directory requires both
   * `is_public` AND at least one published course — so without this a newly
   * verified teacher's published course would link to a profile page that 404s.
   * A profile with no published course still does not appear in the directory.
   */
  await tx
    .update(schema.teacherProfiles)
    .set({
      verification: input.nextProfileStatus,
      ...(input.nextProfileStatus === "verified" ? { isPublic: true } : {}),
      updatedAt: now,
    })
    .where(eq(schema.teacherProfiles.userId, current.teacherUserId));

  return { outcome: "applied", teacherUserId: current.teacherUserId, teacherName };
}

/** Approve a pending application. Admin session required by the caller. */
export async function approveVerification(
  requestId: string,
  adminUserId: string,
): Promise<VerificationResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const result = await decideVerification(tx, {
        requestId,
        adminUserId,
        nextRequestStatus: "approved",
        nextProfileStatus: "verified",
        feedback: null,
      });
      if (!result) {
        return { ok: false as const, code: "not_found" as const, message: "Ariza topilmadi." };
      }

      if (result.outcome === "not_admin") {
        /*
         * Unreachable from the UI (the action requires an admin session), but a
         * forged or mis-wired caller must not be able to write a decision.
         */
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu amal faqat administrator uchun.",
        };
      }
      if (result.outcome === "conflicting_decision") {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu ariza allaqachon boshqa qaror bilan hal qilingan.",
        };
      }
      if (result.outcome === "already_decided") {
        /*
         * A retry (or a losing race) must NOT produce a second audit row or a
         * second notification. We report the deterministic outcome instead.
         */
        return { ok: true as const, data: { idempotent: true } };
      }

      await recordAdminEvent(tx, {
        adminUserId,
        action: "teacher_verified",
        entityType: "teacher",
        entityId: result.teacherUserId,
        metadata: `verification=verified`,
      });

      await tx.insert(schema.notifications).values({
        id: newId("ntf"),
        userId: result.teacherUserId,
        type: "verification_approved",
        title: "Profilingiz tasdiqlandi",
        body: "Tasdiqlash arizangiz qabul qilindi. Endi kurslaringiz moderatsiyadan o‘tgach katalogda chiqadi.",
        href: "/teacher/dashboard/verification",
      });

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    console.error("approveVerification failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Qarorni saqlab bo‘lmadi." };
  }
}

/**
 * Reject a pending application with feedback.
 *
 * The profile returns to `unverified` — NOT to a permanent `rejected` state —
 * so the teacher can fix their profile and apply again. The rejection itself
 * lives on this request row forever.
 */
export async function rejectVerification(
  requestId: string,
  adminUserId: string,
  feedback: string,
): Promise<VerificationResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const result = await decideVerification(tx, {
        requestId,
        adminUserId,
        nextRequestStatus: "rejected",
        nextProfileStatus: "unverified",
        feedback,
      });
      if (!result) {
        return { ok: false as const, code: "not_found" as const, message: "Ariza topilmadi." };
      }
      if (result.outcome === "not_admin") {
        /*
         * Unreachable from the UI (the action requires an admin session), but a
         * forged or mis-wired caller must not be able to write a decision.
         */
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu amal faqat administrator uchun.",
        };
      }
      if (result.outcome === "conflicting_decision") {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu ariza allaqachon boshqa qaror bilan hal qilingan.",
        };
      }
      if (result.outcome === "already_decided") {
        return { ok: true as const, data: { idempotent: true } };
      }

      await recordAdminEvent(tx, {
        adminUserId,
        action: "teacher_verification_rejected",
        entityType: "teacher",
        entityId: result.teacherUserId,
        metadata: `verification=unverified`,
      });

      await tx.insert(schema.notifications).values({
        id: newId("ntf"),
        userId: result.teacherUserId,
        type: "verification_rejected",
        title: "Tasdiqlash arizasi qaytarildi",
        body: feedback,
        href: "/teacher/dashboard/verification",
      });

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    console.error("rejectVerification failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Qarorni saqlab bo‘lmadi." };
  }
}
