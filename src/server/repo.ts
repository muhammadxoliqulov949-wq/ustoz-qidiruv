import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";

/* -------------------------------------------------------------------------- */
/* Read repositories — Phase 11.                                               */
/*                                                                              */
/* Every function takes the AUTHENTICATED user id from the caller (which got it */
/* from the session) and filters by it in SQL. No function accepts a role or an */
/* "act as" id, so a page cannot accidentally read another account's rows.      */
/* Private fields (phone, password hash, session tokens) are never selected     */
/* into anything that reaches a public surface.                                 */
/* -------------------------------------------------------------------------- */

export async function getStudentProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTeacherProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Courses owned by THIS teacher only. */
export async function getTeacherCourses(teacherUserId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      status: schema.courses.status,
      format: schema.courses.format,
      level: schema.courses.level,
      priceUzs: schema.courses.priceUzs,
      city: schema.courses.city,
      createdAt: schema.courses.createdAt,
    })
    .from(schema.courses)
    .where(eq(schema.courses.teacherUserId, teacherUserId))
    .orderBy(desc(schema.courses.createdAt));
}

/** Enrollment requests owned by THIS student only. */
export async function getStudentEnrollmentRequests(studentUserId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.enrollmentRequests.id,
      status: schema.enrollmentRequests.status,
      note: schema.enrollmentRequests.note,
      createdAt: schema.enrollmentRequests.createdAt,
      courseId: schema.courses.id,
      courseTitle: schema.courses.title,
      courseSlug: schema.courses.slug,
      groupId: schema.courseGroups.id,
      groupTitle: schema.courseGroups.title,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(
      schema.courseGroups,
      eq(schema.courseGroups.id, schema.enrollmentRequests.groupId),
    )
    .where(eq(schema.enrollmentRequests.studentUserId, studentUserId))
    .orderBy(desc(schema.enrollmentRequests.createdAt));
}

/** Requests addressed to THIS teacher's courses (read-only in Phase 11). */
export async function getTeacherEnrollmentRequests(teacherUserId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.enrollmentRequests.id,
      status: schema.enrollmentRequests.status,
      createdAt: schema.enrollmentRequests.createdAt,
      courseTitle: schema.courses.title,
      groupTitle: schema.courseGroups.title,
      studentName: schema.studentProfiles.name,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollmentRequests.courseId))
    .innerJoin(
      schema.courseGroups,
      eq(schema.courseGroups.id, schema.enrollmentRequests.groupId),
    )
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.enrollmentRequests.studentUserId),
    )
    .where(eq(schema.courses.teacherUserId, teacherUserId))
    .orderBy(desc(schema.enrollmentRequests.createdAt));
}

export async function getCourseGroups(courseId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.courseGroups)
    .where(eq(schema.courseGroups.courseId, courseId))
    .orderBy(asc(schema.courseGroups.startDate));
}

/** Ownership-checked single course fetch. */
export async function getOwnedCourse(courseId: string, teacherUserId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, teacherUserId)))
    .limit(1);
  return rows[0] ?? null;
}
