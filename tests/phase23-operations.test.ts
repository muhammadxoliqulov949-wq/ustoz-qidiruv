/* -------------------------------------------------------------------------- */
/* Phase 23 operations suite.                                                   */
/*                                                                              */
/* Uses the committed migrations and a real PGlite PostgreSQL engine. It focuses */
/* on the new operational seams: support authorization/transitions/pagination,  */
/* in-app notifications, guarded course visibility/lifecycle, account security,  */
/* cleanup bounds and health response hygiene.                                  */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-phase23-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, condition: boolean): void {
  if (condition) pass += 1;
  else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL: ${name}`);
  }
}
async function main(): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const raw = new PGlite(DATA_DIR);
  for (const file of readdirSync(path.join(process.cwd(), "drizzle")).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(process.cwd(), "drizzle", file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await raw.exec(statement.trim());
    }
  }
  await raw.close();

  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId, hashToken, newSessionToken } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const { authenticatePhone } = await import("../src/server/auth/credentials");
  const { createSupportTicket, countSupportTickets, getSupportQueueCounts, listSupportTickets, transitionSupportTicket } = await import("../src/server/support-service");
  const { listNotifications } = await import("../src/server/notification-service");
  const { changePassword, deactivateAccount, listAdminAccounts } = await import("../src/server/account-service");
  const { transitionOwnedCourse } = await import("../src/server/course-lifecycle-service");
  const { listPublicCourses, getPublicTeacherById, getPublicTeacherBySlug } = await import("../src/server/public-repo");
  const { defaultBrowseParams } = await import("../src/lib/course-search");
  const { pruneExpiredSessions } = await import("../src/server/auth/session");
  const live = await import("../src/app/api/health/live/route");
  const ready = await import("../src/app/api/health/ready/route");
  const db = getDb();
  const password = await hashPassword("phase23-current-password");

  const adminId = newId("usr");
  const studentId = newId("usr");
  const teacherId = newId("usr");
  const deactivationTeacherId = newId("usr");
  await db.insert(schema.users).values([
    { id: adminId, role: "admin", email: "ops@example.uz", passwordHash: password },
    { id: studentId, role: "student", phone: "+998901112233", passwordHash: password },
    { id: teacherId, role: "teacher", phone: "+998901112244", passwordHash: password },
    { id: deactivationTeacherId, role: "teacher", phone: "+998901112255", passwordHash: password },
  ]);
  await db.insert(schema.studentProfiles).values({ userId: studentId, role: "student", name: "Phase Student" });
  await db.insert(schema.teacherProfiles).values([
    { userId: teacherId, role: "teacher", slug: "phase-teacher", name: "Phase Teacher", verification: "verified", isPublic: true },
    { userId: deactivationTeacherId, role: "teacher", slug: "phase-deactivate-teacher", name: "Hidden Teacher", verification: "verified", isPublic: true },
  ]);

  console.log("\n# support/report queue");
  const created = await createSupportTicket({
    reporterUserId: studentId,
    category: "technical",
    message: "Texnik muammo bo‘yicha tekshiruv kerak.",
    relatedEntityType: null,
    relatedEntityId: null,
  });
  check("authenticated support ticket is created", created.ok);
  const ticketId = created.ok ? created.data?.ticketId ?? "" : "";
  check("active admin receives an in-app support submission notification", (await listNotifications(adminId)).some((n) => n.type === "support_submitted"));
  check("teacher cannot transition a support ticket", !(await transitionSupportTicket({ ticketId, status: "in_progress", adminUserId: teacherId })).ok);
  check("admin transitions support ticket", (await transitionSupportTicket({ ticketId, status: "in_progress", adminUserId: adminId })).ok);
  const repeatedSupport = await transitionSupportTicket({ ticketId, status: "in_progress", adminUserId: adminId });
  check("same support transition is idempotent", repeatedSupport.ok && repeatedSupport.data?.idempotent === true);
  check("reporter receives a status notification", (await listNotifications(studentId)).some((n) => n.type === "support_status_changed"));
  check("resolved transition works", (await transitionSupportTicket({ ticketId, status: "resolved", adminUserId: adminId })).ok);
  check("closed transition works", (await transitionSupportTicket({ ticketId, status: "closed", adminUserId: adminId })).ok);
  check("closed ticket cannot be reopened", !(await transitionSupportTicket({ ticketId, status: "open", adminUserId: adminId })).ok);
  check("live queue count excludes closed ticket", (await getSupportQueueCounts()).live === 0);

  const second = await createSupportTicket({ reporterUserId: studentId, category: "account", message: "Ikkinchi murojaat uchun test yozuvi.", relatedEntityType: "account", relatedEntityId: studentId });
  const third = await createSupportTicket({ reporterUserId: studentId, category: "payment", message: "Uchinchi murojaat uchun test yozuvi.", relatedEntityType: "payment", relatedEntityId: "pay-phase23" });
  check("multiple tickets are accepted", second.ok && third.ok);
  check("support count is factual", (await countSupportTickets({ status: "all" })) === 3);
  check("support list is bounded/paginated", (await listSupportTickets({ status: "all", limit: 2, offset: 1 })).length === 2);
  const adminTicketRows = await listSupportTickets({ status: "all", limit: 10 });
  check("support admin projection excludes password hashes", adminTicketRows.every((row) => !("passwordHash" in row) && !("sessionToken" in row)));
  check("notifications are bounded and paginated", (await listNotifications(adminId, { limit: 1, offset: 1 })).length === 1);

  console.log("\n# course lifecycle and visibility");
  const courseId = newId("crs");
  await db.insert(schema.courses).values({
    id: courseId, slug: "phase23-course", teacherUserId: teacherId, title: "Phase yigirma uch kursi",
    categoryId: "english", level: "orta", format: "online", priceUzs: 0, summary: "Phase 23 visibility course summary.",
    status: "published", publishedAt: "2026-09-16",
  });
  const deactivatedCourseId = newId("crs");
  await db.insert(schema.courses).values({
    id: deactivatedCourseId, slug: "phase23-hidden-course", teacherUserId: deactivationTeacherId, title: "Hidden phase course",
    categoryId: "english", level: "orta", format: "online", priceUzs: 0, summary: "Hidden course summary for account lifecycle.",
    status: "published", publishedAt: "2026-09-16",
  });
  check("teacher pauses a published course", (await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "pause" })).ok);
  const repeatedPause = await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "pause" });
  check("paused lifecycle retry is idempotent", repeatedPause.ok && repeatedPause.data?.idempotent === true);
  check("teacher resumes only a verified course", (await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "resume" })).ok);
  check("teacher pauses again before terminal archival", (await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "pause" })).ok);
  check("teacher can archive a paused listing", (await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "archive" })).ok);
  check("archived course cannot be resumed", !(await transitionOwnedCourse({ courseId, teacherUserId: teacherId, action: "resume" })).ok);
  check("archived rows are retained", (await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)))[0]?.status === "archived");

  const visibleBefore = await listPublicCourses(defaultBrowseParams);
  check("archived course is not public", !visibleBefore.some((course) => course.slug === "phase23-course"));

  console.log("\n# account security and deactivation");
  const changed = await changePassword({ userId: studentId, currentPassword: "phase23-current-password", newPassword: "phase23-new-password" });
  check("password change verifies and updates hash", changed.ok);
  check("new password authenticates", (await authenticatePhone("+998901112233", "phase23-new-password")).ok);
  check("old password no longer authenticates", !(await authenticatePhone("+998901112233", "phase23-current-password")).ok);
  const sessionToken = newSessionToken();
  await db.insert(schema.sessions).values({ id: newId("ses"), tokenHash: hashToken(sessionToken), userId: deactivationTeacherId, expiresAt: new Date(Date.now() + 60_000) });
  check("account deactivation preserves business rows and hides teacher", (await deactivateAccount({ userId: deactivationTeacherId, password: "phase23-current-password" })).ok);
  check("deactivated account cannot authenticate", !(await authenticatePhone("+998901112255", "phase23-current-password")).ok);
  check("deactivated teacher course remains retained", (await db.select().from(schema.courses).where(eq(schema.courses.id, deactivatedCourseId))).length === 1);
  check("deactivated teacher profile is hidden", (await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, deactivationTeacherId)))[0]?.isPublic === false);
  check("deactivation revokes sessions", (await db.select().from(schema.sessions).where(eq(schema.sessions.userId, deactivationTeacherId))).length === 0);
  const accounts = await listAdminAccounts({ status: "all", limit: 20 });
  check("admin account list contains no password hash", accounts.every((account) => !("passwordHash" in account) && !("tokenHash" in account)));
  check("deactivated course is not public", !(await listPublicCourses(defaultBrowseParams)).some((course) => course.slug === "phase23-hidden-course"));
  check("deactivated teacher id lookup is hidden", (await getPublicTeacherById(deactivationTeacherId)) === null);
  check("deactivated teacher slug lookup is hidden", (await getPublicTeacherBySlug("phase-deactivate-teacher")) === null);

  console.log("\n# cleanup, health and secret hygiene");
  const expiredSessionId = newId("ses");
  await db.insert(schema.sessions).values({ id: expiredSessionId, tokenHash: hashToken(newSessionToken()), userId: studentId, expiresAt: new Date(Date.now() - 60_000) });
  await pruneExpiredSessions();
  check("expired session cleanup removes only expired session", (await db.select().from(schema.sessions).where(eq(schema.sessions.id, expiredSessionId))).length === 0);
  const liveResponse = live.GET();
  const liveBody = await liveResponse.json();
  check("liveness is 200 and minimal", liveResponse.status === 200 && liveBody.status === "ok");
  const readyResponse = await ready.GET();
  const readyBody = await readyResponse.json();
  check("readiness checks the database", readyResponse.status === 200 && readyBody.status === "ready");
  const healthText = JSON.stringify({ liveBody, readyBody });
  check("health responses contain no database URL or secret", !healthText.includes("postgres") && !healthText.includes("phase23-current-password"));
  const script = readFileSync(path.join(process.cwd(), "scripts/operations.ts"), "utf8");
  check("cleanup script is bounded and supports dry-run", script.includes("--dry-run") && script.includes("limit") && script.includes("inArray"));

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
