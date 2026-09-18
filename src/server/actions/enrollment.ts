"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "../db/client";
import { AuthError, requireRole } from "../auth/guards";
import { newId } from "../auth/ids";
import { cancelRequest, recordSubmission } from "../enrollment-service";
import { LIVE_REQUEST_STATUSES } from "@/lib/enrollment-status";
import {
  cancelEnrollmentSchema,
  enrollmentRequestSchema,
  fieldErrorsFrom,
  type ActionResult,
} from "../validation";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMITED_MESSAGE,
  consumeRateLimit,
  rateLimitKey,
} from "../rate-limit";
import { isUniqueViolation } from "../log";

/* -------------------------------------------------------------------------- */
/* Enrollment submission and student withdrawal — Phase 11, extended in 13.    */
/*                                                                              */
/* Every check is server-side and inside one transaction:                       */
/*   • session must be a student (role from the cookie, never the form);        */
/*   • course must be PUBLISHED and the group must belong to it — verified in   */
/*     the SQL predicate, and additionally impossible to violate thanks to the  */
/*     composite FK;                                                            */
/*   • the group must still have a free seat (capacity minus ACCEPTED rows);    */
/*   • a student may hold only ONE LIVE request per group, enforced by a        */
/*     partial unique index so it holds even against a concurrent double        */
/*     submit.                                                                  */
/*                                                                              */
/* Phase 13 additions: submission records an enrollment event and notifies the  */
/* owning teacher, and withdrawal goes through the shared transition contract   */
/* (so cancelling twice, or cancelling a rejected request, is refused).         */
/*                                                                              */
/* STILL NOT IMPLEMENTED: payment of any kind. Acceptance is a place in a       */
/* group, never a paid enrolment, and no copy implies otherwise.                */
/* -------------------------------------------------------------------------- */

export async function submitEnrollmentRequestAction(
  form: FormData,
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const user = await requireRole("student");
    const parsed = enrollmentRequestSchema.safeParse({
      courseId: String(form.get("courseId") ?? ""),
      groupId: String(form.get("groupId") ?? ""),
      note: String(form.get("note") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "So‘rov ma’lumotlari noto‘g‘ri.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    // Phase 22: per-student submit budget, before the transaction.
    const submitBudget = await consumeRateLimit(
      RATE_LIMIT_POLICIES.enrollmentSubmit,
      rateLimitKey("enrollment:submit", user.id),
    );
    if (!submitBudget.allowed) {
      return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
    }

    const db = getDb();
    const requestId = newId("enr");

    const result = await db.transaction(async (tx) => {
      // Phase 12: the group must belong to this course AND the course must be
      // PUBLISHED. Enrolling into a private draft is refused at the database
      // predicate, so a guessed draft id cannot be turned into a request.
      const group = await tx
        .select({
          id: schema.courseGroups.id,
          title: schema.courseGroups.title,
          capacity: schema.courseGroups.capacity,
          courseTitle: schema.courses.title,
          teacherUserId: schema.courses.teacherUserId,
        })
        .from(schema.courseGroups)
        .innerJoin(schema.courses, eq(schema.courses.id, schema.courseGroups.courseId))
        .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
        .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
        .where(
          and(
            eq(schema.courseGroups.id, parsed.data.groupId),
            eq(schema.courseGroups.courseId, parsed.data.courseId),
            eq(schema.courses.status, "published"),
            eq(schema.teacherProfiles.isPublic, true),
            eq(schema.users.accountStatus, "active"),
          ),
        )
        .limit(1);
      const target = group[0];
      if (!target) {
        return { ok: false as const, code: "invalid_group", message: "Guruh bu kursga tegishli emas." };
      }

      // A LIVE request is submitted or accepted. Rejected and cancelled rows
      // do not block re-applying. The partial unique index enforces this too;
      // probing first lets us return an honest message instead of a crash.
      const existing = await tx
        .select({ id: schema.enrollmentRequests.id })
        .from(schema.enrollmentRequests)
        .where(
          and(
            eq(schema.enrollmentRequests.studentUserId, user.id),
            eq(schema.enrollmentRequests.groupId, parsed.data.groupId),
            inArray(schema.enrollmentRequests.status, [...LIVE_REQUEST_STATUSES]),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        return {
          ok: false as const,
          code: "duplicate_request",
          message: "Bu guruhga so‘rovingiz allaqachon yuborilgan.",
        };
      }

      // A full group cannot take new requests. Occupancy is ACCEPTED rows only
      // — pending requests never block another student.
      const acceptedRows = await tx
        .select({ taken: count(schema.enrollmentRequests.id) })
        .from(schema.enrollmentRequests)
        .where(
          and(
            eq(schema.enrollmentRequests.groupId, parsed.data.groupId),
            eq(schema.enrollmentRequests.status, "accepted"),
          ),
        );
      if (Number(acceptedRows[0]?.taken ?? 0) >= target.capacity) {
        return {
          ok: false as const,
          code: "capacity_full",
          message: "Bu guruhda bo‘sh joy qolmagan.",
        };
      }

      const profile = await tx
        .select({ name: schema.studentProfiles.name })
        .from(schema.studentProfiles)
        .where(eq(schema.studentProfiles.userId, user.id))
        .limit(1);

      await tx.insert(schema.enrollmentRequests).values({
        id: requestId,
        studentUserId: user.id,
        courseId: parsed.data.courseId,
        groupId: parsed.data.groupId,
        note: parsed.data.note,
        status: "submitted",
      });

      // History + teacher notification, in the SAME transaction as the insert.
      await recordSubmission(tx, {
        requestId,
        studentUserId: user.id,
        studentName: profile[0]?.name ?? "O‘quvchi",
        teacherUserId: target.teacherUserId,
        courseTitle: target.courseTitle,
        groupTitle: target.title,
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/courses");
    revalidatePath("/teacher/dashboard/requests");
    revalidatePath("/notifications");
    return { ok: true, data: { requestId } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, code: error.code, message: error.message };
    }
    // Phase 22: a unique violation means a racing double-submit won between
    // the pre-check and the insert. That is a duplicate, not a server fault.
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        code: "duplicate_request",
        message: "Bu guruhga so‘rovingiz allaqachon yuborilgan.",
      };
    }
    console.error("submitEnrollmentRequestAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "So‘rov saqlanmadi." };
  }
}

export async function cancelEnrollmentRequestAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("student");
    const parsed = cancelEnrollmentSchema.safeParse({
      requestId: String(form.get("requestId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri so‘rov identifikatori." };
    }

    // Phase 22: per-student cancellation budget, before the decision.
    const cancelBudget = await consumeRateLimit(
      RATE_LIMIT_POLICIES.enrollmentCancel,
      rateLimitKey("enrollment:cancel", user.id),
    );
    if (!cancelBudget.allowed) {
      return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
    }

    // Phase 13: the service owns ownership, the transition contract, the event
    // record and the teacher notification when an ACCEPTED place is released.
    // Cancelling twice is now refused instead of silently "succeeding".
    const result = await cancelRequest(parsed.data.requestId, user.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/courses");
    revalidatePath("/teacher/dashboard/requests");
    revalidatePath("/notifications");
    revalidatePath("/courses");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error("cancelEnrollmentRequestAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Bekor qilinmadi." };
  }
}
