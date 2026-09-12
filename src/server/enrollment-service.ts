import "server-only";
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { canTransition, type EnrollmentStatus } from "@/lib/enrollment-status";

/* -------------------------------------------------------------------------- */
/* Enrollment service — Phase 13.                                              */
/*                                                                              */
/* All enrollment business logic lives here. Server actions are thin wrappers   */
/* that authenticate, validate input and call one of these functions; route     */
/* components only render what they are handed. No Drizzle in JSX.              */
/*                                                                              */
/* THREE RULES THIS MODULE EXISTS TO ENFORCE                                    */
/*                                                                              */
/* 1. OCCUPANCY IS DERIVED. A seat is taken only by an `accepted` row. There is */
/*    no counter column and nothing is ever decremented, so cancelling an       */
/*    accepted place releases the seat automatically with no repair step.       */
/*                                                                              */
/* 2. ACCEPTANCE CANNOT OVERBOOK. `acceptRequest` locks the group row with      */
/*    SELECT ... FOR UPDATE before counting. Two concurrent acceptances of the  */
/*    final seat serialise on that lock, so exactly one succeeds and the other  */
/*    gets a deterministic capacity error. A bare COUNT would not be safe under */
/*    READ COMMITTED: both transactions would read the same pre-update count.   */
/*                                                                              */
/* 3. TRANSITIONS COME FROM THE CONTRACT. Every mutation checks                 */
/*    `canTransition(actor, from, to)` from lib/enrollment-status.ts, inside    */
/*    the same transaction that re-reads the current status, so a stale page    */
/*    cannot replay a decision.                                                 */
/* -------------------------------------------------------------------------- */

/** Result shape shared by every mutation in this module. */
export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: ServiceErrorCode; message: string };

export type ServiceErrorCode =
  | "not_found"
  | "invalid_transition"
  | "capacity_full"
  | "duplicate_request"
  | "invalid_group"
  | "server_error";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/* ------------------------------- notifications ----------------------------- */

type NotificationType = (typeof schema.notificationType.enumValues)[number];

/**
 * Insert a notification. Always called INSIDE the transaction that performed
 * the status change, so a notification can never describe a change that was
 * rolled back.
 */
async function notify(
  tx: Tx,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    href?: string;
  },
): Promise<void> {
  await tx.insert(schema.notifications).values({
    id: newId("ntf"),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    href: input.href ?? null,
  });
}

/** Append a transition to the immutable history. Also inside the transaction. */
async function recordEvent(
  tx: Tx,
  input: {
    requestId: string;
    actorUserId: string;
    from: EnrollmentStatus | null;
    to: EnrollmentStatus;
  },
): Promise<void> {
  await tx.insert(schema.enrollmentEvents).values({
    id: newId("evt"),
    enrollmentRequestId: input.requestId,
    actorUserId: input.actorUserId,
    fromStatus: input.from,
    toStatus: input.to,
  });
}

/* --------------------------------- capacity -------------------------------- */

/**
 * Accepted-seat counts for a set of groups. This is THE occupancy definition
 * used by both the public marketplace and the teacher dashboard, so the two
 * can never disagree.
 */
export async function getAcceptedCounts(groupIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (groupIds.length === 0) return counts;
  const db = getDb();
  const rows = await db
    .select({
      groupId: schema.enrollmentRequests.groupId,
      taken: count(schema.enrollmentRequests.id),
    })
    .from(schema.enrollmentRequests)
    .where(
      and(
        inArray(schema.enrollmentRequests.groupId, groupIds),
        eq(schema.enrollmentRequests.status, "accepted"),
      ),
    )
    .groupBy(schema.enrollmentRequests.groupId);
  for (const row of rows) counts.set(row.groupId, Number(row.taken));
  return counts;
}

/** Remaining seats for one group, floored at zero. */
export async function getGroupAvailability(
  groupId: string,
): Promise<{ capacity: number; accepted: number; available: number } | null> {
  const db = getDb();
  const rows = await db
    .select({ capacity: schema.courseGroups.capacity })
    .from(schema.courseGroups)
    .where(eq(schema.courseGroups.id, groupId))
    .limit(1);
  const group = rows[0];
  if (!group) return null;
  const accepted = (await getAcceptedCounts([groupId])).get(groupId) ?? 0;
  return {
    capacity: group.capacity,
    accepted,
    available: Math.max(0, group.capacity - accepted),
  };
}

/* -------------------------------- read models ------------------------------ */

