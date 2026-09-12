"use server";

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { AuthError, requireRole } from "../auth/guards";
import { newId } from "../auth/ids";
import {
  cancelEnrollmentSchema,
  enrollmentRequestSchema,
  fieldErrorsFrom,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Enrollment foundation — Phase 11.                                           */
/*                                                                              */
/* IMPLEMENTED: a genuine, authenticated student may submit ONE real            */
/* EnrollmentRequest row, and cancel their own. Everything is transactional     */
/* and every check is server-side:                                              */
/*   • session must be a student (role from the cookie, never the form);        */
/*   • course must exist;                                                       */
/*   • group must exist AND belong to that course — verified in SQL and         */
/*     additionally impossible to violate thanks to the composite FK;           */
/*   • duplicate live requests are rejected by a UNIQUE constraint.             */
/*                                                                              */
/* DELIBERATELY NOT IMPLEMENTED: teacher approve/reject, payment, and seat      */
/* decrement/reservation. Seat inventory would need a transactional counter the */
/* product has not specified yet, so no seat count is written or faked.         */
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

    const db = getDb();
    const requestId = newId("enr");

    const result = await db.transaction(async (tx) => {
      const group = await tx
        .select({ id: schema.courseGroups.id })
        .from(schema.courseGroups)
        .where(
          and(
            eq(schema.courseGroups.id, parsed.data.groupId),
            // Consistency check: the group must belong to THIS course.
            eq(schema.courseGroups.courseId, parsed.data.courseId),
          ),
        )
        .limit(1);
      if (group.length === 0) {
        return { ok: false as const, code: "invalid_group", message: "Guruh bu kursga tegishli emas." };
      }

      const existing = await tx
        .select({ id: schema.enrollmentRequests.id })
        .from(schema.enrollmentRequests)
        .where(
          and(
            eq(schema.enrollmentRequests.studentUserId, user.id),
            eq(schema.enrollmentRequests.groupId, parsed.data.groupId),
            eq(schema.enrollmentRequests.status, "submitted"),
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

      await tx.insert(schema.enrollmentRequests).values({
        id: requestId,
        studentUserId: user.id,
        courseId: parsed.data.courseId,
        groupId: parsed.data.groupId,
        note: parsed.data.note,
        status: "submitted",
      });
      return { ok: true as const };
    });

    if (!result.ok) return result;
    return { ok: true, data: { requestId } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, code: error.code, message: error.message };
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

    const db = getDb();
    // Ownership is part of the WHERE clause: another student's request simply
    // does not match, so there is nothing to forget to check.
    const owned = await db
      .select({ id: schema.enrollmentRequests.id })
      .from(schema.enrollmentRequests)
      .where(
        and(
          eq(schema.enrollmentRequests.id, parsed.data.requestId),
          eq(schema.enrollmentRequests.studentUserId, user.id),
        ),
      )
      .limit(1);
    if (owned.length === 0) {
      return { ok: false, code: "not_found", message: "So‘rov topilmadi." };
    }
    await db
      .update(schema.enrollmentRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(schema.enrollmentRequests.id, parsed.data.requestId),
          eq(schema.enrollmentRequests.studentUserId, user.id),
        ),
      );
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
