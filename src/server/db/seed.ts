import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./client";
import {
  recalculateCourseReviewStats,
  recalculateTeacherReviewStats,
} from "../review-service";
import { courses as canonicalCourses } from "@/data/courses";
import { teachers as canonicalTeachers } from "@/data/teachers";
import { hashPassword } from "../auth/password";
import { hashToken } from "../auth/ids";

/* -------------------------------------------------------------------------- */
/* DEVELOPMENT seed — updated for Phase 12.                                    */
/*                                                                              */
/* THE DATABASE IS NOW THE RUNTIME SOURCE OF TRUTH for the public marketplace.  */
/* The TypeScript datasets in src/data are demoted to SEED INPUT: they are read */
/* here (and by pure fixture tests) but no longer by any public page at         */
/* runtime. There is exactly one active source at runtime.                      */
/*                                                                              */
/* Seeded catalogue courses are inserted as `published` because they ARE the    */
/* approved public catalogue. Teacher-created courses start as `draft` and only */
/* an explicit promotion makes them public — a complete draft never publishes   */
/* itself.                                                                      */
/*                                                                              */
/* Seeded teachers are marked `isPublic` because they own published courses,    */
/* but their VERIFICATION stays honestly `unverified`: no approval workflow     */
/* exists, and the canonical `verified` flag was presentation data, not a       */
/* moderation decision.                                                        */
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
  /**
   * Phase 15 development fixtures. Present ONLY in the dev seed (which refuses
   * to run under NODE_ENV=production) so the admin verification queue can be
   * exercised without hand-building a teacher. Zero in a real deployment.
   */
  verificationFixtures: number;
  /**
   * Phase 19 development review rows. Present ONLY in the dev seed, so the local
   * moderation queue and the reputation aggregates have something real to show.
   * Zero in any real deployment — the migration seeds nothing and `db:seed`
   * refuses to run with NODE_ENV=production.
   */
  reviewFixtures: number;
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
  let verificationFixtures = 0;

  await db.transaction(async (tx) => {
    /*
     * Idempotent: wipe the derived copy, then re-project from canonical data.
     *
     * `course_reviews` goes FIRST because it references `enrollment_requests`
     * with ON DELETE RESTRICT — a review is evidence that a real enrollment
     * produced it, so the enrollment cannot be removed while the review stands.
     */
    await tx.delete(schema.courseReviews);
    await tx.delete(schema.enrollmentRequests);
    await tx.delete(schema.syllabusModules);
    await tx.delete(schema.courseGroups);
    await tx.delete(schema.courses);
    await tx.delete(schema.teacherProfiles);
    await tx.delete(schema.studentProfiles);
    await tx.delete(schema.sessions);
    await tx.delete(schema.users);

    /*
     * Development sign-in handles. These are ordinary rows behind the ordinary
     * auth path: the password is the per-run seed password printed above, and it
     * is never committed. They exist so a developer can actually log in.
     */
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
        photo: teacher.photo,
        specialization: teacher.specialization,
        /*
         * PHASE 19: the reputation aggregates are NOT imported from the fixture.
         *
         * `teacher.rating` / `teacher.reviews` are invented presentation numbers.
         * Seeding them would put a rating on a profile that no student ever gave,
         * and `teacher_profiles.reviews_count` is now a CACHED AGGREGATE of real
         * `course_reviews` rows — so a seeded number would immediately disagree
         * with the rows it claims to summarise. Both start at zero and are
         * recomputed from review rows at the end of this file.
         */
        ratingX10: 0,
        reviewsCount: 0,
        studentsCount: teacher.students,
        // Part of the seeded public catalogue.
        isPublic: true,
        // Seed teachers are NOT auto-verified. Verification is a real admin
        // decision (Phase 15) and the canonical `verified` flag was presentation
        // data — so the catalogue ships unverified until an admin approves it.
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
        schedule: course.schedule,
        // PHASE 19: see the note on teacher_profiles — no fictional rating, no
        // fictional count. `studentsCount` is untouched by this phase.
        ratingX10: 0,
        reviewsCount: 0,
        studentsCount: course.students,
        publishedAt: course.publishedAt,
        keywords: course.keywords,
        image: course.image,
        pricePeriod: course.detail.pricePeriod,
        // The seeded catalogue IS the approved public marketplace.
        status: "published",
      });
      courseCount += 1;

      for (const group of course.detail.groups) {
        await tx.insert(schema.courseGroups).values({
          id: group.id,
          courseId: course.id,
          title: group.title,
          days: group.days,
          startTime: group.startTime,
          format: group.format,
          location: group.location,
          // Only PLANNED capacity crosses over. `seatsRemaining` is live
          // inventory the backend does not own, so it is NOT imported and
          // not invented: public availability is derived from real
          // enrollment rows instead (see repo.ts).
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

  /* ------------------------------------------------------------------------ */
  /* Phase 15 development fixtures — VERIFICATION QUEUE                       */
  /*                                                                          */
  /* Three teacher accounts in the three states the admin screens must handle, */
  /* so the queue, the detail page and the decide-buttons can be exercised     */
  /* locally without hand-editing rows:                                       */
  /*                                                                          */
  /*   DEV-VERIFIED   complete profile, verification `verified`  → the only    */
  /*                  owner that can actually publish a course (rule 11).      */
  /*   DEV-PENDING    complete profile, verification `pending`, ONE live       */
  /*                  request row → exactly the state the queue lists.         */
  /*   DEV-INCOMPLETE deliberately sparse profile → the teacher-side           */
  /*                  completeness gate can be observed refusing submission.   */
  /*                                                                          */
  /* Their bootstrap session rows are inserted directly (with the SHA-256 of a */
  /* random opaque token) purely because a seed script cannot receive a cookie. */
  /* The tokens are deliberately NOT printed: the documented way to sign in as  */
  /* one of these accounts is the bootstrap user's phone + DEV seed password.   */
  /*                                                                          */
  /* None of this ever runs in production: `db:seed` refuses NODE_ENV=production. */
  /* ------------------------------------------------------------------------ */
  /*
   * The fixtures use the SAME per-run seed password as the catalogue accounts —
   * never a literal committed in this file, so the repository contains no
   * credential at all. `passwordHash` is the one computed above from
   * DEV_SEED_PASSWORD (or the random value printed once for this run).
   */
  const fixtures: Array<{
    id: string;
    name: string;
    slug: string;
    verification: "verified" | "pending" | "unverified";
    complete: boolean;
    withRequest: boolean;
  }> = [
    { id: "usr-dev-verified", name: "Dilnoza Rahimova", slug: "dilnoza-rahimova-dev", verification: "verified", complete: true, withRequest: false },
    { id: "usr-dev-pending", name: "Javohir Sattorov", slug: "javohir-sattorov-dev", verification: "pending", complete: true, withRequest: true },
    { id: "usr-dev-incomplete", name: "Kamola Yusupova", slug: "kamola-yusupova-dev", verification: "unverified", complete: false, withRequest: false },
  ];

  await db.transaction(async (tx) => {
    for (const [index, fixture] of fixtures.entries()) {
      await tx.insert(schema.users).values({
        id: fixture.id,
        role: "teacher",
        phone: localPhone(canonicalTeachers.length + index),
        passwordHash,
      });
      await tx.insert(schema.teacherProfiles).values({
        userId: fixture.id,
        role: "teacher",
        slug: fixture.slug,
        name: fixture.name,
        city: fixture.complete ? "Toshkent" : null,
        district: null,
        categories: [],
        levels: [],
        formats: [],
        languages: fixture.complete ? ["O‘zbek", "Rus"] : [],
        experienceYears: fixture.complete ? 6 : null,
        bio: fixture.complete
          ? "Development fixture: matematika va fizika bo‘yicha amaliy mashg‘ulotlar olib boraman."
          : null,
        approach: fixture.complete
          ? "Har bir mavzuni qisqa nazariya va ko‘plab mashqlar bilan mustahkamlaymiz."
          : null,
        photo: null,
        specialization: fixture.complete ? "Matematika" : null,
        ratingX10: 0,
        reviewsCount: 0,
        studentsCount: 0,
        // Not public: a fixture that is not part of the seeded catalogue should
        // not appear in the directory until it is verified and publishes.
        isPublic: false,
        verification: fixture.verification,
        onboardingCompleted: true,
      });
      if (fixture.withRequest) {
        /*
         * ONE live request, inserted through the same columns the service uses.
         * The empty `feedback` and the NULL decision fields satisfy the table's
         * CHECK constraints for a `pending` row.
         */
        await tx.insert(schema.teacherVerificationRequests).values({
          id: `${fixture.id}-req-1`,
          teacherUserId: fixture.id,
          status: "pending",
        });
      }
      verificationFixtures += 1;
    }

    /*
     * Bootstrap session for the pending fixture.
     *
     * A reviewer needs a TEACHER account to be blocked from /admin (the
     * impersonation check), and the sign-in form needs a phone + password. A
     * session row cannot be created by a script, so the seed stores the hash of
     * a random token the developer never sees — it is a real session cookie
     * value that is simply discarded, not a bypass.
     */
    const bootstrapToken = `dev-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    await tx.insert(schema.sessions).values({
      id: "sess-dev-fixture",
      tokenHash: hashToken(bootstrapToken),
      userId: "usr-dev-pending",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Phase 19 development fixtures — REVIEW QUEUE AND REPUTATION              */
  /*                                                                          */
  /* WHY THESE EXIST. Reviews are now real rows with a moderation lifecycle, so a */
  /* developer needs real rows to exercise: a `pending` row for /admin/reviews,   */
  /* `published` rows so a course and a teacher show a rating that came from      */
  /* somewhere, and a `rejected` row so the student-side status copy is visible.  */
  /* Without them every local screen would be permanently empty and the           */
  /* reputation engine could not be observed at all.                            */
  /*                                                                          */
  /* WHY THIS IS SAFE.                                                        */
  /*   • it lives in the DEV seed only, and `db:seed` REFUSES to run with          */
  /*     NODE_ENV=production (scripts/db.ts) — production never gets a fictional */
  /*     review from this file, and the migration creates none either;           */
  /*   • the fictional testimonials that used to ship in `src/data/reviews.ts`    */
  /*     are NOT migrated here. That file is deleted. These rows are new,         */
  /*     explicitly-labelled development data with their own ids;                */
  /*   • they are EARNED the way a real review is: each one names an `accepted`   */
  /*     enrollment belonging to its own student, on a group that has already     */
  /*     started, so the eligibility rules hold for these rows too;              */
  /*   • the aggregates are NOT written by hand. After the rows exist, the SAME   */
  /*     `recalculate*ReviewStats` helpers the production writers use recompute    */
  /*     `courses.rating_x10/reviews_count` and the teacher pair, so the numbers  */
  /*     a local page shows are exactly the numbers these rows produce.          */
  /* ------------------------------------------------------------------------ */
  let reviewFixtures = 0;

  const devStartDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  /** Course id → one published review each, plus one pending and one rejected. */
  const reviewPlan: Array<{
    courseId: string;
    studentId: string;
    studentName: string;
    rating: number;
    status: "published" | "pending" | "rejected";
    body: string;
  }> = [
    {
      courseId: "c-ielts-intensive",
      studentId: "usr-dev-reviewer-1",
      studentName: "Dev O‘quvchi Bir",
      rating: 5,
      status: "published",
      body: "Development fixture: mock imtihonlar va xatolar jurnali natijani sezilarli oshirdi.",
    },
    {
      courseId: "c-ielts-intensive",
      studentId: "usr-dev-reviewer-2",
      studentName: "Dev O‘quvchi Ikki",
      rating: 4,
      status: "published",
      body: "Development fixture: yuklama haqiqiy, lekin guruh kichikligi individual e’tibor beradi.",
    },
    {
      courseId: "c-ielts-intensive",
      studentId: "usr-dev-reviewer-3",
      studentName: "Dev O‘quvchi Uch",
      rating: 5,
      status: "pending",
      body: "Development fixture: bu fikr hali tekshiruvda, shuning uchun sahifada ko‘rinmaydi.",
    },
    {
      courseId: "c-frontend",
      studentId: "usr-dev-reviewer-4",
      studentName: "Dev O‘quvchi To‘rt",
      rating: 5,
      status: "published",
      body: "Development fixture: kod-reviewlar darsning o‘zidan qimmatroq bo‘ldi, portfolio tayyor.",
    },
    {
      courseId: "c-frontend",
      studentId: "usr-dev-reviewer-5",
      studentName: "Dev O‘quvchi Besh",
      rating: 2,
      status: "rejected",
      body: "Development fixture: bu fikr e’lon qilinmagan, shuning uchun reytingda hisoblanmaydi.",
    },
    {
      courseId: "c-math-dtm",
      studentId: "usr-dev-reviewer-6",
      studentName: "Dev O‘quvchi Olti",
      rating: 4,
      status: "published",
      body: "Development fixture: yakshanba testlari imtihon bosimini oldindan yashatishga yordam berdi.",
    },
  ];

  /*
   * A DEV OPERATOR ACCOUNT, created here for one reason: a `published` or
   * `rejected` review row must name the admin who decided it (the
   * `course_reviews_decision_has_moderator` CHECK requires it, and inventing a
   * moderator id that points at nobody would break the FK). A real operator is
   * still created out-of-band with `npm run admin:create-email`; this row only
   * exists so the local fixtures are internally consistent, and `db:seed` refuses
   * to run with NODE_ENV=production, so no deployment ever gets it.
   *
   * It signs in with the same per-run DEV_SEED_PASSWORD as every other seeded
   * account — there is no committed credential here.
   */
  const devAdminId = "usr-dev-admin";
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: devAdminId,
      role: "admin",
      phone: null,
      email: "dev-operator@ustoz.local",
      passwordHash,
    });
  });

  const devGroupIds = new Set<string>();
  await db.transaction(async (tx) => {
    for (const [index, plan] of reviewPlan.entries()) {
      const courseRows = await tx
        .select({ id: schema.courses.id, title: schema.courses.title })
        .from(schema.courses)
        .where(eq(schema.courses.id, plan.courseId))
        .limit(1);
      // A course the canonical catalogue no longer has simply gets no fixture.
      if (!courseRows[0]) continue;

      await tx.insert(schema.users).values({
        id: plan.studentId,
        role: "student",
        phone: localPhone(canonicalTeachers.length + 100 + index),
        passwordHash,
      });
      await tx.insert(schema.studentProfiles).values({
        userId: plan.studentId,
        role: "student",
        name: plan.studentName,
        onboardingCompleted: true,
      });

      /*
       * A group that has ALREADY STARTED, because eligibility requires it and a
       * fixture that the real rules would refuse would be worse than no fixture:
       * a developer editing one of these reviews through the UI must be allowed.
       * It is labelled as development data so nobody mistakes it for inventory,
       * and it is created ONCE PER COURSE — several reviewers share it, exactly
       * as several real students share a group.
       */
      const groupId = `${plan.courseId}-dev-group`;
      if (!devGroupIds.has(groupId)) {
        await tx.insert(schema.courseGroups).values({
          id: groupId,
          courseId: plan.courseId,
          title: "Sinov guruhi (dev)",
          days: ["Du"],
          startTime: "18:00",
          format: "online",
          capacity: 20,
          startDate: devStartDate,
        });
        devGroupIds.add(groupId);
      }

      const enrollmentId = `${plan.studentId}-enr`;
      await tx.insert(schema.enrollmentRequests).values({
        id: enrollmentId,
        studentUserId: plan.studentId,
        courseId: plan.courseId,
        groupId,
        note: "Development fixture enrollment.",
        status: "accepted",
      });

      await tx.insert(schema.courseReviews).values({
        id: `${plan.studentId}-review`,
        courseId: plan.courseId,
        studentUserId: plan.studentId,
        enrollmentRequestId: enrollmentId,
        rating: plan.rating,
        body: plan.body,
        status: plan.status,
        // Only a DECIDED status carries moderation provenance, and a decided row
        // must name a real admin (DB CHECK) — hence the dev operator above.
        ...(plan.status === "published" || plan.status === "rejected"
          ? {
              moderatedAt: new Date(),
              moderatedByAdminUserId: devAdminId,
            }
          : {}),
        ...(plan.status === "rejected"
          ? { moderationReason: "Development fixture: matn talabga mos kelmadi." }
          : {}),
      });
      reviewFixtures += 1;
    }

    /*
     * THE AGGREGATES ARE DERIVED, NOT ASSERTED.
     *
     * Every course and teacher aggregate is recomputed from the rows that now
     * exist, using the same helpers the production writers call. So the numbers a
     * local page renders are exactly `count(published)` and
     * `round(avg(rating) * 10)` — a course with no published review shows 0.0 and
     * no count, which is the honest state production starts in.
     */
    for (const { id } of await tx.select({ id: schema.courses.id }).from(schema.courses)) {
      const stats = await recalculateCourseReviewStats(tx, id);
      await tx
        .update(schema.courses)
        .set({ ratingX10: stats.ratingX10, reviewsCount: stats.reviewsCount })
        .where(eq(schema.courses.id, id));
    }
    for (const { userId } of await tx
      .select({ userId: schema.teacherProfiles.userId })
      .from(schema.teacherProfiles)) {
      const stats = await recalculateTeacherReviewStats(tx, userId);
      await tx
        .update(schema.teacherProfiles)
        .set({ ratingX10: stats.ratingX10, reviewsCount: stats.reviewsCount })
        .where(eq(schema.teacherProfiles.userId, userId));
    }
  });

  return {
    teachers: teacherCount,
    courses: courseCount,
    groups: groupCount,
    modules: moduleCount,
    passwordSource: envPassword ? "env" : "generated",
    verificationFixtures,
    /** Local review rows (published + pending + rejected). Zero in production. */
    reviewFixtures,
  };
}
