/* -------------------------------------------------------------------------- */
/* Phase 11 backend test suite.                                                */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite), in a throwaway data dir, by  */
/* applying the same committed migrations production uses. Constraint tests are */
/* therefore genuine: a "FK rejects this" assertion proves the database rejects */
/* it, not that TypeScript would have.                                          */
/*                                                                              */
/*   npm run test:server                                                        */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-test-"));
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

  const { getDb, schema } = await import("../src/server/db/client");
  const { hashPassword, verifyPassword } = await import("../src/server/auth/password");
  const { hashToken, newSessionToken, newId } = await import("../src/server/auth/ids");
  const { registerSchema, loginSchema, studentProfileSchema, teacherProfileSchema, enrollmentRequestSchema, courseDraftCreateSchema } =
    await import("../src/server/validation");
  const { parseSafeNext } = await import("../src/lib/safe-next");
  const { eq, and, asc } = await import("drizzle-orm");
  const db = getDb();

  /* ------------------------------ passwords ------------------------------- */
  console.log("\n# password hashing");
  const hash1 = await hashPassword("correct horse battery");
  check("argon2id PHC format", hash1.startsWith("$argon2id$"));
  check("hash is not the plaintext", !hash1.includes("correct horse"));
  check("verify accepts correct password", await verifyPassword(hash1, "correct horse battery"));
  check("verify rejects wrong password", !(await verifyPassword(hash1, "wrong")));
  check("verify rejects garbage hash", !(await verifyPassword("not-a-hash", "x")));
  const hash2 = await hashPassword("correct horse battery");
  check("hashes are salted (differ)", hash1 !== hash2);

  /* ------------------------------- sessions -------------------------------- */
  console.log("\n# session tokens");
  const token = newSessionToken();
  check("token is long and random", token.length >= 40);
  check("token hash is sha256 hex", /^[0-9a-f]{64}$/.test(hashToken(token)));
  check("hash is deterministic", hashToken(token) === hashToken(token));
  check("different tokens differ", hashToken(token) !== hashToken(newSessionToken()));

  /* ------------------------------ user schema ------------------------------ */
  console.log("\n# users + role integrity");
  const studentId = newId("usr");
  const teacherId = newId("usr");
  await db.insert(schema.users).values({ id: studentId, role: "student", phone: "+998901112233", passwordHash: hash1 });
  await db.insert(schema.users).values({ id: teacherId, role: "teacher", phone: "+998901112244", passwordHash: hash1 });
  check("users inserted", (await db.select().from(schema.users)).length === 2);

  await rejects("duplicate phone rejected", () =>
    db.insert(schema.users).values({ id: newId("usr"), role: "student", phone: "+998901112233", passwordHash: hash1 }),
  );
  await rejects("malformed phone rejected by CHECK", () =>
    db.insert(schema.users).values({ id: newId("usr"), role: "student", phone: "0901112255", passwordHash: hash1 }),
  );
  await rejects("plaintext password rejected by CHECK", () =>
    db.insert(schema.users).values({ id: newId("usr"), role: "student", phone: "+998901112266", passwordHash: "hunter2" }),
  );

  await db.insert(schema.studentProfiles).values({ userId: studentId, role: "student", name: "Aziza Karimova" });
  await db.insert(schema.teacherProfiles).values({ userId: teacherId, role: "teacher", slug: "dilshod-test", name: "Dilshod Rahimov" });
  check("profiles inserted", (await db.select().from(schema.teacherProfiles)).length === 1);

  await rejects("student profile on teacher-role user rejected (composite FK)", () =>
    db.insert(schema.studentProfiles).values({ userId: teacherId, role: "student", name: "Bad Profile" }),
  );
  await rejects("teacher profile on student-role user rejected (composite FK)", () =>
    db.insert(schema.teacherProfiles).values({ userId: studentId, role: "teacher", slug: "bad-slug", name: "Bad Profile" }),
  );
  await rejects("profile for non-existent user rejected", () =>
    db.insert(schema.studentProfiles).values({ userId: "usr-ghost", role: "student", name: "Ghost User" }),
  );
  await rejects("duplicate teacher slug rejected", () =>
    db.insert(schema.teacherProfiles).values({ userId: newId("usr"), role: "teacher", slug: "dilshod-test", name: "Other Name" }),
  );
  const teacherRow = (await db.select().from(schema.teacherProfiles))[0];
  check("teacher defaults to UNVERIFIED", teacherRow.verification === "unverified");
  check("onboarding defaults to incomplete", teacherRow.onboardingCompleted === false);

  /* -------------------------------- courses -------------------------------- */
  console.log("\n# courses + groups");
  const courseId = newId("crs");
  await db.insert(schema.courses).values({
    id: courseId, slug: "test-ielts-kursi", teacherUserId: teacherId,
    title: "IELTS tayyorlov kursi", categoryId: "ielts", level: "yuqori",
    format: "online", city: null, location: null, priceUzs: 500000, summary: "S".repeat(60),
  });
  check("course inserted", (await db.select().from(schema.courses)).length === 1);

  await rejects("course for non-existent teacher rejected", () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "ghost-kursi", teacherUserId: "usr-ghost",
      title: "Ghost kursi bor", categoryId: "ielts", level: "orta", format: "online", priceUzs: 0, summary: "S".repeat(60),
    }),
  );
  await rejects("online course with a city rejected by CHECK", () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "bad-online-kursi", teacherUserId: teacherId,
      title: "Bad online kursi", categoryId: "ielts", level: "orta",
      format: "online", city: "toshkent", priceUzs: 0, summary: "S".repeat(60),
    }),
  );
  await rejects("offline course without a city rejected by CHECK", () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "bad-offline-kursi", teacherUserId: teacherId,
      title: "Bad offline kursi", categoryId: "ielts", level: "orta",
      format: "offline", city: null, priceUzs: 0, summary: "S".repeat(60),
    }),
  );
  await rejects("negative price rejected", () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "negative-narx-kursi", teacherUserId: teacherId,
      title: "Negative narx kursi", categoryId: "ielts", level: "orta", format: "online", priceUzs: -1, summary: "S".repeat(60),
    }),
  );
  await rejects("duplicate course slug rejected", () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "test-ielts-kursi", teacherUserId: teacherId,
      title: "Duplicate slug kursi", categoryId: "ielts", level: "orta", format: "online", priceUzs: 0, summary: "S".repeat(60),
    }),
  );

  const groupId = newId("grp");
  await db.insert(schema.courseGroups).values({
    id: groupId, courseId, title: "A guruhi", days: ["Du", "Chor"], startTime: "18:00", capacity: 12, startDate: "2026-10-05",
  });
  check("group inserted", (await db.select().from(schema.courseGroups)).length === 1);
  check("no occupied-seat column exists", !("seatsRemaining" in (await db.select().from(schema.courseGroups))[0]));
  await rejects("group for non-existent course rejected", () =>
    db.insert(schema.courseGroups).values({
      id: newId("grp"), courseId: "crs-ghost", title: "Ghost", days: ["Du"], startTime: "10:00", capacity: 5, startDate: "2026-10-05",
    }),
  );
  await rejects("invalid time format rejected", () =>
    db.insert(schema.courseGroups).values({
      id: newId("grp"), courseId, title: "Bad", days: ["Du"], startTime: "25:99", capacity: 5, startDate: "2026-10-05",
    }),
  );
  await rejects("zero-day group rejected", () =>
    db.insert(schema.courseGroups).values({
      id: newId("grp"), courseId, title: "Bad", days: [], startTime: "10:00", capacity: 5, startDate: "2026-10-05",
    }),
  );

  /* ------------------------------ enrollments ------------------------------ */
  console.log("\n# enrollment integrity");
  const otherCourseId = newId("crs");
  await db.insert(schema.courses).values({
    id: otherCourseId, slug: "boshqa-test-kursi", teacherUserId: teacherId,
    title: "Boshqa test kursi", categoryId: "english", level: "orta", format: "online", priceUzs: 0, summary: "S".repeat(60),
  });

  await db.insert(schema.enrollmentRequests).values({
    id: newId("enr"), studentUserId: studentId, courseId, groupId, note: "Salom",
  });
  check("enrollment inserted", (await db.select().from(schema.enrollmentRequests)).length === 1);
  check(
    "enrollment defaults to submitted",
    (await db.select().from(schema.enrollmentRequests))[0].status === "submitted",
  );
  await rejects("group belonging to another course rejected (composite FK)", () =>
    db.insert(schema.enrollmentRequests).values({
      id: newId("enr"), studentUserId: studentId, courseId: otherCourseId, groupId,
    }),
  );
  await rejects("enrollment by non-student rejected", () =>
    db.insert(schema.enrollmentRequests).values({
      id: newId("enr"), studentUserId: teacherId, courseId, groupId,
    }),
  );
  await rejects("duplicate live request rejected (UNIQUE)", () =>
    db.insert(schema.enrollmentRequests).values({
      id: newId("enr"), studentUserId: studentId, courseId, groupId,
    }),
  );
  const statusValues = await db.execute(
    "SELECT unnest(enum_range(NULL::enrollment_status))::text AS v" as never,
  );
  const values = JSON.stringify(statusValues);
  // PHASE 13: the enum is exactly the four statuses the product implements.
  // `rejected` is now real; `paid`/`completed`/`waitlisted` must NEVER appear,
  // because nothing in the product can put a request into such a state.
  check("enum contains the four implemented statuses",
    ["submitted", "accepted", "rejected", "cancelled"].every((v) => values.includes(v)));
  check("no unimplemented payment or lifecycle status in the DB enum",
    !/paid|completed|refunded|expired|waitlisted|confirmed/.test(values));

  /* -------------------------- repo scoping (IDOR) -------------------------- */
  console.log("\n# repository scoping / IDOR");
  const { getTeacherCourses, getStudentEnrollmentRequests, getOwnedCourse } = await import("../src/server/repo");
  const otherTeacherId = newId("usr");
  await db.insert(schema.users).values({ id: otherTeacherId, role: "teacher", phone: "+998901119999", passwordHash: hash1 });
  await db.insert(schema.teacherProfiles).values({ userId: otherTeacherId, role: "teacher", slug: "boshqa-ustoz", name: "Boshqa Ustoz" });

  check("teacher sees only own courses", (await getTeacherCourses(teacherId)).length === 2);
  check("other teacher sees none", (await getTeacherCourses(otherTeacherId)).length === 0);
  check("owned course lookup works", (await getOwnedCourse(courseId, teacherId)) !== null);
  check("cross-teacher course lookup returns null (IDOR blocked)", (await getOwnedCourse(courseId, otherTeacherId)) === null);

  const otherStudentId = newId("usr");
  await db.insert(schema.users).values({ id: otherStudentId, role: "student", phone: "+998901118888", passwordHash: hash1 });
  await db.insert(schema.studentProfiles).values({ userId: otherStudentId, role: "student", name: "Boshqa Oquvchi" });
  check("student sees own requests", (await getStudentEnrollmentRequests(studentId)).length === 1);
  check("other student sees none (IDOR blocked)", (await getStudentEnrollmentRequests(otherStudentId)).length === 0);

  /* ------------------------------- validation ------------------------------ */
  console.log("\n# input validation");
  check("valid registration accepted", registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "+998 90 111 22 33", password: "supersecret",
  }).success);
  const normalized = registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "90 111 22 33", password: "supersecret",
  });
  check("phone normalised to +998XXXXXXXXX", normalized.success && normalized.data.phone === "+998901112233");
  check("invalid phone rejected", !registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "123", password: "supersecret",
  }).success);
  check("bad operator prefix rejected", !registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "+998 11 111 22 33", password: "supersecret",
  }).success);
  check("invalid role rejected", !registerSchema.safeParse({
    role: "admin", name: "Aziza Karimova", phone: "+998901112233", password: "supersecret",
  }).success);
  check("short password rejected", !registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "+998901112233", password: "short",
  }).success);
  check("OVER-POSTED field rejected (mass assignment)", !registerSchema.safeParse({
    role: "student", name: "Aziza Karimova", phone: "+998901112233", password: "supersecret", userId: "usr-victim",
  }).success);
  check("over-posted verification rejected", !teacherProfileSchema.safeParse({
    name: "Dilshod Rahimov", city: null, district: "", categories: [], levels: [], formats: [],
    languages: [], experienceYears: 5, bio: "", approach: "", onboardingCompleted: true, verification: "verified",
  }).success);
  check("over-posted role on student profile rejected", !studentProfileSchema.safeParse({
    name: "Aziza Karimova", city: null, preferredFormat: null, languages: [], interests: [],
    onboardingCompleted: true, role: "teacher",
  }).success);
  check("unknown city rejected", !studentProfileSchema.safeParse({
    name: "Aziza Karimova", city: "atlantis", preferredFormat: null, languages: [], interests: [], onboardingCompleted: true,
  }).success);
  check("unknown language rejected", !studentProfileSchema.safeParse({
    name: "Aziza Karimova", city: null, preferredFormat: null, languages: ["KL"], interests: [], onboardingCompleted: true,
  }).success);
  check("malformed id rejected", !enrollmentRequestSchema.safeParse({
    courseId: "../../etc/passwd", groupId: "g-1", note: "",
  }).success);
  check("online course with city rejected by schema too", !courseDraftCreateSchema.safeParse({
    title: "IELTS tayyorlov kursi", categoryId: "ielts", level: "orta", format: "online",
    city: "toshkent", location: null, priceUzs: 0, summary: "S".repeat(60),
  }).success);
  check("login schema accepts credentials", loginSchema.safeParse({ phone: "+998901112233", password: "x" }).success);

  /* -------------------------------- security ------------------------------- */
  console.log("\n# security regressions");
  check("open redirect //evil.com blocked", parseSafeNext("//evil.com") === null);
  check("open redirect scheme blocked", parseSafeNext("https://evil.com") === null);
  check("backslash redirect blocked", parseSafeNext("/\\evil.com") === null);
  check("credential redirect blocked", parseSafeNext("/x@evil.com") === null);
  check("internal path allowed", parseSafeNext("/dashboard/saved") === "/dashboard/saved");

  // SQL injection through the ORM's parameter binding.
  const injection = "'; DROP TABLE users; --";
  const injected = await db.select().from(schema.users).where(eq(schema.users.phone, injection));
  check("SQL injection string is parameterised (no rows, no error)", injected.length === 0);
  check("users table still exists after injection attempt", (await db.select().from(schema.users)).length === 4);

  // Stored XSS payloads must round-trip as INERT TEXT (React escapes at render).
  const xss = "<script>alert('xss')</script>";
  await db.update(schema.teacherProfiles).set({ bio: xss }).where(eq(schema.teacherProfiles.userId, teacherId));
  const bioRow = (await db.select({ bio: schema.teacherProfiles.bio }).from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherId)))[0];
  check("XSS payload stored verbatim as data (escaped at render)", bioRow.bio === xss);

  // Private fields must not be in the public-facing teacher projection.
  const publicTeacher = await db
    .select({ slug: schema.teacherProfiles.slug, name: schema.teacherProfiles.name, bio: schema.teacherProfiles.bio })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, teacherId));
  check("public teacher projection has no phone", !("phone" in publicTeacher[0]));
  check("public teacher projection has no passwordHash", !("passwordHash" in publicTeacher[0]));

  // Session rows never contain the raw token.
  const sessionId = newId("ses");
  const liveToken = newSessionToken();
  await db.insert(schema.sessions).values({
    id: sessionId, tokenHash: hashToken(liveToken), userId: studentId,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const sessionRow = (await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)))[0];
  check("session stores only a hash, never the token", sessionRow.tokenHash !== liveToken && sessionRow.tokenHash.length === 64);
  const expiredLookup = await db.select().from(schema.sessions).where(
    and(eq(schema.sessions.tokenHash, hashToken("nonexistent-token")), eq(schema.sessions.userId, studentId)),
  );
  check("unknown token resolves to no session", expiredLookup.length === 0);

  // Deleting a user must cascade its sessions (no orphaned credentials).
  await db.delete(schema.users).where(eq(schema.users.id, otherStudentId));
  check("user delete cascades cleanly", (await db.select().from(schema.users)).length === 3);


  /* ====================================================================== */
  /* PHASE 12 — public marketplace queries, ownership, ordering, lifecycle. */
  /* ====================================================================== */

  const {
    listPublicCourses, getPublicCourseBySlug, listPublicTeachers,
    getPublicTeacherBySlug,
  } = await import("../src/server/public-repo");
  const { getTeacherDashboardCourses, getOwnedCourseDetail } =
    await import("../src/server/repo");
  const { parseCourseBrowseParams } = await import("../src/lib/course-search");
  const { courseGroupSchema, syllabusModuleSchema, courseDraftUpdateSchema } =
    await import("../src/server/validation");

  const browseAll = parseCourseBrowseParams({});

  // The test course created above is still `draft` / teacher not public.
  check("draft course is absent from the public listing",
    (await listPublicCourses(browseAll)).every((c) => c.id !== courseId));
  check("draft course slug lookup returns null (not merely hidden)",
    (await getPublicCourseBySlug("test-ielts-kursi")) === null);
  // The old "draft slug is absent from generateStaticParams input" check is
  // obsolete by design: build-time slug enumeration no longer exists (no
  // generateStaticParams on the detail routes), so there is no build-time
  // param set a draft could leak into. The invariant it protected — a draft
  // slug never resolves to a public page — is now held entirely at request
  // time and asserted above (null lookup → 404).

  // Publish it and make the owner public — then it must appear everywhere.
  await db.update(schema.teacherProfiles)
    .set({ isPublic: true }).where(eq(schema.teacherProfiles.userId, teacherId));
  await db.update(schema.courses)
    .set({ status: "published", publishedAt: "2026-03-01" })
    .where(eq(schema.courses.id, courseId));

  const publicList = await listPublicCourses(browseAll);
  check("published course appears in the public listing",
    publicList.some((c) => c.id === courseId));
  const publicDetail = await getPublicCourseBySlug("test-ielts-kursi");
  check("published course resolves by slug", publicDetail !== null);
  check("projected course carries its teacher identity",
    publicDetail?.teacher.id === teacherId);
  check("projected course carries its groups",
    (publicDetail?.detail.groups.length ?? 0) >= 1);

  // Availability is DERIVED, never stored. PHASE 13: occupancy counts ACCEPTED
  // requests only. The request inserted earlier is still `submitted`, so it
  // occupies nothing and all 12 seats must still read as free.
  const seatGroup = publicDetail?.detail.groups.find((g) => g.id === groupId);
  check("a submitted request does not consume a public seat",
    seatGroup?.capacity === 12 && seatGroup?.seatsRemaining === 12);

  // SQL-level facet filtering.
  check("price=free filter excludes a paid course",
    (await listPublicCourses(parseCourseBrowseParams({ price: "free" })))
      .every((c) => c.priceUzs === 0));
  check("category filter restricts results",
    (await listPublicCourses(browseAll, { categoryId: "nonexistent" })).length === 0);

  // Teacher directory.
  const teacherRows = await listPublicTeachers();
  check("public teacher directory includes a teacher with a published course",
    teacherRows.some((r) => r.teacher.id === teacherId));
  check("teacher facets are derived from owned published courses",
    (teacherRows.find((r) => r.teacher.id === teacherId)?.courseIds ?? []).includes(courseId));
  check("seeded/registered teachers are not fabricated as verified",
    teacherRows.every((r) => r.teacher.verified === false));

  const teacherSlugRow = (await db.select({ slug: schema.teacherProfiles.slug })
    .from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, teacherId)))[0];
  const profile = await getPublicTeacherBySlug(teacherSlugRow.slug);
  check("teacher profile resolves by slug", profile !== null);
  check("teacher profile lists only owned published courses",
    profile?.courses.every((c) => c.teacher.id === teacherId) === true);
  check("unknown teacher slug returns null",
    (await getPublicTeacherBySlug("no-such-teacher")) === null);

  // A private draft owned by the SAME teacher must not leak into the profile.
  const hiddenId = newId("crs");
  await db.insert(schema.courses).values({
    id: hiddenId, slug: "maxfiy-qoralama", teacherUserId: teacherId,
    title: "Maxfiy qoralama kursi", categoryId: "ielts", level: "orta",
    format: "online", priceUzs: 0, summary: "x".repeat(50), status: "draft",
  });
  check("a teacher's own draft does not leak into their public profile",
    (await getPublicTeacherBySlug(teacherSlugRow.slug))?.courses
      .every((c) => c.id !== hiddenId) === true);
  check("a teacher's own draft does not leak into the public listing",
    (await listPublicCourses(browseAll)).every((c) => c.id !== hiddenId));

  // Dashboard split: the owner DOES see both, partitioned by status.
  const dash = await getTeacherDashboardCourses(teacherId);
  check("dashboard shows the owner's published course",
    dash.published.some((c) => c.id === courseId));
  check("dashboard shows the owner's draft separately",
    dash.drafts.some((c) => c.id === hiddenId));
  check("dashboard of another teacher is empty (no cross-teacher read)",
    (await getTeacherDashboardCourses(otherTeacherId)).published.length === 0);
  check("owned course detail is readable by the owner",
    (await getOwnedCourseDetail(hiddenId, teacherId)) !== null);
  check("owned course detail is null for a different teacher (IDOR blocked)",
    (await getOwnedCourseDetail(hiddenId, otherTeacherId)) === null);

  // Syllabus ordering: positions are unique per course and swap correctly.
  const m1 = newId("mod"), m2 = newId("mod"), m3 = newId("mod");
  await db.insert(schema.syllabusModules).values([
    { id: m1, courseId: hiddenId, position: 1, title: "Birinchi", lessons: 3 },
    { id: m2, courseId: hiddenId, position: 2, title: "Ikkinchi", lessons: 4 },
    { id: m3, courseId: hiddenId, position: 3, title: "Uchinchi", lessons: 5 },
  ]);
  await rejects("duplicate syllabus position is rejected by the database", async () =>
    db.insert(schema.syllabusModules).values({
      id: newId("mod"), courseId: hiddenId, position: 1, title: "Takror", lessons: 1,
    }));

  // Swap 1 and 2 through the park-on-a-free-slot routine the action uses.
  await db.transaction(async (tx) => {
    // Park above the maximum: position is UNIQUE per course and CHECKed >= 1.
    await tx.update(schema.syllabusModules).set({ position: 4 })
      .where(eq(schema.syllabusModules.id, m1));
    await tx.update(schema.syllabusModules).set({ position: 1 })
      .where(eq(schema.syllabusModules.id, m2));
    await tx.update(schema.syllabusModules).set({ position: 2 })
      .where(eq(schema.syllabusModules.id, m1));
  });
  const ordered = await db.select({ id: schema.syllabusModules.id })
    .from(schema.syllabusModules)
    .where(eq(schema.syllabusModules.courseId, hiddenId))
    .orderBy(asc(schema.syllabusModules.position));
  check("syllabus reorder swaps exactly two positions",
    ordered[0].id === m2 && ordered[1].id === m1 && ordered[2].id === m3);

  // Transaction rollback: a failing multi-row write leaves NOTHING behind.
  const rollbackId = newId("crs");
  await rejects("a failing multi-row course write rolls back", async () =>
    db.transaction(async (tx) => {
      await tx.insert(schema.courses).values({
        id: rollbackId, slug: "rollback-kursi", teacherUserId: teacherId,
        title: "Rollback kursi", categoryId: "ielts", level: "orta",
        format: "online", priceUzs: 0, summary: "y".repeat(50), status: "draft",
      });
      // Violates the FK on purpose.
      await tx.insert(schema.courseGroups).values({
        id: newId("grp"), courseId: "crs-does-not-exist", title: "X",
        days: ["Du"], startTime: "10:00", capacity: 5, startDate: "2026-11-01",
      });
    }));
  check("rolled-back course left no partial row",
    (await db.select().from(schema.courses).where(eq(schema.courses.id, rollbackId))).length === 0);

  // Slug uniqueness is enforced by the database, not by application hope.
  await rejects("duplicate course slug is rejected", async () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "maxfiy-qoralama", teacherUserId: teacherId,
      title: "Takroriy slug kursi", categoryId: "ielts", level: "orta",
      format: "online", priceUzs: 0, summary: "z".repeat(50), status: "draft",
    }));

  // A published course must carry a publication date (lifecycle integrity).
  await rejects("publishing without a date is rejected", async () =>
    db.insert(schema.courses).values({
      id: newId("crs"), slug: "sanasiz-kurs", teacherUserId: teacherId,
      title: "Sanasiz kurs", categoryId: "ielts", level: "orta",
      format: "online", priceUzs: 0, summary: "q".repeat(50), status: "published",
    }));

  // Validation: over-posting and occupancy injection are refused.
  check("group schema rejects a posted seatsRemaining (over-posting)",
    !courseGroupSchema.safeParse({
      courseId, title: "A", days: ["Du"], startTime: "10:00", endTime: "12:00",
      startDate: "2026-11-01", capacity: 10, seatsRemaining: 99,
    }).success);
  check("group schema rejects an end time before the start time",
    !courseGroupSchema.safeParse({
      courseId, title: "A", days: ["Du"], startTime: "12:00", endTime: "10:00",
      startDate: "2026-11-01", capacity: 10,
    }).success);
  check("syllabus schema rejects a client-supplied position",
    !syllabusModuleSchema.safeParse({
      courseId, title: "Modul", description: "", lessons: 3, position: 1,
    }).success);
  check("course update schema rejects a client-supplied status",
    !courseDraftUpdateSchema.safeParse({
      title: "Yetarli uzunlikdagi nom", categoryId: "ielts", level: "orta",
      format: "online", city: null, location: null, priceUzs: 0,
      summary: "s".repeat(50), longDescription: "", status: "published",
    }).success);
  check("course update schema rejects a client-supplied teacher id",
    !courseDraftUpdateSchema.safeParse({
      title: "Yetarli uzunlikdagi nom", categoryId: "ielts", level: "orta",
      format: "online", city: null, location: null, priceUzs: 0,
      summary: "s".repeat(50), longDescription: "", teacherUserId: otherTeacherId,
    }).success);

  // Stored XSS stays inert: the value round-trips as DATA, never as markup.
  const xssId = newId("crs");
  const payload = "<script>alert('xss')</script>";
  await db.insert(schema.courses).values({
    id: xssId, slug: "xss-tekshiruvi", teacherUserId: teacherId,
    title: `Zararli ${payload} kursi`, categoryId: "ielts", level: "orta",
    format: "online", priceUzs: 0, summary: "w".repeat(50), status: "draft",
  });
  const xssRow = (await db.select().from(schema.courses).where(eq(schema.courses.id, xssId)))[0];
  check("stored markup round-trips as literal text (escaped by React at render)",
    xssRow.title.includes(payload));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("failures:\n - " + failures.join("\n - "));
  }
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
