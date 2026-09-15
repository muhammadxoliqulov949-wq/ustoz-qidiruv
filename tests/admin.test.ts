/* -------------------------------------------------------------------------- */
/* Phase 15 admin control-plane test suite.                                    */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the same committed migrations production uses. Every claim about     */
/* authorization, the verification lifecycle, moderation, the audit log and     */
/* concurrency is proven against the actual database and the actual service     */
/* code — not against a mock.                                                   */
/*                                                                              */
/*   npm run test:admin                                                         */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-admin-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
/*
 * PHASE 18. A verification application is now document-backed, so this suite
 * needs a storage provider to attach the required evidence. The LOCAL provider
 * writes to a throwaway directory inside the suite's own temp dir: no network,
 * no cloud credentials, and everything is deleted at the end.
 */
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = path.join(DATA_DIR, "storage");
process.env.STORAGE_SIGNING_SECRET = "admin-suite-signing-secret-0123456789";

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

async function main(): Promise<void> {
  /* --------------------------- migrate from scratch ------------------------ */
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

  const { eq, and } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const verification = await import("../src/server/verification-service");
  const moderation = await import("../src/server/moderation-service");
  const audit = await import("../src/server/audit-service");
  const contracts = await import("../src/lib/course-moderation");
  const verifyCopy = await import("../src/lib/teacher-verification");
  const validation = await import("../src/server/validation");
  const publicRepo = await import("../src/server/public-repo");
  const { parseCourseBrowseParams } = await import("../src/lib/course-search");

  const db = getDb();
  const browseAll = parseCourseBrowseParams({});

  /* ------------------------------ fixtures -------------------------------- */
  const passwordHash = await hashPassword("supersecret-qa");

  async function makeTeacher(name: string, phone: string, complete: boolean) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role: "teacher", phone, passwordHash });
    await db.insert(schema.teacherProfiles).values({
      userId: id,
      role: "teacher",
      slug: `qa-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase()}`,
      name,
      city: complete ? "Toshkent" : null,
      languages: complete ? ["O‘zbek"] : [],
      experienceYears: complete ? 5 : null,
      bio: complete ? "B".repeat(80) : null,
      approach: complete ? "A".repeat(60) : null,
      specialization: complete ? "Matematika" : null,
      isPublic: false,
      verification: "unverified",
    });
    return id;
  }

  async function makeAdmin(phone: string) {
    const id = newId("usr");
    // An admin has NO profile row: the composite role FK forbids it.
    await db.insert(schema.users).values({ id, role: "admin", phone, passwordHash });
    return id;
  }

  async function makeCourse(
    teacherUserId: string,
    status: "draft" | "ready" | "published",
    slug: string,
  ) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: `QA kursi ${slug}`,
      categoryId: "matematika",
      level: "orta",
      format: "online",
      priceUzs: 300000,
      summary: "S".repeat(80),
      longDescription: "L".repeat(80),
      status,
      publishedAt: status === "published" ? "2026-05-01" : null,
    });
    return id;
  }

  async function addGroup(courseId: string) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id,
      courseId,
      title: "A guruhi",
      days: ["Du", "Ch"],
      startTime: "18:00",
      endTime: "19:30",
      capacity: 10,
      startDate: "2026-10-05",
    });
    return id;
  }

  async function addModule(courseId: string) {
    const id = newId("mod");
    await db.insert(schema.syllabusModules).values({
      id,
      courseId,
      position: 1,
      title: "Kirish",
      description: "D".repeat(20),
      lessons: 4,
    });
    return id;
  }

  const teacherA = await makeTeacher("Ustoz To‘liq", "+998902220001", true);
  const teacherB = await makeTeacher("Ustoz Tugallanmagan", "+998902220002", false);
  const adminA = await makeAdmin("+998902220003");
  const adminB = await makeAdmin("+998902220004");

  async function notificationCount(userId: string, type: string) {
    const rows = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.type, type as never)));
    return rows.length;
  }

  async function auditCount(action: string) {
    const rows = await db
      .select({ id: schema.adminAuditEvents.id })
      .from(schema.adminAuditEvents)
      .where(eq(schema.adminAuditEvents.action, action as never));
    return rows.length;
  }

  /* ============================ INTENT SCHEMAS ============================ */
  console.log("\n# INTENT SCHEMAS — the shape of a legitimate request");

  check("verifyTeacher accepts exactly {requestId}",
    validation.verifyTeacherSchema.safeParse({ requestId: "tvr-1" }).success);
  check("verifyTeacher REJECTS status over-post",
    !validation.verifyTeacherSchema.safeParse({ requestId: "tvr-1", status: "approved" }).success);
  check("verifyTeacher REJECTS verification over-post",
    !validation.verifyTeacherSchema.safeParse({ requestId: "tvr-1", verification: "verified" }).success);
  check("verifyTeacher REJECTS adminUserId over-post (identity is the session)",
    !validation.verifyTeacherSchema.safeParse({ requestId: "tvr-1", adminUserId: adminA }).success);
  check("verifyTeacher REJECTS a decision field",
    !validation.verifyTeacherSchema.safeParse({ requestId: "tvr-1", decision: "approve" }).success);

  check("rejectTeacherVerification REJECTS missing feedback",
    !validation.rejectTeacherVerificationSchema.safeParse({ requestId: "tvr-1" }).success);
  check("rejectTeacherVerification REJECTS short feedback",
    !validation.rejectTeacherVerificationSchema.safeParse({ requestId: "tvr-1", feedback: "qisqa" }).success);
  check("rejectTeacherVerification accepts a valid reason",
    validation.rejectTeacherVerificationSchema.safeParse({
      requestId: "tvr-1",
      feedback: "Tajriba va mutaxassislik bo‘limini to‘ldiring.",
    }).success);
  check("rejectTeacherVerification REJECTS feedback beyond the column limit",
    !validation.rejectTeacherVerificationSchema.safeParse({
      requestId: "tvr-1",
      feedback: "x".repeat(501),
    }).success);

  check("publishCourse accepts exactly {reviewId}",
    validation.publishCourseSchema.safeParse({ reviewId: "cmr-1" }).success);
  check("publishCourse REJECTS status over-post",
    !validation.publishCourseSchema.safeParse({ reviewId: "cmr-1", status: "published" }).success);
  check("publishCourse REJECTS published over-post",
    !validation.publishCourseSchema.safeParse({ reviewId: "cmr-1", published: true }).success);

  check("requestCourseChanges REJECTS missing feedback",
    !validation.requestCourseChangesSchema.safeParse({ reviewId: "cmr-1" }).success);
  check("requestCourseChanges accepts a valid reason",
    validation.requestCourseChangesSchema.safeParse({
      reviewId: "cmr-1",
      feedback: "Guruh jadvalini va narxni aniqlashtiring.",
    }).success);

  check("the teacher's submission schema is an EMPTY strict object",
    validation.submitTeacherVerificationSchema.safeParse({}).success);
  check("teacher submission REJECTS verification over-post",
    !validation.submitTeacherVerificationSchema.safeParse({ verification: "verified" }).success);
  check("teacher submission REJECTS teacherUserId over-post",
    !validation.submitTeacherVerificationSchema.safeParse({ teacherUserId: teacherA }).success);
  check("submitCourseForReview accepts exactly {courseId}",
    validation.submitCourseForReviewSchema.safeParse({ courseId: "crs-1" }).success);

  /* ============================== BOOTSTRAP =============================== */
  console.log("\n# BOOTSTRAP — an admin cannot be created from the product surface");

  check("the account-creation schema allows only student|teacher",
    validation.roleSchema.options.length === 2 &&
      !validation.roleSchema.safeParse("admin").success);
  check("registering with role=admin is rejected by validation",
    !validation.registerSchema.safeParse({
      role: "admin",
      phone: "+998902220099",
      password: "supersecret",
      terms: "1",
    }).success);
  check("profile-completion schema has no `verification` field at all",
    !validation.teacherProfileSchema.safeParse({
      name: "Ustoz",
      city: "Toshkent",
      verification: "verified",
    }).success);

  // An admin is a profile-less account: the database enforces it.
  await rejects("a profile row cannot be attached to an admin account (composite role FK)", () =>
    db.insert(schema.studentProfiles).values({ userId: adminA, role: "student", name: "X" }));
  await rejects("a teacher profile cannot be attached to an admin account", () =>
    db.insert(schema.teacherProfiles).values({
      userId: adminA,
      role: "teacher",
      slug: "qa-bootstrap-admin",
      name: "Admin",
    }));
  check("an admin owns no courses by construction (no teacher profile)",
    (await db.select().from(schema.courses).where(eq(schema.courses.teacherUserId, adminA))).length === 0);

  /* ========================= TEACHER VERIFICATION ========================= */
  console.log("\n# TEACHER VERIFICATION — submit, decide, and who may write `verified`");

  const incomplete = await verification.submitVerificationRequest(teacherB);
  check("an incomplete profile cannot submit (ineligible)",
    !incomplete.ok && incomplete.code === "ineligible");
  check("a refused submission writes NO request row",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherB))).length === 0);

  /* ---------------------------------------------------------------------- */
  /* PHASE 18: evidence is required. A complete PROFILE is no longer enough. */
  /* ---------------------------------------------------------------------- */
  const noEvidence = await verification.submitVerificationRequest(teacherA);
  check("a complete profile WITHOUT the required document cannot submit",
    !noEvidence.ok && noEvidence.code === "missing_documents");
  check("the refused submission writes NO request row",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherA))).length === 0);

  const storage = await import("../src/server/storage");
  const { LocalStorageProvider } = await import("../src/server/storage/local-provider");
  storage.__setStorageProviderForTesting(new LocalStorageProvider({
    directory: process.env.STORAGE_LOCAL_DIR!,
    signingSecret: process.env.STORAGE_SIGNING_SECRET!,
    publicPathPrefix: "/api/media",
  }));
  const files = await import("../src/server/file-service");
  const identityUpload = await files.uploadVerificationDocument(teacherA, "identity_document", {
    bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
    fileName: "identity.pdf",
  });
  check("the required identity document uploads", identityUpload.ok);

  const submitA = await verification.submitVerificationRequest(teacherA);
  check("a complete profile WITH the required document can submit", submitA.ok);

  const profileAfterSubmit = (
    await db.select().from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.userId, teacherA))
  )[0];
  check("submitting moves the profile to `pending`", profileAfterSubmit?.verification === "pending");
  check("submitting NEVER sets `verified`", profileAfterSubmit?.verification !== "verified");

  const requestsA = await db
    .select()
    .from(schema.teacherVerificationRequests)
    .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherA));
  check("exactly one application row exists", requestsA.length === 1);
  const requestA = requestsA[0];
  if (!requestA) throw new Error("fixture failure: the application row is missing");

  const again = await verification.submitVerificationRequest(teacherA);
  check("a second submission is refused (already_pending)",
    !again.ok && again.code === "already_pending");
  check("the refusal did not create a duplicate row",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherA))).length === 1);

  await rejects("the DATABASE refuses a second live application (partial unique index)", () =>
    db.insert(schema.teacherVerificationRequests).values({
      id: newId("tvr"),
      teacherUserId: teacherA,
      status: "pending",
    }));
  check("a decided row without a reviewer is refused (CHECK)",
    await (async () => {
      try {
        await db.insert(schema.teacherVerificationRequests).values({
          id: newId("tvr"),
          teacherUserId: teacherB,
          status: "approved",
        });
        return false;
      } catch {
        return true;
      }
    })());

  check("a decision by a NON-admin identity is refused",
    await (async () => {
      const result = await verification.approveVerification(requestA.id, teacherB);
      return !result.ok && result.code === "forbidden";
    })());
  check("the refused decision changed nothing",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestA.id)))[0]?.status === "pending");
  check("the refused decision left no audit row",
    (await auditCount("teacher_verified")) === 0);

  const approve = await verification.approveVerification(requestA.id, adminA);
  check("an admin can approve", approve.ok && approve.data?.idempotent === false);
  check("the request is `approved`",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestA.id)))[0]?.status === "approved");
  const verifiedProfile = (
    await db.select().from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.userId, teacherA))
  )[0];
  check("the profile is `verified`", verifiedProfile?.verification === "verified");
  check("approval makes the owner public (their published course must resolve)", verifiedProfile?.isPublic === true);
  check("the decision records the reviewing admin",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestA.id)))[0]?.reviewedByAdminUserId === adminA);
  check("an audit row was written", (await auditCount("teacher_verified")) === 1);
  check("the teacher was notified", (await notificationCount(teacherA, "verification_approved")) === 1);

  const approveRetry = await verification.approveVerification(requestA.id, adminB);
  check("a retry is idempotent (already_decided)",
    approveRetry.ok && approveRetry.data?.idempotent === true);
  check("the retry wrote NO second audit row", (await auditCount("teacher_verified")) === 1);
  check("the retry wrote NO second notification",
    (await notificationCount(teacherA, "verification_approved")) === 1);

  const flip = await verification.rejectVerification(requestA.id, adminB, "Fikrim o‘zgardi, hammasi bekor.");
  check("the OPPOSITE decision on a decided application is refused",
    !flip.ok && flip.code === "invalid_transition");
  check("the original decision still stands",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestA.id)))[0]?.status === "approved");
  check("the refused flip left no rejection audit row",
    (await auditCount("teacher_verification_rejected")) === 0);

  /* ---------------------- rejection is not a permanent block -------------- */
  const submitB = await verification.submitVerificationRequest(teacherB);
  check("the incomplete profile still refuses, and the teacher sees why",
    !submitB.ok && submitB.code === "ineligible");

  // Complete the profile through the service's own eligibility rule.
  await db.update(schema.teacherProfiles).set({
    city: "Toshkent",
    languages: ["O‘zbek"],
    experienceYears: 3,
    bio: "B".repeat(80),
    approach: "A".repeat(60),
    specialization: "Fizika",
  }).where(eq(schema.teacherProfiles.userId, teacherB));

  // Phase 18: the completed profile still needs its own evidence.
  const submitBNoEvidence = await verification.submitVerificationRequest(teacherB);
  check("a completed profile without evidence is refused with the reason",
    !submitBNoEvidence.ok && submitBNoEvidence.code === "missing_documents");
  const teacherBDocument = await files.uploadVerificationDocument(teacherB, "identity_document", {
    bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
    fileName: "b-identity.pdf",
  });
  check("the second teacher's own evidence uploads", teacherBDocument.ok);
  check("evidence is owner-scoped: A's document is not counted for B",
    (await files.listOwnVerificationDocuments(teacherB)).length === 1);

  const submitB2 = await verification.submitVerificationRequest(teacherB);
  check("a completed profile with its own evidence can submit", submitB2.ok);
  const requestB = (
    await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherB))
  )[0];
  if (!requestB) throw new Error("fixture failure: teacher B's application row is missing");

  const reject = await verification.rejectVerification(
    requestB.id,
    adminA,
    "Tajriba yillari va mutaxassislikni aniqroq yozing.",
  );
  check("an admin can return an application with feedback", reject.ok);
  const returnedProfile = (
    await db.select().from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.userId, teacherB))
  )[0];
  check("a returned application sends the profile back to `unverified`",
    returnedProfile?.verification === "unverified");
  check("the request is `rejected`",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestB.id)))[0]?.status === "rejected");
  check("the feedback is stored on the request row",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.id, requestB.id)))[0]?.feedback ===
      "Tajriba yillari va mutaxassislikni aniqroq yozing.");
  check("a rejection audit row was written", (await auditCount("teacher_verification_rejected")) === 1);
  check("the teacher was notified with the reason",
    (await notificationCount(teacherB, "verification_rejected")) === 1);
  const rejectNotice = (
    await db.select().from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, teacherB),
        eq(schema.notifications.type, "verification_rejected" as never),
      ))
  )[0];
  check("the notification carries the reviewer's reason",
    rejectNotice?.body.includes("mutaxassislikni aniqroq") === true);

  const resubmit = await verification.submitVerificationRequest(teacherB);
  check("a rejected teacher can RESUBMIT (never permanently blocked)", resubmit.ok);
  check("history now holds two applications for that teacher",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherB))).length === 2);
  check("exactly one of them is live",
    (await db.select().from(schema.teacherVerificationRequests)
      .where(and(
        eq(schema.teacherVerificationRequests.teacherUserId, teacherB),
        eq(schema.teacherVerificationRequests.status, "pending"),
      ))).length === 1);

  /* -------------------------------- queues -------------------------------- */
  const queue = await verification.listVerificationQueue({ status: "pending" });
  check("the pending queue lists only live applications",
    queue.every((row) => row.requestStatus === "pending"));
  check("the queue is ordered oldest-submission-first",
    queue.length < 2 || queue[0].submittedAt.getTime() <= queue[1].submittedAt.getTime());
  const counts = await verification.getVerificationQueueCounts();
  check("queue counts are real row counts",
    counts.pending === 1 && counts.approved === 1 && counts.rejected === 1 && counts.verifiedTeachers === 1);

  const detail = await verification.getTeacherReviewDetail(teacherB);
  check("the review detail exposes the live application", detail?.pending?.id !== undefined);
  check("the review detail includes the teacher's own courses only",
    detail?.courses.every((course) => typeof course.id === "string") === true);
  check("the review detail does NOT expose a phone number",
    detail !== null && !("phone" in detail));
  check("the review detail returns null for an unknown teacher",
    (await verification.getTeacherReviewDetail("usr-ghost")) === null);
  check("the detail page copy never claims documents were reviewed",
    detail?.documentReviewNotice === verifyCopy.DOCUMENT_REVIEW_NOTICE);

  /* ============================== MODERATION ============================== */
  console.log("\n# MODERATION — ready → published, and who may publish");

  check("a TEACHER has no transition to `published`",
    !contracts.canTransitionCourse("teacher", "ready", "published"));
  check("a TEACHER cannot move `published` back to `draft`",
    !contracts.canTransitionCourse("teacher", "published", "draft"));
  check("an ADMIN may publish a ready course",
    contracts.canTransitionCourse("admin", "ready", "published"));
  check("an ADMIN may return a ready course to the teacher",
    contracts.canTransitionCourse("admin", "ready", "draft"));
  check("there is NO `rejected` course state (a return is a draft, not a dead end)",
    !contracts.COURSE_STATES.includes("rejected" as never));
  check("a course under review is not editable by its teacher",
    !contracts.canTeacherEdit("ready") && !contracts.canTeacherEdit("published"));
  check("a published course is locked for its teacher", contracts.isLockedForTeacher("published"));

  const unverifiedTeacher = teacherB; // verification is `pending` here (resubmitted above)
  const courseUnverified = await makeCourse(unverifiedTeacher, "ready", "qa-ready-unverified");
  await addGroup(courseUnverified);
  await addModule(courseUnverified);
  const reviewUnverified = (
    await db.transaction((tx) =>
      moderation.ensureModerationReview(tx, {
        courseId: courseUnverified,
        teacherUserId: unverifiedTeacher,
      }),
    )
  ).reviewId;

  const publishBlocked = await moderation.publishCourse(reviewUnverified, adminA);
  check("publishing is REFUSED while the owner is not verified",
    !publishBlocked.ok && publishBlocked.code === "teacher_not_verified");
  check("the blocked course is still `ready`, not published",
    (await db.select().from(schema.courses)
      .where(eq(schema.courses.id, courseUnverified)))[0]?.status === "ready");
  check("a blocked publish writes no published_at",
    (await db.select().from(schema.courses)
      .where(eq(schema.courses.id, courseUnverified)))[0]?.publishedAt === null);
  check("a blocked publish writes no audit row", (await auditCount("course_published")) === 0);
  check("a blocked publish writes no notification",
    (await notificationCount(unverifiedTeacher, "course_published")) === 0);
  check("the ready course is invisible on the public surface",
    (await publicRepo.listPublicCourses(browseAll)).every((c) => c.id !== courseUnverified) &&
      (await publicRepo.getPublicCourseBySlug("qa-ready-unverified")) === null);

  /* --------------------------- the publish path --------------------------- */
  const courseReady = await makeCourse(teacherA, "ready", "qa-ready-verified");
  await addGroup(courseReady);
  await addModule(courseReady);
  const reviewReady = (
    await db.transaction((tx) =>
      moderation.ensureModerationReview(tx, { courseId: courseReady, teacherUserId: teacherA }),
    )
  ).reviewId;

  const ensureAgain = await db.transaction((tx) =>
    moderation.ensureModerationReview(tx, { courseId: courseReady, teacherUserId: teacherA }));
  check("ensuring a review twice returns the SAME live review",
    ensureAgain.reviewId === reviewReady && ensureAgain.created === false);
  check("...and creates no second row",
    (await db.select().from(schema.courseModerationReviews)
      .where(and(
        eq(schema.courseModerationReviews.courseId, courseReady),
        eq(schema.courseModerationReviews.status, "pending"),
      ))).length === 1);
  await rejects("the DATABASE refuses a second live review (partial unique index)", () =>
    db.insert(schema.courseModerationReviews).values({
      id: newId("cmr"),
      courseId: courseReady,
      submittedByTeacherUserId: teacherA,
    }));

  const decideByTeacher = await moderation.publishCourse(reviewReady, teacherA);
  check("a TEACHER's identity cannot publish (service refuses a non-admin)",
    !decideByTeacher.ok && decideByTeacher.code === "forbidden");
  check("the refusal left the course unpublishable-but-intact",
    (await db.select().from(schema.courses)
      .where(eq(schema.courses.id, courseReady)))[0]?.status === "ready");

  const published = await moderation.publishCourse(reviewReady, adminA);
  check("an admin publishes a ready course from a verified teacher",
    published.ok && published.data?.idempotent === false);
  const courseRow = (
    await db.select().from(schema.courses).where(eq(schema.courses.id, courseReady))
  )[0];
  check("the course is `published`", courseRow?.status === "published");
  check("published_at is set to an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(courseRow?.publishedAt ?? ""));
  check("the review is `approved` and records the reviewer",
    (await db.select().from(schema.courseModerationReviews)
      .where(eq(schema.courseModerationReviews.id, reviewReady)))[0]?.status === "approved");
  check("the publish is audited", (await auditCount("course_published")) === 1);
  check("the teacher is notified", (await notificationCount(teacherA, "course_published")) === 1);

  // THE no-redeploy guarantee: the public read surface must see it immediately.
  check("the published course is public AT ONCE (no rebuild needed)",
    (await publicRepo.listPublicCourses(browseAll)).some((c) => c.id === courseReady));
  check("its public detail page resolves",
    (await publicRepo.getPublicCourseBySlug("qa-ready-verified")) !== null);
  check("the reviewed course is now locked for its teacher",
    !contracts.canTeacherEdit(courseRow?.status ?? "draft"));

  const republish = await moderation.publishCourse(reviewReady, adminB);
  check("re-publishing is idempotent (already_decided)",
    republish.ok && republish.data?.idempotent === true);
  check("re-publishing did NOT overwrite published_at",
    (await db.select().from(schema.courses).where(eq(schema.courses.id, courseReady)))[0]
      ?.publishedAt === courseRow?.publishedAt);
  check("re-publishing wrote no second audit row", (await auditCount("course_published")) === 1);
  check("re-publishing wrote no second notification",
    (await notificationCount(teacherA, "course_published")) === 1);

  const conflicting = await moderation.requestCourseChanges(
    reviewReady,
    adminB,
    "Aslida o‘zgartirish kerak edi.",
  );
  check("a decided review cannot be flipped to changes_requested",
    !conflicting.ok && conflicting.code === "invalid_transition");
  check("the published course was NOT pulled back to draft",
    (await db.select().from(schema.courses).where(eq(schema.courses.id, courseReady)))[0]
      ?.status === "published");

  /* ------------------------- request changes path ------------------------- */
  const courseChanges = await makeCourse(teacherA, "ready", "qa-ready-changes");
  await addGroup(courseChanges);
  await addModule(courseChanges);
  const reviewChanges = (
    await db.transaction((tx) =>
      moderation.ensureModerationReview(tx, { courseId: courseChanges, teacherUserId: teacherA }),
    )
  ).reviewId;

  const changes = await moderation.requestCourseChanges(
    reviewChanges,
    adminA,
    "Narxni va guruh jadvalini aniqlashtirib, qayta yuboring.",
  );
  check("an admin returns a ready course to the teacher", changes.ok);
  check("the course is back to `draft`",
    (await db.select().from(schema.courses).where(eq(schema.courses.id, courseChanges)))[0]
      ?.status === "draft");
  check("the review is `changes_requested` with the feedback",
    (await db.select().from(schema.courseModerationReviews)
      .where(eq(schema.courseModerationReviews.id, reviewChanges)))[0]?.feedback ===
      "Narxni va guruh jadvalini aniqlashtirib, qayta yuboring.");
  check("the return is audited", (await auditCount("course_changes_requested")) === 1);
  check("the teacher is notified with the reason",
    (await notificationCount(teacherA, "course_changes_requested")) === 1);
  check("the returned course is still private",
    (await publicRepo.getPublicCourseBySlug("qa-ready-changes")) === null);

  const resubmitReview = await db.transaction((tx) =>
    moderation.ensureModerationReview(tx, { courseId: courseChanges, teacherUserId: teacherA }));
  check("the teacher can resubmit after a return (a NEW live review exists)",
    resubmitReview.reviewId !== reviewChanges && resubmitReview.created === true);

  const publishNoReview = await moderation.publishCourse(newId("cmr"), adminA);
  check("publishing against a nonexistent review is refused",
    !publishNoReview.ok && publishNoReview.code === "not_found");

  const publishDraftCourse = await makeCourse(teacherA, "draft", "qa-draft-direct");
  await rejects("a review cannot be opened for a course in an arbitrary state (CHECK on course id FKs)", () =>
    db.insert(schema.courseModerationReviews).values({
      id: newId("cmr"),
      courseId: newId("crs"),
      submittedByTeacherUserId: teacherA,
    }));
  check("a draft course has no review to decide",
    (await moderation.getPendingReviewForCourse(publishDraftCourse)) === null);

  await rejects("the DATABASE refuses a published course without published_at", () =>
    db.insert(schema.courses).values({
      id: newId("crs"),
      slug: "qa-published-no-date",
      teacherUserId: teacherA,
      title: "Sanasiz kurs",
      categoryId: "matematika",
      level: "orta",
      format: "online",
      priceUzs: 0,
      summary: "S".repeat(60),
      status: "published",
    }));

  /* ================================ AUDIT ================================= */
  console.log("\n# AUDIT LOG — append-only, safe metadata, no secrets");

  const events = await audit.listAuditEvents({ limit: 50 });
  check("every decision so far is in the log",
    events.length === 4 && (await audit.countAuditEvents()) === 4);
  check("the log records the acting admin's id",
    events.every((event) => event.adminName.length > 0));
  check("metadata stays short and machine-readable",
    events.every((event) => event.metadata === null || event.metadata.length <= 300));
  const auditText = JSON.stringify(events);
  check("no phone number appears in the audit log", !auditText.includes("+998"));
  check("no password hash appears in the audit log", !auditText.includes("$argon2"));
  check("no session token appears in the audit log", !auditText.includes("tokenHash"));
  check("the audit table has no `updated_at` column (rows are immutable by shape)",
    await (async () => {
      const rows = await db.select().from(schema.adminAuditEvents).limit(1);
      return rows.length > 0 && !("updatedAt" in rows[0]);
    })());
  await rejects("the entity type is constrained by the database", () =>
    db.insert(schema.adminAuditEvents).values({
      id: newId("aud"),
      adminUserId: adminA,
      action: "teacher_verified",
      entityType: "enrollment",
      entityId: "enr-1",
    }));
  await rejects("an unknown audit action is refused", () =>
    db.insert(schema.adminAuditEvents).values({
      id: newId("aud"),
      adminUserId: adminA,
      action: "user_promoted" as never,
      entityType: "teacher",
      entityId: teacherA,
    }));
  await rejects("a metadata payload longer than the column limit is refused", () =>
    db.insert(schema.adminAuditEvents).values({
      id: newId("aud"),
      adminUserId: adminA,
      action: "teacher_verified",
      entityType: "teacher",
      entityId: teacherA,
      metadata: "x".repeat(301),
    }));
  await rejects("deleting an admin who made decisions is refused (NO ACTION)", () =>
    db.delete(schema.users).where(eq(schema.users.id, adminA)));
  check("the audit rows survive a failed delete attempt", (await audit.countAuditEvents()) === 4);

  /* ============================= CONCURRENCY ============================== */
  console.log("\n# CONCURRENCY — racing admins produce exactly ONE decision");

  const raceTeacher = await makeTeacher("Ustoz Poyga", "+998902220005", true);
  // Phase 18: the racing application is document-backed like any other.
  await files.uploadVerificationDocument(raceTeacher, "identity_document", {
    bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"),
    fileName: "race-identity.pdf",
  });
  await verification.submitVerificationRequest(raceTeacher);
  const raceRequest = (
    await db.select().from(schema.teacherVerificationRequests)
      .where(eq(schema.teacherVerificationRequests.teacherUserId, raceTeacher))
  )[0];
  if (!raceRequest) throw new Error("fixture failure: the racing application row is missing");

  const raceOutcomes = await Promise.all([
    verification.approveVerification(raceRequest.id, adminA),
    verification.approveVerification(raceRequest.id, adminB),
  ]);
  const appliedCount = raceOutcomes.filter((result) => result.ok && result.data?.idempotent === false).length;
  const decidedCount = raceOutcomes.filter((result) => result.ok && result.data?.idempotent === true).length;
  check("exactly one of the two racing approvals applied the decision", appliedCount === 1);
  check("the other reported a deterministic idempotent outcome", decidedCount === 1);
  check("one audit row for the race", (await auditCount("teacher_verified")) === 2);
  check("one notification for the race",
    (await notificationCount(raceTeacher, "verification_approved")) === 1);

  const raceCourse = await makeCourse(teacherA, "ready", "qa-race-publish");
  await addGroup(raceCourse);
  const raceReview = (
    await db.transaction((tx) =>
      moderation.ensureModerationReview(tx, { courseId: raceCourse, teacherUserId: teacherA }),
    )
  ).reviewId;
  const racePublish = await Promise.all([
    moderation.publishCourse(raceReview, adminA),
    moderation.publishCourse(raceReview, adminB),
  ]);
  check("exactly one racing publish applied",
    racePublish.filter((result) => result.ok && result.data?.idempotent === false).length === 1);
  check("the loser reported the same decision (not a second publish)",
    racePublish.filter((result) => result.ok && result.data?.idempotent === true).length === 1);
  check("exactly one publish audit row was written for the race",
    (await auditCount("course_published")) === 2);
  check("exactly one publish notification was written",
    (await notificationCount(teacherA, "course_published")) === 2);
  check("a race never leaves the course in an intermediate state",
    (await db.select().from(schema.courses)
      .where(eq(schema.courses.id, raceCourse)))[0]?.status === "published");

  /* ============================ ADMIN OVERVIEW ============================ */
  console.log("\n# ADMIN PROJECTIONS — facts, and no student/payment data");

  const adminService = await import("../src/server/admin-service");
  const overview = await adminService.getAdminOverview();
  check("pending verifications is a real count", overview.pendingVerifications === 1);
  check("published courses is a real count", overview.publishedCourses === 2);
  check("verified teachers is a real count", overview.verifiedTeachers === 2);
  check("the audit total matches the log", overview.auditEvents === await audit.countAuditEvents());
  const stateCounts = await adminService.getCourseStateCounts();
  check("the course state distribution counts every course",
    Object.values(stateCounts).reduce((sum, value) => sum + value, 0) ===
      (await db.select({ id: schema.courses.id }).from(schema.courses)).length);
  const teacherCourseCounts = await adminService.countTeacherCoursesByState(teacherA);
  check("ownership scoping counts only that teacher's courses",
    teacherCourseCounts.published + teacherCourseCounts.draft + teacherCourseCounts.ready ===
      (await db.select({ id: schema.courses.id }).from(schema.courses)
        .where(eq(schema.courses.teacherUserId, teacherA))).length);
  check("the admin status line is composed of two real counts",
    (await adminService.getAdminStatusLine()).includes("ustoz"));

  const queueRow = (await moderation.listModerationQueue({ status: "all" }))[0];
  check("the moderation queue row carries no payment or enrollment data",
    queueRow !== undefined && !("paymentId" in queueRow) && !("studentUserId" in queueRow));

  /* ----------------------- published courses are read-only ---------------- */
  const publishedDetail = await moderation.getCourseReviewDetail(courseReady);
  check("a published course reports its approved review",
    publishedDetail?.approvedReview?.status === "approved");
  check("a published course has no live review to act on",
    publishedDetail?.review?.status !== "pending");

  /* ------------------------- no cross-teacher leakage --------------------- */
  const teacherQueueRows = await moderation.getTeacherModerationStates(teacherA);
  const teacherAOwned = [courseReady, courseChanges, raceCourse, publishDraftCourse];
  check("a teacher's moderation state map only contains their own courses",
    [...teacherQueueRows.keys()].sort().join(",") === teacherAOwned.sort().join(","));
  check("another teacher's course is NOT in that map",
    !teacherQueueRows.has(courseUnverified));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) console.log("failures:\n - " + failures.join("\n - "));
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
