import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

/* -------------------------------------------------------------------------- */
/* Phase 12 — teacher course management reads.                                 */
/* Every function takes the OWNER user id from the caller's session and puts   */
/* it in the WHERE clause, so a row that is not yours is never selected.       */
/* -------------------------------------------------------------------------- */

/** Owned courses split into public (published) and drafts, newest first. */
export async function getTeacherDashboardCourses(teacherUserId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      status: schema.courses.status,
      format: schema.courses.format,
      level: schema.courses.level,
      priceUzs: schema.courses.priceUzs,
      city: schema.courses.city,
      location: schema.courses.location,
      summary: schema.courses.summary,
      image: schema.courses.image,
      createdAt: schema.courses.createdAt,
    })
    .from(schema.courses)
    .where(eq(schema.courses.teacherUserId, teacherUserId))
    .orderBy(desc(schema.courses.createdAt));

  const ids = rows.map((row) => row.id);
  const groups =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(schema.courseGroups)
          .where(inArray(schema.courseGroups.courseId, ids))
          .orderBy(asc(schema.courseGroups.startDate));

  const byCourse = new Map<string, typeof groups>();
  for (const group of groups) {
    const list = byCourse.get(group.courseId);
    if (list) list.push(group);
    else byCourse.set(group.courseId, [group]);
  }

  const withGroups = rows.map((row) => ({ ...row, groups: byCourse.get(row.id) ?? [] }));
  return {
    published: withGroups.filter((row) => row.status === "published"),
    drafts: withGroups.filter((row) => row.status !== "published"),
  };
}

/** One owned course with its groups and ordered syllabus, or null. */
export async function getOwnedCourseDetail(courseId: string, teacherUserId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, teacherUserId)))
    .limit(1);
  const course = rows[0];
  if (!course) return null;

  const [groups, modules] = await Promise.all([
    db
      .select()
      .from(schema.courseGroups)
      .where(eq(schema.courseGroups.courseId, courseId))
      .orderBy(asc(schema.courseGroups.startDate)),
    db
      .select()
      .from(schema.syllabusModules)
      .where(eq(schema.syllabusModules.courseId, courseId))
      .orderBy(asc(schema.syllabusModules.position)),
  ]);
  return { course, groups, modules };
}
