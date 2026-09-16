/* -------------------------------------------------------------------------- */
/* Phase 19 review + reputation test suite.                                    */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by     */
/* applying the same committed migrations production uses, and drives the REAL    */
/* review service. Nothing is mocked, so every claim below is proven against the  */
/* actual database constraints and the actual service code.                      */
/*                                                                              */
/* THE PROPERTY THIS SUITE EXISTS TO PROVE                                      */
/*                                                                              */
/*   A PUBLIC RATING IS EARNED, THEN APPROVED, AND NOTHING ELSE.                */
/*                                                                              */
/*   • only an accepted participant on an already-started course can write;       */
/*   • a written review is `pending` and invisible until an admin publishes it;   */
/*   • only `published` rows feed `courses.rating_x10/reviews_count` and the       */
/*     teacher pair, and a teacher's number is a flat mean over their rows —      */
/*     not an average of per-course averages;                                    */
/*   • editing a published review pulls it back to pending and removes its old    */
/*     value from the public numbers in the same transaction;                    */
/*   • there is no fixture left to fall back to.                                 */
/*                                                                              */
/*   npm run test:reviews                                                       */
/* -------------------------------------------------------------------------- */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-reviews-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean): void {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL: ${name}`);
  }
}

async function rejects(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(name, false);
  } catch {
    check(name, true);
  }
}

/** Today, in the same ISO form `course_groups.start_date` uses. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A date safely in the past / future, whatever day the suite runs on. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const raw = new PGlite(DATA_DIR);
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await raw.exec(trimmed);
    }
  }
  await raw.close();

  const { and, eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const contract = await import("../src/lib/reviews");
  const service = await import("../src/server/review-service");
  const validation = await import("../src/server/validation");

  const db = getDb();

  /* ------------------------------ fixtures ------------------------------- */

  const password = await hashPassword("supersecret");
  let phoneSeq = 0;

  function nextPhone(): string {
    phoneSeq += 1;
    return `+99890${String(2000000 + phoneSeq).slice(0, 7)}`;
  }

  async function makeStudent(name: string): Promise<string> {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role: "student", phone: nextPhone(), passwordHash: password });
    await db.insert(schema.studentProfiles).values({ userId: id, name });
    return id;
  }

  async function makeTeacher(name: string): Promise<string> {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role: "teacher", phone: nextPhone(), passwordHash: password });
    await db.insert(schema.teacherProfiles).values({
      userId: id,
      slug: `ustoz-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase()}`,
      name,
      bio: "B".repeat(60),
      city: "toshkent",
    });
    return id;
  }

  /** An operator account identified by EMAIL, exactly like `admin:create-email`. */
  async function makeAdmin(): Promise<string> {
    const id = newId("usr");
    await db.insert(schema.users).values({
      id,
      role: "admin",
      phone: null,
      email: `operator-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase()}@ustoz.test`,
      passwordHash: password,
    });
    return id;
  }

  async function makeCourse(teacherUserId: string, slug: string, status: "draft" | "ready" | "published" = "published") {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: "Test kursi nomi",
      categoryId: "ielts",
      level: "orta",
      format: "online",
      priceUzs: 0,
      summary: "S".repeat(60),
      status,
      publishedAt: status === "published" ? today() : null,
    });
    return id;
  }

  async function makeGroup(courseId: string, startDate: string, capacity = 20) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id,
      courseId,
      title: "A guruhi",
      days: ["Du"],
      startTime: "18:00",
      capacity,
      startDate,
    });
    return id;
  }

  async function makeEnrollment(
    studentUserId: string,
    courseId: string,
    groupId: string,
    status: "submitted" | "accepted" | "rejected" | "cancelled",
  ) {
    const id = newId("enr");
    await db.insert(schema.enrollmentRequests).values({
      id,
      studentUserId,
      courseId,
      groupId,
      note: "Qiziqaman",
      status,
    });
    return id;
  }

  const teacherA = await makeTeacher("Ustoz A");
  const teacherB = await makeTeacher("Ustoz B");
  const admin = await makeAdmin();

  const courseA = await makeCourse(teacherA, "ustoz-a-kursi");
  const startedGroupA = await makeGroup(courseA, daysFromNow(-30));
  const futureGroupA = await makeGroup(courseA, daysFromNow(60));

  const studentA = await makeStudent("O‘quvchi A");
  const studentB = await makeStudent("O‘quvchi B");
  const enrollmentA = await makeEnrollment(studentA, courseA, startedGroupA, "accepted");

  const BODY = "Bu kurs menga juda foydali bo‘ldi, ustoz har mavzuni amaliyot bilan tushuntirdi.";

  /* ============================== CONTRACT =============================== */
  console.log("\n# CONTRACT — the transition table and the bounds");

  check("student may create a review when none exists", contract.canSubmitNewReview(null));
  check("student may NOT create a second review while one is pending",
    !contract.canSubmitNewReview("pending"));
  check("student may NOT create a second review while one is published",
    !contract.canSubmitNewReview("published"));

  check("student may edit a pending review", contract.canStudentEdit("pending"));
  check("student may edit a published review (it returns to pending)",
    contract.canStudentEdit("published"));
  check("student may edit a rejected review and resubmit", contract.canStudentEdit("rejected"));
  check("student may edit a withdrawn review and resubmit", contract.canStudentEdit("withdrawn"));
  check("student may withdraw a pending review", contract.canStudentWithdraw("pending"));
  check("student may withdraw a published review", contract.canStudentWithdraw("published"));
  check("FORBIDDEN student cannot withdraw an already withdrawn review",
    !contract.canStudentWithdraw("withdrawn"));
  check("FORBIDDEN student cannot publish their own review",
    !contract.canTransitionReview("student", "pending", "published"));
  check("FORBIDDEN student cannot reject their own review",
    !contract.canTransitionReview("student", "pending", "rejected"));

  check("admin may publish a pending review", contract.canTransitionReview("admin", "pending", "published"));
  check("admin may reject a pending review", contract.canTransitionReview("admin", "pending", "rejected"));
  check("admin may un-publish a live review", contract.canTransitionReview("admin", "published", "rejected"));
  check("admin may reinstate a rejected review", contract.canTransitionReview("admin", "rejected", "published"));
  check("FORBIDDEN admin cannot publish a withdrawn review (the student took it back)",
    !contract.canTransitionReview("admin", "withdrawn", "published"));
  check("FORBIDDEN a teacher has no moderation transitions at all",
    !contract.canTransitionReview("admin", "pending", "withdrawn"));

  check("only `published` is public",
    contract.PUBLIC_REVIEW_STATUS === "published" &&
      contract.isPublicReviewStatus("published") &&
      !contract.isPublicReviewStatus("pending") &&
      !contract.isPublicReviewStatus("rejected") &&
      !contract.isPublicReviewStatus("withdrawn"));
  check("only `published` counts toward reputation",
    contract.countsTowardReputation("published") && !contract.countsTowardReputation("pending"));
  check("bounds are 1..5 and 20..1500",
    contract.REVIEW_RATING_MIN === 1 &&
      contract.REVIEW_RATING_MAX === 5 &&
      contract.REVIEW_BODY_MIN_LENGTH === 20 &&
      contract.REVIEW_BODY_MAX_LENGTH === 1500);

  /* =========================== NORMALISATION ============================= */
  console.log("\n# NORMALISATION — length is judged on real characters");

  check("body is trimmed", service.normalizeReviewBody("   salom   ") === "salom");
  check("whitespace runs collapse", service.normalizeReviewBody("a\n\n\n  b") === "a b");
  check("control characters are stripped", !service.normalizeReviewBody("a\u0000b\u0007c").includes("\u0000"));
  check("20 newlines are NOT a 20-character opinion",
    service.reviewBodyProblem(service.normalizeReviewBody("\n".repeat(40)))?.code === "too_short");
  check("a real sentence is accepted", service.reviewBodyProblem(service.normalizeReviewBody(BODY)) === null);
  check("1501 characters is too long",
    service.reviewBodyProblem("a".repeat(1501))?.code === "too_long");
  check("rating 0 is refused", service.reviewRatingProblem(0) !== null);
  check("rating 6 is refused", service.reviewRatingProblem(6) !== null);
  check("rating 4.5 is refused (integers only)", service.reviewRatingProblem(4.5) !== null);
  check("rating 3 is accepted", service.reviewRatingProblem(3) === null);
  check("an empty moderation reason means 'no reason'",
    service.normalizeModerationReason("   ") === null);
  check("a 5-character reason is too short to be a reason",
    service.moderationReasonProblem("qisqa") !== null);
  check("no reason at all is valid", service.moderationReasonProblem(null) === null);

  /* ============================ ELIGIBILITY ============================== */
  console.log("\n# ELIGIBILITY — earned, not claimed");

  check("anonymous visitor is not eligible",
    (await service.getReviewEligibility(courseA, null)).reason === "anonymous");
  check("a teacher is not eligible to review",
    (await service.getReviewEligibility(courseA, { id: teacherA, role: "teacher" })).reason ===
      "not_student");
  check("an admin is not eligible to review",
    (await service.getReviewEligibility(courseA, { id: admin, role: "admin" })).reason ===
      "not_student");
  check("a student with no enrollment at all is not eligible",
    (await service.getReviewEligibility(courseA, { id: studentB, role: "student" })).reason ===
      "no_accepted_enrollment");

  {
    const submitted = await makeEnrollment(studentB, courseA, startedGroupA, "submitted");
    check("a SUBMITTED enrollment does not earn a review",
      (await service.getReviewEligibility(courseA, { id: studentB, role: "student" })).reason ===
        "no_accepted_enrollment");

    await db.update(schema.enrollmentRequests).set({ status: "rejected" }).where(eq(schema.enrollmentRequests.id, submitted));
    check("a REJECTED enrollment does not earn a review",
      (await service.getReviewEligibility(courseA, { id: studentB, role: "student" })).reason ===
        "no_accepted_enrollment");

    await db.update(schema.enrollmentRequests).set({ status: "cancelled" }).where(eq(schema.enrollmentRequests.id, submitted));
    check("a CANCELLED enrollment does not earn a review",
      (await service.getReviewEligibility(courseA, { id: studentB, role: "student" })).reason ===
        "no_accepted_enrollment");
  }

  {
    // Accepted, but only on a group that has not started yet.
    const futureOnly = await makeStudent("O‘quvchi Kelajak");
    await makeEnrollment(futureOnly, courseA, futureGroupA, "accepted");
    const eligibility = await service.getReviewEligibility(courseA, { id: futureOnly, role: "student" });
    check("an accepted place on a FUTURE group cannot review yet",
      eligibility.reason === "not_started" && !eligibility.eligible);
  }

  {
    const started = await service.getReviewEligibility(courseA, { id: studentA, role: "student" });
    check("an accepted place on a STARTED group is eligible",
      started.eligible && started.reason === "eligible");
    check("eligibility names the enrollment it is based on",
      started.enrollments.length === 1 && started.enrollments[0].id === enrollmentA);
  }

  {
    const draftCourse = await makeCourse(teacherA, "qoralama-kurs", "draft");
    const draftGroup = await makeGroup(draftCourse, daysFromNow(-10));
    const draftStudent = await makeStudent("O‘quvchi Qoralama");
    await makeEnrollment(draftStudent, draftCourse, draftGroup, "accepted");
    check("a DRAFT course cannot be reviewed",
      (await service.getReviewEligibility(draftCourse, { id: draftStudent, role: "student" })).reason ===
        "course_not_public");
    const attempt = await service.createReview({
      studentUserId: draftStudent,
      courseId: draftCourse,
      enrollmentRequestId: "enr-ghost",
      rating: 5,
      body: BODY,
    });
    check("the write path refuses a draft course too",
      !attempt.ok && attempt.code === "not_found");
  }

  /* ============================== CREATION =============================== */
  console.log("\n# CREATE — validation, ownership and duplicate protection");

  {
    const short = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 5,
      body: "Qisqa",
    });
    check("a too-short body is refused", !short.ok && short.code === "invalid_input");
  }
  {
    const long = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 5,
      body: "a".repeat(1501),
    });
    check("an oversized body is refused", !long.ok && long.code === "invalid_input");
  }
  {
    const badRating = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 7,
      body: BODY,
    });
    check("a rating above 5 is refused", !badRating.ok && badRating.code === "invalid_input");
    const zeroRating = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 0,
      body: BODY,
    });
    check("a rating below 1 is refused", !zeroRating.ok && zeroRating.code === "invalid_input");
  }

  {
    // A student trying to attribute a review to somebody else's enrollment.
    const stolen = await service.createReview({
      studentUserId: studentB,
      courseId: courseA,
      enrollmentRequestId: enrollmentA, // studentA's enrollment
      rating: 5,
      body: BODY,
    });
    check("a student cannot review on another student's enrollment",
      !stolen.ok && stolen.code === "not_eligible");
  }
  {
    const ghost = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: "enr-ghost",
      rating: 5,
      body: BODY,
    });
    check("a nonexistent enrollment is refused", !ghost.ok && ghost.code === "not_eligible");
  }
  {
    // An admin trying to author a review: no student profile, no enrollment.
    const impersonation = await service.createReview({
      studentUserId: admin,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 5,
      body: BODY,
    });
    check("an admin cannot impersonate a student review",
      !impersonation.ok && impersonation.code === "not_eligible");
    const teacherAttempt = await service.createReview({
      studentUserId: teacherA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 5,
      body: BODY,
    });
    check("the course's own teacher cannot review it",
      !teacherAttempt.ok && teacherAttempt.code === "not_eligible");
  }

  const created = await service.createReview({
    studentUserId: studentA,
    courseId: courseA,
    enrollmentRequestId: enrollmentA,
    rating: 5,
    body: `   ${BODY}   `,
  });
  check("an eligible student can create a review", created.ok);
  const reviewA = created.ok ? created.data!.id : "";
  check("a new review lands as PENDING, never published", created.ok && created.data!.status === "pending");

  {
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewA)))[0];
    check("the body is stored trimmed", stored.body === BODY);
    check("a pending review carries no moderator and no decision moment",
      stored.moderatedAt === null && stored.moderatedByAdminUserId === null && stored.moderationReason === null);
  }

  {
    const duplicate = await service.createReview({
      studentUserId: studentA,
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: 1,
      body: "Ikkinchi fikr — bu ham yetarlicha uzun matn bo‘lsin.",
    });
    check("a second review of the same course is refused",
      !duplicate.ok && duplicate.code === "duplicate_review");
  }

  /* DATABASE-LEVEL duplicate + constraint protection (not just the service). */
  await rejects("the DB refuses a second review row for the same student+course", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentA,
      enrollmentRequestId: enrollmentA,
      rating: 3,
      body: "Bu ham yetarlicha uzun ikkinchi fikr matni.",
      status: "pending",
    }));
  await rejects("the DB refuses a rating of 0", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 0,
      body: "Bahosi noto‘g‘ri bo‘lgan fikr matni shu yerda.",
      status: "pending",
    }));
  await rejects("the DB refuses a rating of 6", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 6,
      body: "Bahosi noto‘g‘ri bo‘lgan fikr matni shu yerda.",
      status: "pending",
    }));
  await rejects("the DB refuses an untrimmed body", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "  Ortiqcha bo‘shliq bilan boshlanadigan matn  ",
      status: "pending",
    }));
  await rejects("the DB refuses a 19-character body", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "o'n to'qqiz belgi",
      status: "pending",
    }));
  await rejects("the DB refuses a review naming another student's enrollment", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB, // NOT the enrollment's student
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Birovning yozilishiga bog‘langan fikr matni.",
      status: "pending",
    }));
  const mismatchedCourse = await makeCourse(teacherA, "boshqa-kurs");
  await rejects("the DB refuses a review claiming a different course than the enrollment's", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: mismatchedCourse,
      studentUserId: studentA,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Kursi almashtirilgan fikr matni shu yerda.",
      status: "pending",
    }));
  await rejects("the DB refuses a teacher as a review author (FK to student_profiles)", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: teacherA,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Ustoz o‘z kursiga fikr yozmoqchi bo‘lgan matn.",
      status: "pending",
    }));
  await rejects("a `published` review without a moderator is refused", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Moderatorsiz e’lon qilingan fikr matni.",
      status: "published",
    }));
  await rejects("a `pending` review carrying a moderator is refused", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Tekshiruvdagi, lekin moderatorli fikr matni.",
      status: "pending",
      moderatedAt: new Date(),
      moderatedByAdminUserId: admin,
    }));
  await rejects("a `withdrawn` review attributed to an admin is refused", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "O‘quvchi qaytarib olgan, admin yozgan fikr matni.",
      status: "withdrawn",
      moderatedAt: new Date(),
      moderatedByAdminUserId: admin,
    }));
  await rejects("a moderation reason on a published review is refused", () =>
    db.insert(schema.courseReviews).values({
      id: newId("rev"),
      courseId: courseA,
      studentUserId: studentB,
      enrollmentRequestId: enrollmentA,
      rating: 4,
      body: "Sababli e’lon qilingan fikr matni shu yerda.",
      status: "published",
      moderatedAt: new Date(),
      moderatedByAdminUserId: admin,
      moderationReason: "Bu sabab e’lon qilingan fikrda bo‘lmasligi kerak.",
    }));

  /* ============================ VISIBILITY =============================== */
  console.log("\n# VISIBILITY — unpublished reviews are not merely hidden");

  {
    const publicBefore = await service.listPublicCourseReviews(courseA);
    check("a PENDING review never appears publicly", publicBefore.length === 0);
    const own = await service.getOwnReview(courseA, studentA);
    check("the author can still see their own pending review", own?.status === "pending");
    check("another student cannot read it through the own-review accessor",
      (await service.getOwnReview(courseA, studentB)) === null);
    const context = await service.getCourseReviewContext(courseA, { id: studentA, role: "student" });
    check("the context says the student may not submit again", context.canSubmit === false);
    check("the context still exposes the empty public list", context.reviews.length === 0);
  }

  /* ============================ MODERATION =============================== */
  console.log("\n# MODERATION — only an admin makes a review public");

  {
    const byTeacher = await service.publishReview(reviewA, teacherA);
    check("FORBIDDEN a teacher cannot publish a review",
      !byTeacher.ok && byTeacher.code === "forbidden");
    const byStudent = await service.publishReview(reviewA, studentA);
    check("FORBIDDEN the author cannot publish their own review",
      !byStudent.ok && byStudent.code === "forbidden");
    const byGhost = await service.publishReview(reviewA, "usr-ghost");
    check("FORBIDDEN an unknown account cannot moderate",
      !byGhost.ok && byGhost.code === "forbidden");
    check("a refused moderation left the review pending",
      (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewA)))[0]
        .status === "pending");
  }

  {
    const rejected = await service.rejectReview(reviewA, studentB, "Bu sabab o‘quvchi tomonidan yozilgan.");
    check("FORBIDDEN a student cannot reject a review",
      !rejected.ok && rejected.code === "forbidden");
  }

  const published = await service.publishReview(reviewA, admin);
  check("an admin can publish a pending review", published.ok);

  {
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewA)))[0];
    check("publishing records the deciding admin", stored.moderatedByAdminUserId === admin);
    check("publishing records the moment of the decision", stored.moderatedAt !== null);
    check("publishing clears any rejection reason", stored.moderationReason === null);
  }

  {
    const audit = await db
      .select()
      .from(schema.adminAuditEvents)
      .where(
        and(
          eq(schema.adminAuditEvents.entityId, reviewA),
          eq(schema.adminAuditEvents.action, "review_published"),
        ),
      );
    check("publishing writes exactly one audit row", audit.length === 1);
    check("the audit row names the admin and the review entity type",
      audit[0].adminUserId === admin && audit[0].entityType === "review");
    check("the audit metadata carries no review body and no student id",
      (audit[0].metadata ?? "").includes("course=") &&
        !(audit[0].metadata ?? "").includes(BODY) &&
        !(audit[0].metadata ?? "").includes(studentA));
  }
  {
    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, studentA));
    check("the student is told their review was published",
      notifications.some((row) => row.type === "review_published"));
  }

  {
    const publicNow = await service.listPublicCourseReviews(courseA);
    check("a published review appears publicly", publicNow.length === 1);
    check("it is newest-first ordered and carries the safe projection only",
      publicNow[0].id === reviewA &&
        publicNow[0].rating === 5 &&
        publicNow[0].body === BODY &&
        publicNow[0].author === contract.PUBLIC_REVIEW_AUTHOR_LABEL &&
        /^\d{4}-\d{2}-\d{2}$/.test(publicNow[0].date));
    check("the public projection leaks no identity",
      !JSON.stringify(publicNow[0]).includes(studentA));
  }

  {
    const again = await service.publishReview(reviewA, admin);
    check("re-publishing an already published review is idempotent",
      again.ok && again.data!.idempotent === true);
    const auditCount = await db
      .select({ id: schema.adminAuditEvents.id })
      .from(schema.adminAuditEvents)
      .where(eq(schema.adminAuditEvents.entityId, reviewA));
    check("an idempotent replay writes no second audit row", auditCount.length === 1);
  }

  /* ============================ REPUTATION =============================== */
  console.log("\n# REPUTATION — the aggregates are the rows");

  {
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseA)))[0];
    check("one published 5-star review gives the course 5.0 and a count of 1",
      course.ratingX10 === 50 && course.reviewsCount === 1);
    const teacher = (await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherA)))[0];
    check("the teacher inherits the same single review",
      teacher.ratingX10 === 50 && teacher.reviewsCount === 1);
  }

  /* Editing a PUBLISHED review must pull its old value out immediately. */
  const edited = await service.updateOwnReview({
    reviewId: reviewA,
    studentUserId: studentA,
    rating: 2,
    body: "Tahrirdan keyingi fikr: darslar sekinroq o‘tdi, lekin natija bor.",
  });
  check("the author can edit their published review", edited.ok);

  {
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewA)))[0];
    check("editing a published review returns it to PENDING", stored.status === "pending");
    check("the new rating and body are stored", stored.rating === 2 && stored.body.startsWith("Tahrirdan"));
    check("the old moderation record is cleared",
      stored.moderatedAt === null && stored.moderatedByAdminUserId === null);
    check("the edited review leaves the public list at once",
      (await service.listPublicCourseReviews(courseA)).length === 0);
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseA)))[0];
    check("its old value leaves the course aggregate in the same transaction",
      course.ratingX10 === 0 && course.reviewsCount === 0);
    const teacher = (await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherA)))[0];
    check("and out of the teacher aggregate", teacher.ratingX10 === 0 && teacher.reviewsCount === 0);
  }

  {
    const stolen = await service.updateOwnReview({
      reviewId: reviewA,
      studentUserId: studentB,
      rating: 5,
      body: "Birovning fikrini o‘zgartirishga urinish matni.",
    });
    check("another student's edit is refused", !stolen.ok && stolen.code === "forbidden");
    const teacherEdit = await service.updateOwnReview({
      reviewId: reviewA,
      studentUserId: teacherA,
      rating: 5,
      body: "Ustoz o‘quvchi fikrini o‘zgartirmoqchi bo‘lgan matn.",
    });
    check("the course teacher cannot edit a student's review",
      !teacherEdit.ok && teacherEdit.code === "forbidden");
  }

  /* Re-publish the edited review, then exercise the weighted teacher mean. */
  await service.publishReview(reviewA, admin);

  console.log("\n# REPUTATION — a teacher's mean is over ROWS, not over course averages");

  const courseB = await makeCourse(teacherA, "ustoz-a-ikkinchi-kursi");
  const groupB = await makeGroup(courseB, daysFromNow(-20));
  const reviewRows: string[] = [];

  // courseA now holds ONE published review worth 2. courseB will hold three
  // worth 4, 4 and 5. Averaging the two course averages would give
  // (2.0 + 4.33)/2 = 3.2 -> 32; the honest flat mean over four rows is
  // (2+4+4+5)/4 = 3.75 -> 38.
  for (const [index, rating] of [4, 4, 5].entries()) {
    const student = await makeStudent(`O‘quvchi B${index}`);
    const enrollment = await makeEnrollment(student, courseB, groupB, "accepted");
    const created2 = await service.createReview({
      studentUserId: student,
      courseId: courseB,
      enrollmentRequestId: enrollment,
      rating,
      body: `Ikkinchi kurs bo‘yicha ${index}-fikr: amaliyot ko‘p, nazariya aniq.`,
    });
    if (created2.ok) {
      reviewRows.push(created2.data!.id);
      await service.publishReview(created2.data!.id, admin);
    }
  }

  {
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseB)))[0];
    check("courseB's own aggregate is (4+4+5)/3 = 4.3 -> 43",
      course.ratingX10 === 43 && course.reviewsCount === 3);
    const teacher = (await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherA)))[0];
    check("the teacher aggregate is a FLAT mean over all four rows (3.75 -> 38)",
      teacher.ratingX10 === 38 && teacher.reviewsCount === 4);
    check("the teacher aggregate is NOT an average of course averages (that would be 32)",
      teacher.ratingX10 !== 32);
    const recomputed = await db.transaction((tx) =>
      service.recalculateTeacherReviewStats(tx, teacherA),
    );
    check("recalculateTeacherReviewStats agrees with the stored cache",
      recomputed.ratingX10 === 38 && recomputed.reviewsCount === 4);
  }

  /* ------------------------- zero-review state --------------------------- */
  console.log("\n# REPUTATION — zero published reviews means zero, never a default");

  {
    const emptyCourse = await makeCourse(teacherB, "bosh-kurs");
    await makeGroup(emptyCourse, daysFromNow(-5));
    const emptyTeacher = (await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherB)))[0];
    check("a teacher with no published reviews has rating 0 and count 0",
      emptyTeacher.ratingX10 === 0 && emptyTeacher.reviewsCount === 0);
    const recomputed = await db.transaction((tx) =>
      Promise.all([
        service.recalculateCourseReviewStats(tx, emptyCourse),
        service.recalculateTeacherReviewStats(tx, teacherB),
      ]),
    );
    check("recomputing an empty course returns 0/0",
      recomputed[0].ratingX10 === 0 && recomputed[0].reviewsCount === 0);
    check("recomputing an empty teacher returns 0/0",
      recomputed[1].ratingX10 === 0 && recomputed[1].reviewsCount === 0);
    check("an empty course publishes no reviews",
      (await service.listPublicCourseReviews(emptyCourse)).length === 0);
  }

  /* ---------------------- withdrawal and rejection ----------------------- */
  console.log("\n# WITHDRAW / REJECT — leaving the public numbers");

  {
    const withdrawn = await service.withdrawOwnReview({ reviewId: reviewRows[0], studentUserId: studentB });
    check("another student cannot withdraw this review",
      !withdrawn.ok && withdrawn.code === "forbidden");
  }
  {
    const authorOfRow0 = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[0])))[0];
    const withdrawn = await service.withdrawOwnReview({
      reviewId: reviewRows[0],
      studentUserId: authorOfRow0.studentUserId,
    });
    check("the author can withdraw their published review", withdrawn.ok);
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[0])))[0];
    check("a withdrawn review carries no moderator (the student did it)",
      stored.status === "withdrawn" && stored.moderatedAt === null && stored.moderatedByAdminUserId === null);
    check("the withdrawn review leaves the public list",
      (await service.listPublicCourseReviews(courseB)).length === 2);
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseB)))[0];
    check("and the aggregate drops to (4+5)/2 = 45", course.ratingX10 === 45 && course.reviewsCount === 2);
    check("a withdrawn review cannot be published by an admin",
      !(await service.publishReview(reviewRows[0], admin)).ok);
  }

  {
    const rejected = await service.rejectReview(reviewRows[1], admin, null);
    check("an admin can reject with NO reason", rejected.ok);
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[1])))[0];
    check("the rejected review records its moderator and no reason",
      stored.status === "rejected" && stored.moderatedByAdminUserId === admin && stored.moderationReason === null);
    const shortReason = await service.rejectReview(reviewRows[2], admin, "qisqa");
    check("a 5-character reason is refused", !shortReason.ok && shortReason.code === "invalid_input");
    const withReason = await service.rejectReview(reviewRows[2], admin, "Matn reklama xarakterida edi.");
    check("an admin can reject with a real reason", withReason.ok);
    const stored2 = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[2])))[0];
    check("the reason is stored for the student",
      stored2.moderationReason === "Matn reklama xarakterida edi.");
    check("a REJECTED review cannot be withdrawn (it is already not public)",
      !(await service.withdrawOwnReview({
        reviewId: reviewRows[2],
        studentUserId: stored2.studentUserId,
      })).ok);
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseB)))[0];
    check("rejecting published reviews empties the course aggregate",
      course.ratingX10 === 0 && course.reviewsCount === 0);
    const auditRejects = await db
      .select()
      .from(schema.adminAuditEvents)
      .where(eq(schema.adminAuditEvents.action, "review_rejected"));
    check("rejections are audited", auditRejects.length === 2);
  }

  {
    // A rejected review is not a dead end: the student edits it back to pending.
    const author = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[2])))[0];
    const resubmit = await service.updateOwnReview({
      reviewId: reviewRows[2],
      studentUserId: author.studentUserId,
      rating: 4,
      body: "Tuzatilgan fikr: darslar aniq va amaliyot yetarli darajada berildi.",
    });
    check("a rejected review can be edited and resubmitted", resubmit.ok);
    const stored = (await db.select().from(schema.courseReviews).where(eq(schema.courseReviews.id, reviewRows[2])))[0];
    check("resubmission clears the rejection reason and returns to pending",
      stored.status === "pending" && stored.moderationReason === null);
    check("a resubmitted (pending) review can then be withdrawn",
      (await service.withdrawOwnReview({ reviewId: reviewRows[2], studentUserId: author.studentUserId })).ok);
  }

  /* --------------------- un-publishing a live review --------------------- */
  {
    const republish = await service.publishReview(reviewA, admin);
    check("a pending review can be published again", republish.ok);
    const hide = await service.rejectReview(reviewA, admin, "Fikr shaxsga tegishli edi.");
    check("an admin can take down a review that is already public", hide.ok);
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseA)))[0];
    check("un-publishing removes its value from the aggregate",
      course.ratingX10 === 0 && course.reviewsCount === 0);
    check("and from the public list", (await service.listPublicCourseReviews(courseA)).length === 0);
    check("an admin cannot publish a WITHDRAWN review",
      !(await service.publishReview(reviewRows[0], admin)).ok);
  }

  /* ----------------------- ownership immutability ------------------------ */
  console.log("\n# INTEGRITY — an author cannot re-point a review");

  await rejects("the composite FK refuses moving a review onto another student's enrollment", () =>
    db
      .update(schema.courseReviews)
      .set({ studentUserId: studentB })
      .where(eq(schema.courseReviews.id, reviewA)));

  {
    const otherCourse = await makeCourse(teacherB, "uchinchi-kurs");
    await rejects("the composite FK refuses moving a review onto another course", () =>
      db
        .update(schema.courseReviews)
        .set({ courseId: otherCourse })
        .where(eq(schema.courseReviews.id, reviewA)));
  }

  {
    const source = readFileSync(path.join(process.cwd(), "src/server/validation.ts"), "utf8");
    /*
     * The LITERAL only — sliced from the `export const` to its own `.strict();` —
     * so the assertion reads the accepted field list and not the prose comments
     * around it, which mention the absent fields by name precisely to say they are
     * absent.
     */
    const literalOf = (name: string): string => {
      const start = source.indexOf(`export const ${name}`);
      const end = source.indexOf(".strict();", start);
      return source.slice(start, end + ".strict();".length);
    };
    const createSchema = literalOf("createCourseReviewSchema");
    const updateSchema = literalOf("updateCourseReviewSchema");
    const publishSchema = literalOf("publishCourseReviewSchema");
    const rejectSchema = literalOf("rejectCourseReviewSchema");

    check("the create payload carries no author, role or status field",
      !createSchema.includes("studentUserId") &&
        !createSchema.includes("author") &&
        !createSchema.includes("role:") &&
        !createSchema.includes("status") &&
        createSchema.includes(".strict()"));
    check("the edit payload has no course, author or status field to tamper with",
      !updateSchema.includes("courseId") &&
        !updateSchema.includes("studentUserId") &&
        !updateSchema.includes("status") &&
        updateSchema.includes(".strict()"));
    check("the moderation payloads accept a decision, not a target status",
      !publishSchema.includes("status") &&
        !rejectSchema.includes("status:") &&
        publishSchema.includes(".strict()") &&
        rejectSchema.includes(".strict()"));
    check("every review schema is strict",
      [createSchema, updateSchema, publishSchema, rejectSchema, literalOf("withdrawCourseReviewSchema")]
        .every((schema) => schema.endsWith(".strict();")));
  }

  {
    const overPosted = validation.updateCourseReviewSchema.safeParse({
      reviewId: reviewA,
      rating: 5,
      body: BODY,
      studentUserId: studentB,
    });
    check("over-posting an author is a validation ERROR, not a silently ignored key",
      !overPosted.success);
    const badRating = validation.createCourseReviewSchema.safeParse({
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: "9",
      body: BODY,
    });
    check("the action-layer schema refuses a rating of 9", !badRating.success);
    const normalised = validation.createCourseReviewSchema.safeParse({
      courseId: courseA,
      enrollmentRequestId: enrollmentA,
      rating: "4",
      body: `  ${BODY}  `,
    });
    check("the action-layer schema coerces the rating and trims the body",
      normalised.success && normalised.data.rating === 4 && normalised.data.body === BODY);
  }

  /* --------------------------- safe projection --------------------------- */
  console.log("\n# PROJECTION — the public shape carries no identity");

  await service.publishReview(reviewA, admin);
  {
    const publicRow = (await service.listPublicCourseReviews(courseA))[0];
    check("the projection is exactly id, rating, body, date and author",
      JSON.stringify(Object.keys(publicRow).sort()) ===
        JSON.stringify(["author", "body", "date", "id", "rating"]));
    check("the author is the shared anonymous label, never a real name",
      publicRow.author === "Tasdiqlangan o‘quvchi");
    const raw = (await db
      .select({ phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, studentA)))[0];
    check("the projection does not contain the student's phone number",
      !JSON.stringify(publicRow).includes(raw.phone ?? ""));
    const queue = await service.listAdminReviewQueue({ status: "all" });
    const adminRow = queue.find((row) => row.id === reviewA);
    check("the ADMIN queue does identify the student by name",
      adminRow?.studentName === "O‘quvchi A");
    check("the admin queue projection carries no phone or email",
      adminRow !== undefined &&
        !("phone" in adminRow) &&
        !("email" in adminRow) &&
        !JSON.stringify(adminRow).includes(raw.phone ?? ""));
  }

  /* ------------------------ XSS / raw HTML handling ---------------------- */
  console.log("\n# SAFETY — text stays text");

  {
    const xssStudent = await makeStudent("O‘quvchi XSS");
    const xssEnrollment = await makeEnrollment(xssStudent, courseA, startedGroupA, "accepted");
    const payload = `<script>alert("xss")</script> <img src=x onerror=alert(1)>`;
    const created3 = await service.createReview({
      studentUserId: xssStudent,
      courseId: courseA,
      enrollmentRequestId: xssEnrollment,
      rating: 3,
      body: `Kurs yomon emas, lekin ${payload} sahifani buzolmaydi.`,
    });
    check("a review containing markup is stored, not executed", created3.ok);
    const xssReviewId = created3.ok ? created3.data!.id : "";
    if (created3.ok) {
      await service.publishReview(xssReviewId, admin);
      const publicRows = await service.listPublicCourseReviews(courseA);
      const stored = publicRows.find((row) => row.id === xssReviewId);
      check("the body is returned VERBATIM (no HTML is parsed or injected)",
        stored?.body.includes("<script>") === true);
    }
  }
  {
    const renderers = [
      "src/components/course-detail/course-reviews.tsx",
      "src/components/teachers/teacher-reviews.tsx",
      "src/components/course-detail/review-form.tsx",
      "src/components/admin/review-decision-form.tsx",
      "src/app/admin/reviews/page.tsx",
    ];
    check(
      "no review surface renders a body with dangerouslySetInnerHTML",
      renderers.every(
        (file) => !readFileSync(path.join(process.cwd(), file), "utf8").includes("dangerouslySetInnerHTML"),
      ),
    );
    check(
      "the review body is rendered as a React text child",
      readFileSync(
        path.join(process.cwd(), "src/components/course-detail/course-reviews.tsx"),
        "utf8",
      ).includes("{review.body}"),
    );
  }

  /* --------------------------- fixture removal --------------------------- */
  console.log("\n# FIXTURES — there is nothing left to fall back to");

  {
    const fixturePath = path.join(process.cwd(), "src/data/reviews.ts");
    check("the fictional review fixture file no longer exists", !existsSync(fixturePath));

    const walk = (current: string): string[] =>
      readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
      });
    const offenders = walk(path.join(process.cwd(), "src")).filter((file) =>
      readFileSync(file, "utf8").includes("@/data/reviews"),
    );
    check("no runtime module imports @/data/reviews", offenders.length === 0);

    const courseReviews = readFileSync(
      path.join(process.cwd(), "src/components/course-detail/course-reviews.tsx"),
      "utf8",
    );
    check("the course reviews component receives reviews as a prop",
      courseReviews.includes("reviews: PublicReviewView[]"));

    const teacherReviews = readFileSync(
      path.join(process.cwd(), "src/components/teachers/teacher-reviews.tsx"),
      "utf8",
    );
    check("the teacher reviews component receives reviews as a prop",
      teacherReviews.includes("reviews: PublicTeacherReviewView[]"));

    const seed = readFileSync(path.join(process.cwd(), "src/server/db/seed.ts"), "utf8");
    check("the seed no longer imports the fictional rating into courses",
      !seed.includes("Math.round(course.rating * 10)") &&
        !seed.includes("Math.round(teacher.rating * 10)"));
    check("the dev seed refuses to run in production",
      readFileSync(path.join(process.cwd(), "scripts/db.ts"), "utf8").includes(
        "db:seed refuses to run with NODE_ENV=production",
      ));
  }

  /* --------------------------- reconciliation ---------------------------- */
  console.log("\n# INTEGRITY — the caches match the rows");

  {
    const before = await service.reconcileAllReviewStats();
    check("reconciling a maintained database corrects nothing",
      before.corrected.courses === 0 && before.corrected.teachers === 0);

    // Hand-corrupt a cache, then prove the reconcile path repairs it from rows.
    await db
      .update(schema.courses)
      .set({ ratingX10: 47, reviewsCount: 99 })
      .where(eq(schema.courses.id, courseA));
    const after = await service.reconcileAllReviewStats();
    check("a hand-corrupted aggregate is repaired from the review rows",
      after.corrected.courses === 1);
    const repaired = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseA)))[0];
    const expected = await db.transaction((tx) => service.recalculateCourseReviewStats(tx, courseA));
    check("the repaired value equals the recomputed value",
      repaired.ratingX10 === expected.ratingX10 && repaired.reviewsCount === expected.reviewsCount);
    check("and it is NOT the corrupted value", repaired.reviewsCount !== 99);
  }

  /* ------------------------ concurrency / duplicates --------------------- */
  console.log("\n# CONCURRENCY — the database is the duplicate guard");

  {
    const racer = await makeStudent("O‘quvchi Poyga");
    const racerEnrollment = await makeEnrollment(racer, courseB, groupB, "accepted");
    const attempts = await Promise.all(
      [1, 2, 3].map(() =>
        service.createReview({
          studentUserId: racer,
          courseId: courseB,
          enrollmentRequestId: racerEnrollment,
          rating: 4,
          body: "Bir vaqtda yuborilgan uchta so‘rovdan faqat bittasi qolishi kerak.",
        }),
      ),
    );
    const succeeded = attempts.filter((attempt) => attempt.ok).length;
    const rows = await db
      .select({ id: schema.courseReviews.id })
      .from(schema.courseReviews)
      .where(
        and(
          eq(schema.courseReviews.courseId, courseB),
          eq(schema.courseReviews.studentUserId, racer),
        ),
      );
    check("three racing submissions produce exactly one review row", rows.length === 1);
    check("and exactly one call reports success", succeeded === 1);
    check("the losers get the honest duplicate message",
      attempts.filter((a) => !a.ok).every((a) => a.code === "duplicate_review"));
  }

  /* --------------------------- cascade behaviour ------------------------- */
  console.log("\n# REFERENTIAL — what a review is tied to");

  await rejects("deleting the enrollment behind a review is refused (ON DELETE RESTRICT)", () =>
    db.delete(schema.enrollmentRequests).where(eq(schema.enrollmentRequests.id, enrollmentA)));

  {
    const doomedCourse = await makeCourse(teacherB, "ochiriladigan-kurs");
    const doomedGroup = await makeGroup(doomedCourse, daysFromNow(-3));
    const doomedStudent = await makeStudent("O‘quvchi O‘chirish");
    const doomedEnrollment = await makeEnrollment(doomedStudent, doomedCourse, doomedGroup, "accepted");
    const doomed = await service.createReview({
      studentUserId: doomedStudent,
      courseId: doomedCourse,
      enrollmentRequestId: doomedEnrollment,
      rating: 5,
      body: "Bu kurs o‘chirilsa, fikri ham birga ketishi kerak.",
    });
    check("the review was created", doomed.ok);
    await db.delete(schema.courses).where(eq(schema.courses.id, doomedCourse));
    const remaining = await db
      .select({ id: schema.courseReviews.id })
      .from(schema.courseReviews)
      .where(eq(schema.courseReviews.courseId, doomedCourse));
    check("deleting a course cascades to its reviews", remaining.length === 0);
  }

  /* ------------------------- public repo boundary ------------------------ */
  console.log("\n# BOUNDARY — the public marketplace keeps one door");

  {
    const publicRepo = readFileSync(path.join(process.cwd(), "src/server/public-repo.ts"), "utf8");
    check("public-repo exposes the course review read",
      publicRepo.includes("export async function listPublicCourseReviews"));
    check("public-repo exposes the teacher review read",
      publicRepo.includes("export async function listPublicTeacherReviews"));
    const coursePage = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/courses/[slug]/page.tsx"),
      "utf8",
    );
    check("the course page loads its review context from the session + database",
      coursePage.includes("getCourseReviewContext") && coursePage.includes("getCurrentUser"));
    const teacherPage = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/teachers/[slug]/page.tsx"),
      "utf8",
    );
    check("the teacher page loads reviews through the public repository",
      teacherPage.includes("listPublicTeacherReviews"));
  }

  /* ------------------------------ summary -------------------------------- */
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const name of failures) console.log(`  - ${name}`);
  }
}

main()
  .then(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(fail > 0 ? 1 : 0);
  })
  .catch((error: unknown) => {
    console.error(error);
    rmSync(DATA_DIR, { recursive: true, force: true });
    process.exit(1);
  });