/**
 * Requests addressed to THIS teacher's courses.
 *
 * PRIVACY: the student's phone is deliberately not selected. The teacher gets
 * the name, the enrollment context and the note — nothing else the workflow
 * does not need.
 */
export async function listTeacherRequests(
  teacherUserId: string,
  options: { status?: EnrollmentStatus } = {},
) {
  const db = getDb();
  const where = [eq(schema.courses.teacherUserId, teacherUserId)];
  if (options.status) where.push(eq(schema.enrollmentRequests.status, options.status));

  return db
    .select({
      id: schema.enrollmentRequests.id,
      status: schema.enrollmentRequests.status,
      note: schema.enrollmentRequests.note,
      decisionReason: schema.enrollmentRequests.decisionReason,
      createdAt: schema.enrollmentRequests.createdAt,
      courseId: schema.courses.id,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupId: schema.courseGroups.id,
      groupTitle: schema.courseGroups.title,
      groupCapacity: schema.courseGroups.capacity,
      studentName: schema.studentProfiles.name,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .where(and(...where))
    .orderBy(desc(schema.enrollmentRequests.createdAt));
}

/** Per-status counts for the teacher's filter chips and overview tiles. */
export async function getTeacherRequestCounts(
  teacherUserId: string,
): Promise<Record<EnrollmentStatus, number> & { total: number }> {
  const db = getDb();
  const rows = await db
    .select({
      status: schema.enrollmentRequests.status,
      total: count(schema.enrollmentRequests.id),
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .where(eq(schema.courses.teacherUserId, teacherUserId))
    .groupBy(schema.enrollmentRequests.status);

  const result = { submitted: 0, accepted: 0, rejected: 0, cancelled: 0, total: 0 };
  for (const row of rows) {
    result[row.status] = Number(row.total);
    result.total += Number(row.total);
  }
  return result;
}

/**
 * Remaining capacity across every group of every course this teacher owns.
 *
 * FACTUAL ONLY: total seats, seats taken by accepted students, seats left.
 * No revenue, no conversion rate, no growth figure — none of those are things
 * this product actually knows.
 */
export async function getTeacherCapacitySummary(
  teacherUserId: string,
): Promise<{ capacity: number; accepted: number; available: number }> {
  const db = getDb();
  const rows = await db
    .select({
      capacity: sum(schema.courseGroups.capacity),
    })
    .from(schema.courseGroups)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.courseGroups.courseId))
    .where(eq(schema.courses.teacherUserId, teacherUserId));

  const acceptedRows = await db
    .select({ total: count(schema.enrollmentRequests.id) })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .where(
      and(
        eq(schema.courses.teacherUserId, teacherUserId),
        eq(schema.enrollmentRequests.status, "accepted"),
      ),
    );

  const capacity = Number(rows[0]?.capacity ?? 0);
  const accepted = Number(acceptedRows[0]?.total ?? 0);
  // Clamped: availability is never presented as a negative number.
  return { capacity, accepted, available: Math.max(0, capacity - accepted) };
}

/**
 * One request, only if it belongs to a course owned by this teacher.
 *
 * Ownership is in the SQL predicate, so another teacher's request id is
 * indistinguishable from a nonexistent one — the id leaks nothing.
 */
export async function getTeacherRequestDetail(requestId: string, teacherUserId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.enrollmentRequests.id,
      status: schema.enrollmentRequests.status,
      note: schema.enrollmentRequests.note,
      decisionReason: schema.enrollmentRequests.decisionReason,
      createdAt: schema.enrollmentRequests.createdAt,
      updatedAt: schema.enrollmentRequests.updatedAt,
      courseId: schema.courses.id,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      courseFormat: schema.courses.format,
      groupId: schema.courseGroups.id,
      groupTitle: schema.courseGroups.title,
      groupDays: schema.courseGroups.days,
      groupStartTime: schema.courseGroups.startTime,
      groupEndTime: schema.courseGroups.endTime,
      groupStartDate: schema.courseGroups.startDate,
      groupCapacity: schema.courseGroups.capacity,
      groupFormat: schema.courseGroups.format,
      groupLocation: schema.courseGroups.location,
      studentName: schema.studentProfiles.name,
      // No phone. See the privacy note at the top of this module.
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .where(
      and(
        eq(schema.enrollmentRequests.id, requestId),
        eq(schema.courses.teacherUserId, teacherUserId),
      ),
    )
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const availability = await getGroupAvailability(found.groupId);
  const history = await db
    .select({
      id: schema.enrollmentEvents.id,
      fromStatus: schema.enrollmentEvents.fromStatus,
      toStatus: schema.enrollmentEvents.toStatus,
      createdAt: schema.enrollmentEvents.createdAt,
    })
    .from(schema.enrollmentEvents)
    .where(eq(schema.enrollmentEvents.enrollmentRequestId, requestId))
    .orderBy(schema.enrollmentEvents.createdAt);

  return { ...found, availability, history };
}

/** Requests belonging to THIS student. */
export async function listStudentRequests(studentUserId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.enrollmentRequests.id,
      status: schema.enrollmentRequests.status,
      note: schema.enrollmentRequests.note,
      decisionReason: schema.enrollmentRequests.decisionReason,
      createdAt: schema.enrollmentRequests.createdAt,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      coursePriceUzs: schema.courses.priceUzs,
      groupTitle: schema.courseGroups.title,
      groupDays: schema.courseGroups.days,
      groupStartTime: schema.courseGroups.startTime,
      groupStartDate: schema.courseGroups.startDate,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .where(eq(schema.enrollmentRequests.studentUserId, studentUserId))
    .orderBy(desc(schema.enrollmentRequests.createdAt));
}

/* -------------------------------- mutations -------------------------------- */

/**
 * Teacher accepts a submitted request.
 *
 * Ordered exactly as the capacity rule requires:
 *   1. re-read the request WITH ownership in the predicate;
 *   2. validate the transition against the contract;
 *   3. LOCK the group row (FOR UPDATE) — this is the serialisation point;
 *   4. count accepted rows for that group;
 *   5. refuse if the group is full;
 *   6. update, record the event, notify the student.
 * All inside one transaction, so a failure at any step leaves nothing behind.
 */
export async function acceptRequest(
  requestId: string,
  teacherUserId: string,
): Promise<ServiceResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: schema.enrollmentRequests.id,
        status: schema.enrollmentRequests.status,
        groupId: schema.enrollmentRequests.groupId,
        studentUserId: schema.enrollmentRequests.studentUserId,
        courseTitle: schema.courses.title,
        groupTitle: schema.courseGroups.title,
      })
      .from(schema.enrollmentRequests)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
      .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
      .where(
        and(
          eq(schema.enrollmentRequests.id, requestId),
          eq(schema.courses.teacherUserId, teacherUserId),
        ),
      )
      .limit(1);

    const request = rows[0];
    if (!request) {
      return { ok: false as const, code: "not_found" as const, message: "So‘rov topilmadi." };
    }
    if (!canTransition("teacher", request.status, "accepted")) {
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Bu so‘rov allaqachon hal qilingan.",
      };
    }

    // Serialisation point. Any other transaction trying to accept into this
    // group waits here until we commit, so the count below cannot go stale.
    await tx.execute(
      sql`SELECT id FROM course_groups WHERE id = ${request.groupId} FOR UPDATE`,
    );

    const capacityRows = await tx
      .select({ capacity: schema.courseGroups.capacity })
      .from(schema.courseGroups)
      .where(eq(schema.courseGroups.id, request.groupId))
      .limit(1);
    const capacity = capacityRows[0]?.capacity ?? 0;

    const acceptedRows = await tx
      .select({ taken: count(schema.enrollmentRequests.id) })
      .from(schema.enrollmentRequests)
      .where(
        and(
          eq(schema.enrollmentRequests.groupId, request.groupId),
          eq(schema.enrollmentRequests.status, "accepted"),
        ),
      );
    const accepted = Number(acceptedRows[0]?.taken ?? 0);

    if (accepted >= capacity) {
      return {
        ok: false as const,
        code: "capacity_full" as const,
        message: "Guruhda bo‘sh joy qolmagan.",
      };
    }

    await tx
      .update(schema.enrollmentRequests)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(schema.enrollmentRequests.id, requestId));

    await recordEvent(tx, {
      requestId,
      actorUserId: teacherUserId,
      from: request.status,
      to: "accepted",
    });

    await notify(tx, {
      userId: request.studentUserId,
      type: "enrollment_accepted",
      title: "So‘rovingiz qabul qilindi",
      body: `${request.courseTitle} — ${request.groupTitle}. To‘lov tizimi hali ulanmagan.`,
      href: "/dashboard/courses",
    });

    return { ok: true as const };
  });
}

