import "server-only";
import { getDb, schema } from "./client";
import { courses as canonicalCourses } from "@/data/courses";
import { teachers as canonicalTeachers } from "@/data/teachers";
import { hashPassword } from "../auth/password";

/* -------------------------------------------------------------------------- */
/* DEVELOPMENT seed — Phase 11.                                                */
/*                                                                              */
/* CANONICAL SOURCE DURING PHASE 11: the TypeScript datasets in src/data.       */
/* The public marketplace (/courses, /teachers, …) still reads them directly    */
/* and is byte-for-byte unchanged. This importer is a ONE-WAY development       */
/* projection of those datasets into the database so the real schema, the real  */
/* constraints and the real queries can be exercised end to end.                */
/*                                                                              */
/* It is explicitly NOT a migration of the marketplace: switching public reads  */
/* to the DB is Phase 12 work and is called out as such in the README. Until    */
/* then the two do not diverge because the DB copy is regenerated from the      */
/* canonical arrays and is never edited by hand.                                */
/*                                                                              */
/* Seeded accounts get a password from DEV_SEED_PASSWORD (or a random one that  */
/* is printed once); no credential is hard-coded and no account is a login      */
/* bypass — they are ordinary rows subject to the same auth path as any user.   */
/* -------------------------------------------------------------------------- */

export interface SeedSummary {
  teachers: number;
  courses: number;
  groups: number;
  modules: number;
  passwordSource: "env" | "generated";
}

function localPhone(index: number): string {
  // Deterministic, obviously-fake dev numbers in a valid UZ mobile range.
  return `+99890${String(1000000 + index).slice(0, 7)}`;
}

export async function seedDevelopmentData(): Promise<SeedSummary> {
  const db = getDb();

  const envPassword = process.env.DEV_SEED_PASSWORD;
  const password =
    envPassword && envPassword.length >= 8
      ? envPassword
      : `dev-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  if (!envPassword) {
    console.log(
      "DEV_SEED_PASSWORD not set — generated a random seed password for this run:",
      password,
    );
  }
  const passwordHash = await hashPassword(password);

  let teacherCount = 0;
  let courseCount = 0;
  let groupCount = 0;
  let moduleCount = 0;

  await db.transaction(async (tx) => {
    // Idempotent: wipe the derived copy, then re-project from canonical data.
    await tx.delete(schema.enrollmentRequests);
    await tx.delete(schema.syllabusModules);
    await tx.delete(schema.courseGroups);
    await tx.delete(schema.courses);
    await tx.delete(schema.teacherProfiles);
    await tx.delete(schema.studentProfiles);
    await tx.delete(schema.sessions);
    await tx.delete(schema.users);

    for (const [index, teacher] of canonicalTeachers.entries()) {
      await tx.insert(schema.users).values({
        id: teacher.id,
        role: "teacher",
        phone: localPhone(index),
        passwordHash,
      });
      await tx.insert(schema.teacherProfiles).values({
        userId: teacher.id,
        role: "teacher",
        slug: teacher.slug,
        name: teacher.name,
        city: null,
        district: null,
        categories: [],
        levels: [],
        formats: [],
        languages: teacher.languages,
        experienceYears: teacher.experienceYears,
        bio: teacher.bio,
        approach: teacher.detail.approach,
        // Seed teachers are NOT auto-verified: verification is a real workflow
        // that does not exist yet (canonical `verified` is presentation data).
        verification: "unverified",
        onboardingCompleted: true,
      });
      teacherCount += 1;
    }

    const teacherIds = new Set(canonicalTeachers.map((teacher) => teacher.id));

    for (const course of canonicalCourses) {
      if (!teacherIds.has(course.teacher.id)) continue;
      const online = course.format === "online";
      await tx.insert(schema.courses).values({
        id: course.id,
        slug: course.slug,
        teacherUserId: course.teacher.id,
        title: course.title,
        categoryId: course.categoryId,
        level: course.level,
        format: course.format,
        city: online ? null : course.city,
        location: online ? null : course.location,
        priceUzs: course.priceUzs,
        summary: course.detail.summary,
        longDescription: course.detail.longDescription,
        audience: course.detail.audience,
        learningOutcomes: course.detail.learningOutcomes,
        teachingLanguages: course.detail.teachingLanguages,
        status: "ready",
      });
      courseCount += 1;

      for (const group of course.detail.groups) {
        await tx.insert(schema.courseGroups).values({
          id: group.id,
          courseId: course.id,
          title: group.title,
          days: group.days,
          startTime: group.startTime,
          // Only planned capacity crosses over. seatsRemaining is live
          // inventory the backend does not own yet, so it is NOT imported.
          capacity: group.capacity,
          startDate: group.startDate,
        });
        groupCount += 1;
      }

      for (const [position, module] of course.detail.syllabus.entries()) {
        await tx.insert(schema.syllabusModules).values({
          id: `${course.id}-m${position}`,
          courseId: course.id,
          position,
          title: module.title,
          description: module.description,
          lessons: module.lessons,
        });
        moduleCount += 1;
      }
    }
  });

  return {
    teachers: teacherCount,
    courses: courseCount,
    groups: groupCount,
    modules: moduleCount,
    passwordSource: envPassword ? "env" : "generated",
  };
}
