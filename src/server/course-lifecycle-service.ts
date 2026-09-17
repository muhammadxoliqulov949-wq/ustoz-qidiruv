import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { canTransitionCourse, type CourseLifecycleAction, type CourseState } from "@/lib/course-moderation";

/* -------------------------------------------------------------------------- */
/* Teacher course lifecycle.                                                   */
/*                                                                              */
/* A lifecycle action is not a client-supplied target status. The service maps   */
/* an intent to one target, locks the owned course, re-reads account/profile     */
/* state and applies the shared transition contract. Public visibility remains   */
/* status = published; pause/archive retain all course, enrollment and payment   */
/* rows. Same-state retry is idempotent and stale/conflicting transitions are    */
/* refused.                                                                      */
/* -------------------------------------------------------------------------- */

export type CourseLifecycleResult =
  | { ok: true; data: { status: CourseState; idempotent: boolean } }
  | { ok: false; code: "not_found" | "forbidden" | "invalid_transition" | "server_error"; message: string };

const targetFor: Record<CourseLifecycleAction, CourseState> = {
  pause: "paused",
  resume: "published",
  archive: "archived",
};

export async function transitionOwnedCourse(input: {
  courseId: string;
  teacherUserId: string;
  action: CourseLifecycleAction;
}): Promise<CourseLifecycleResult> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM courses WHERE id = ${input.courseId} FOR UPDATE`);
      const rows = await tx
        .select({
          id: schema.courses.id,
          status: schema.courses.status,
          teacherUserId: schema.courses.teacherUserId,
          accountStatus: schema.users.accountStatus,
          verification: schema.teacherProfiles.verification,
        })
        .from(schema.courses)
        .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
        .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
        .where(and(eq(schema.courses.id, input.courseId), eq(schema.courses.teacherUserId, input.teacherUserId)))
        .limit(1);
      const course = rows[0];
      if (!course) return { ok: false as const, code: "not_found" as const, message: "Kurs topilmadi." };
      if (course.accountStatus !== "active") return { ok: false as const, code: "forbidden" as const, message: "Faol hisob talab qilinadi." };

      const current = course.status as CourseState;
      const target = targetFor[input.action];
      if (current === target) return { ok: true as const, data: { status: current, idempotent: true } };
      if (!canTransitionCourse("teacher", current, target)) {
        return { ok: false as const, code: "invalid_transition" as const, message: "Kursning hozirgi holatidan bu amalni bajarib bo‘lmaydi." };
      }
      if (input.action === "resume" && course.verification !== "verified") {
        return { ok: false as const, code: "forbidden" as const, message: "Tasdiqlangan ustoz hisobisiz kursni katalogga qaytarib bo‘lmaydi." };
      }

      const now = new Date();
      const update: { status: CourseState; updatedAt: Date; archivedAt?: Date | null } = {
        status: target,
        updatedAt: now,
      };
      if (target === "archived") update.archivedAt = now;
      if (target === "published") update.archivedAt = null;
      await tx
        .update(schema.courses)
        .set(update)
        .where(and(eq(schema.courses.id, input.courseId), eq(schema.courses.teacherUserId, input.teacherUserId)));
      return { ok: true as const, data: { status: target, idempotent: false } };
    });
  } catch (error) {
    console.error("transitionOwnedCourse failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { ok: false, code: "server_error", message: "Kurs holati saqlanmadi." };
  }
}