/** Teacher rejects a submitted request, with an optional short reason. */
export async function rejectRequest(
  requestId: string,
  teacherUserId: string,
  reason: string | null,
): Promise<ServiceResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: schema.enrollmentRequests.id,
        status: schema.enrollmentRequests.status,
        studentUserId: schema.enrollmentRequests.studentUserId,
        courseTitle: schema.courses.title,
        groupTitle: schema.courseGroups.title,
      })
      .from(schema.enrollmentRequests)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
      .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
      .where(
        and(
          eq(schema.enrollmentRequests.id, requestId),
          eq(schema.courses.teacherUserId, teacherUserId),
        ),
      )
      .limit(1);

    const request = rows[0];
    if (!request) {
      return { ok: false as const, code: "not_found" as const, message: "So‘rov topilmadi." };
    }
    if (!canTransition("teacher", request.status, "rejected")) {
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Bu so‘rov allaqachon hal qilingan.",
      };
    }

    await tx
      .update(schema.enrollmentRequests)
      .set({ status: "rejected", decisionReason: reason, updatedAt: new Date() })
      .where(eq(schema.enrollmentRequests.id, requestId));

    await recordEvent(tx, {
      requestId,
      actorUserId: teacherUserId,
      from: request.status,
      to: "rejected",
    });

    await notify(tx, {
      userId: request.studentUserId,
      type: "enrollment_rejected",
      title: "So‘rovingiz rad etildi",
      body: reason
        ? `${request.courseTitle} — ${request.groupTitle}. Sabab: ${reason}`
        : `${request.courseTitle} — ${request.groupTitle}.`,
      href: "/dashboard/courses",
    });

    return { ok: true as const };
  });
}

/**
 * Student withdraws their own request.
 *
 * Legal from `submitted` and from `accepted`. Withdrawing an accepted place
 * frees the seat with no bookkeeping, because availability is a COUNT over
 * accepted rows rather than a stored number. The owning teacher is notified
 * only when an accepted place is given up — a pending withdrawal is not
 * something they acted on.
 */
export async function cancelRequest(
  requestId: string,
  studentUserId: string,
): Promise<ServiceResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: schema.enrollmentRequests.id,
        status: schema.enrollmentRequests.status,
        courseTitle: schema.courses.title,
        groupTitle: schema.courseGroups.title,
        teacherUserId: schema.courses.teacherUserId,
        studentName: schema.studentProfiles.name,
      })
      .from(schema.enrollmentRequests)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
      .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
      .innerJoin(
        schema.studentProfiles,
        eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
      )
      // Ownership in the predicate: another student's request matches nothing.
      .where(
        and(
          eq(schema.enrollmentRequests.id, requestId),
          eq(schema.enrollmentRequests.studentUserId, studentUserId),
        ),
      )
      .limit(1);

    const request = rows[0];
    if (!request) {
      return { ok: false as const, code: "not_found" as const, message: "So‘rov topilmadi." };
    }
    if (!canTransition("student", request.status, "cancelled")) {
      // Covers double-cancel and cancelling a rejected request.
      return {
        ok: false as const,
        code: "invalid_transition" as const,
        message: "Bu so‘rovni bekor qilib bo‘lmaydi.",
      };
    }

    const wasAccepted = request.status === "accepted";

    await tx
      .update(schema.enrollmentRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(schema.enrollmentRequests.id, requestId));

    await recordEvent(tx, {
      requestId,
      actorUserId: studentUserId,
      from: request.status,
      to: "cancelled",
    });

    if (wasAccepted) {
      await notify(tx, {
        userId: request.teacherUserId,
        type: "enrollment_cancelled",
        title: "Qabul qilingan o‘quvchi bekor qildi",
        body: `${request.studentName} — ${request.courseTitle} (${request.groupTitle}). Guruhda joy bo‘shadi.`,
        href: "/teacher/dashboard/requests",
      });
    }

    return { ok: true as const };
  });
}

/**
 * Record the creation of a request: the initial event plus the teacher's
 * "new request" notification. Called from inside the submission transaction.
 */
export async function recordSubmission(
  tx: Tx,
  input: {
    requestId: string;
    studentUserId: string;
    studentName: string;
    teacherUserId: string;
    courseTitle: string;
    groupTitle: string;
  },
): Promise<void> {
  await recordEvent(tx, {
    requestId: input.requestId,
    actorUserId: input.studentUserId,
    from: null,
    to: "submitted",
  });
  await notify(tx, {
    userId: input.teacherUserId,
    type: "enrollment_submitted",
    title: "Yangi yozilish so‘rovi",
    body: `${input.studentName} — ${input.courseTitle} (${input.groupTitle}).`,
    href: `/teacher/dashboard/requests/${input.requestId}`,
  });
}
