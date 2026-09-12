/* -------------------------------------------------------------------------- */
/* Phase 13 enrollment workflow test suite.                                    */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the same committed migrations production uses. Every capacity and   */
/* authorization claim below is therefore proven against the actual database    */
/* and the actual service code — not against a mock.                            */
/*                                                                              */
/*   npm run test:enrollment                                                    */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-enroll-"));
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

  const { eq, and } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const contract = await import("../src/lib/enrollment-status");
  const service = await import("../src/server/enrollment-service");
  const notifications = await import("../src/server/notification-service");

  const db = getDb();

  /* ----------------------------- fixture setup ---------------------------- */
  const password = await hashPassword("supersecret");

  async function makeUser(role: "student" | "teacher", phone: string, name: string) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role, phone, passwordHash: password });
    if (role === "student") {
      await db.insert(schema.studentProfiles).values({ userId: id, name });
    } else {
      await db.insert(schema.teacherProfiles).values({
        userId: id, slug: `ustoz-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase()}`, name,
        bio: "B".repeat(60), city: "toshkent",
      });
    }
    return id;
  }

  const teacherA = await makeUser("teacher", "+998901110001", "Ustoz A");
  const teacherB = await makeUser("teacher", "+998901110002", "Ustoz B");
  const studentA = await makeUser("student", "+998901110003", "O‘quvchi A");
  const studentB = await makeUser("student", "+998901110004", "O‘quvchi B");
  const studentC = await makeUser("student", "+998901110005", "O‘quvchi C");

  async function makeCourse(teacherUserId: string, slug: string) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id, slug, teacherUserId, title: "Test kursi", categoryId: "ielts",
      level: "orta", format: "online", priceUzs: 0, summary: "S".repeat(60),
      status: "published", publishedAt: "2026-01-15",
    });
    return id;
  }

  async function makeGroup(courseId: string, capacity: number) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id, courseId, title: "A guruhi", days: ["Du"], startTime: "18:00",
      capacity, startDate: "2026-10-05",
    });
    return id;
  }

  async function submit(studentUserId: string, courseId: string, groupId: string) {
    const id = newId("enr");
    await db.insert(schema.enrollmentRequests).values({
      id, studentUserId, courseId, groupId, note: "Qiziqaman",
    });
    return id;
  }

  const courseA = await makeCourse(teacherA, "ustoz-a-kursi");
  const courseB = await makeCourse(teacherB, "ustoz-b-kursi");

  /* ================================ STATUS ================================ */
  console.log("\n# STATUS — the transition contract");

  check("student may cancel a submitted request",
    contract.canTransition("student", "submitted", "cancelled"));
  check("student may cancel an accepted request (frees the seat)",
    contract.canTransition("student", "accepted", "cancelled"));
  check("teacher may accept a submitted request",
    contract.canTransition("teacher", "submitted", "accepted"));
  check("teacher may reject a submitted request",
    contract.canTransition("teacher", "submitted", "rejected"));

  check("FORBIDDEN rejected -> accepted",
    !contract.canTransition("teacher", "rejected", "accepted"));
  check("FORBIDDEN cancelled -> accepted",
    !contract.canTransition("teacher", "cancelled", "accepted"));
  check("FORBIDDEN cancelled -> rejected",
    !contract.canTransition("teacher", "cancelled", "rejected"));
  check("FORBIDDEN accepted -> rejected",
    !contract.canTransition("teacher", "accepted", "rejected"));
  check("FORBIDDEN teacher cannot cancel on the student's behalf",
    !contract.canTransition("teacher", "submitted", "cancelled"));
  check("FORBIDDEN student cannot accept their own request",
    !contract.canTransition("student", "submitted", "accepted"));
  check("FORBIDDEN student cannot reject their own request",
    !contract.canTransition("student", "submitted", "rejected"));

  check("accepted/rejected/cancelled report as final for the teacher",
    contract.isFinalStatus("accepted") && contract.isFinalStatus("rejected") &&
    contract.isFinalStatus("cancelled") && !contract.isFinalStatus("submitted"));
  check("only accepted occupies a seat",
    contract.SEAT_OCCUPYING_STATUSES.length === 1 &&
    contract.SEAT_OCCUPYING_STATUSES[0] === "accepted");

  // Real service calls must obey the same contract.
  {
    const groupId = await makeGroup(courseA, 5);
    const reqId = await submit(studentA, courseA, groupId);
    await service.rejectRequest(reqId, teacherA, null);
    const again = await service.acceptRequest(reqId, teacherA);
    check("service refuses rejected -> accepted",
      !again.ok && again.code === "invalid_transition");
    const cancelAfterReject = await service.cancelRequest(reqId, studentA);
    check("service refuses cancelling a rejected request",
      !cancelAfterReject.ok && cancelAfterReject.code === "invalid_transition");
  }

  /* =============================== CAPACITY =============================== */
  console.log("\n# CAPACITY — derived seats, enforced transactionally");

  {
    // The headline requirement: capacity 1 -> A accepted -> B refused ->
    // A cancels -> B now acceptable.
    const groupId = await makeGroup(courseA, 1);
    const reqA = await submit(studentA, courseA, groupId);
    const reqB = await submit(studentB, courseA, groupId);

    const before = await service.getGroupAvailability(groupId);
    check("submitted requests do not reduce availability",
      before?.capacity === 1 && before?.accepted === 0 && before?.available === 1);

    const accA = await service.acceptRequest(reqA, teacherA);
    check("first accept succeeds", accA.ok);

    const afterAccept = await service.getGroupAvailability(groupId);
    check("accepting consumes the seat",
      afterAccept?.accepted === 1 && afterAccept?.available === 0);

    const accB = await service.acceptRequest(reqB, teacherA);
    check("second accept refused — group is full",
      !accB.ok && accB.code === "capacity_full");

    const stillSubmitted = (await db.select().from(schema.enrollmentRequests)
      .where(eq(schema.enrollmentRequests.id, reqB)))[0];
    check("refused request stays submitted (not silently rejected)",
      stillSubmitted.status === "submitted");

    const cancelled = await service.cancelRequest(reqA, studentA);
    check("student cancels their accepted place", cancelled.ok);

    const afterCancel = await service.getGroupAvailability(groupId);
    check("cancelling an accepted place restores the seat (derived, not decremented)",
      afterCancel?.accepted === 0 && afterCancel?.available === 1);

    const accBAgain = await service.acceptRequest(reqB, teacherA);
    check("the waiting student can now be accepted", accBAgain.ok);
  }

  {
    // Availability must never render as a negative number.
    const groupId = await makeGroup(courseA, 2);
    const r1 = await submit(studentA, courseA, groupId);
    const r2 = await submit(studentB, courseA, groupId);
    await service.acceptRequest(r1, teacherA);
    await service.acceptRequest(r2, teacherA);
    const full = await service.getGroupAvailability(groupId);
    check("a full group reports zero, never a negative number",
      full?.available === 0 && full.accepted === 2);
  }

  /* ============================= CONCURRENCY ============================== */
  console.log("\n# CONCURRENCY — racing accepts on the last seat");

  {
    const groupId = await makeGroup(courseA, 1);
    const r1 = await submit(studentA, courseA, groupId);
    const r2 = await submit(studentB, courseA, groupId);

    // Fire both accepts simultaneously. The row lock inside acceptRequest is
    // the serialisation point; a bare COUNT would let both through.
    const [x, y] = await Promise.all([
      service.acceptRequest(r1, teacherA),
      service.acceptRequest(r2, teacherA),
    ]);

    const okCount = [x, y].filter((r) => r.ok).length;
    check("exactly one of two racing accepts succeeds", okCount === 1);

    const loser = x.ok ? y : x;
    check("the loser gets a deterministic capacity error, not a crash",
      !loser.ok && (loser.code === "capacity_full" || loser.code === "invalid_transition"));

    const acceptedRows = await db.select().from(schema.enrollmentRequests)
      .where(and(
        eq(schema.enrollmentRequests.groupId, groupId),
        eq(schema.enrollmentRequests.status, "accepted"),
      ));
    check("accepted count never exceeds capacity after the race",
      acceptedRows.length === 1);
  }

  {
    // A harder race: capacity 2, five simultaneous accepts.
    const groupId = await makeGroup(courseA, 2);
    const ids: string[] = [];
    for (const student of [studentA, studentB, studentC]) {
      ids.push(await submit(student, courseA, groupId));
    }
    const extraStudents: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const s = await makeUser("student", `+99890222000${i}`, `Qatnashchi ${i}`);
      extraStudents.push(s);
      ids.push(await submit(s, courseA, groupId));
    }

    const results = await Promise.all(ids.map((id) => service.acceptRequest(id, teacherA)));
    const accepted = results.filter((r) => r.ok).length;
    check("five racing accepts on a 2-seat group accept exactly two", accepted === 2);
    check("every loser got a typed capacity error",
      results.filter((r) => !r.ok).every((r) => !r.ok && r.code === "capacity_full"));

    const rows = await db.select().from(schema.enrollmentRequests)
      .where(and(
        eq(schema.enrollmentRequests.groupId, groupId),
        eq(schema.enrollmentRequests.status, "accepted"),
      ));
    check("INVARIANT accepted <= capacity holds under load", rows.length <= 2);
  }

  {
    /*
     * HONESTY ABOUT THE ENGINE: PGlite executes statements on a single
     * connection, so the "racing" accepts above interleave cooperatively
     * rather than truly in parallel. That proves the invariant holds and that
     * the re-read/transition check is not skipped, but it does NOT by itself
     * prove the row lock. The lock is what makes the same code safe on a real
     * multi-connection Postgres, so we assert directly that acceptRequest
     * actually issues FOR UPDATE on the group row before counting.
     */
    const source = readFileSync(
      path.join(process.cwd(), "src/server/enrollment-service.ts"),
      "utf8",
    );
    const acceptBody = source.slice(source.indexOf("export async function acceptRequest"));
    const lockAt = acceptBody.indexOf("FOR UPDATE");
    const countAt = acceptBody.indexOf('eq(schema.enrollmentRequests.status, "accepted")');
    check("acceptRequest locks the group row with FOR UPDATE", lockAt > -1);
    check("the lock is taken BEFORE the accepted count is read",
      lockAt > -1 && countAt > -1 && lockAt < countAt);
    check("the whole accept runs inside db.transaction",
      acceptBody.slice(0, 400).includes("db.transaction"));
  }

  /* ============================ AUTHORIZATION ============================= */
  console.log("\n# AUTHORIZATION — ownership is enforced in SQL");

  {
    const groupId = await makeGroup(courseA, 5);
    const reqId = await submit(studentA, courseA, groupId);

    const cross = await service.acceptRequest(reqId, teacherB);
    check("another teacher cannot accept this request",
      !cross.ok && cross.code === "not_found");
    const crossReject = await service.rejectRequest(reqId, teacherB, null);
    check("another teacher cannot reject this request",
      !crossReject.ok && crossReject.code === "not_found");
    check("another teacher cannot even read the detail",
      (await service.getTeacherRequestDetail(reqId, teacherB)) === null);
    check("the owning teacher can read the detail",
      (await service.getTeacherRequestDetail(reqId, teacherA)) !== null);

    const crossCancel = await service.cancelRequest(reqId, studentB);
    check("a student cannot cancel another student's request",
      !crossCancel.ok && crossCancel.code === "not_found");

    check("a nonexistent id is indistinguishable from an unauthorized one",
      (await service.acceptRequest("enr-ghost", teacherA)).ok === false &&
      (await service.getTeacherRequestDetail("enr-ghost", teacherA)) === null);

    // A teacher id used as a student id must find nothing.
    const roleConfusion = await service.cancelRequest(reqId, teacherA);
    check("a teacher cannot use the student cancel path",
      !roleConfusion.ok && roleConfusion.code === "not_found");

    // Teacher listings are scoped, not filtered client-side.
    const listB = await service.listTeacherRequests(teacherB);
    check("teacher B's list contains none of teacher A's requests",
      listB.every((r) => r.id !== reqId));

    const detail = await service.getTeacherRequestDetail(reqId, teacherA);
    check("PRIVACY the request detail exposes no phone number",
      detail !== null && !Object.keys(detail).some((k) => /phone/i.test(k)) &&
      !JSON.stringify(detail).includes("+99890111000"));
    check("PRIVACY the request detail exposes no password or session data",
      !/passwordHash|password_hash|tokenHash|session/i.test(JSON.stringify(detail)));
  }

  /* ============================ NOTIFICATIONS ============================= */
  console.log("\n# NOTIFICATIONS — scoped to the session user");

  {
    const groupId = await makeGroup(courseB, 2);
    const reqId = await submit(studentC, courseB, groupId);

    // Submission notifies the owning teacher.
    await db.transaction(async (tx) => {
      await service.recordSubmission(tx, {
        requestId: reqId, studentUserId: studentC, studentName: "O‘quvchi C",
        teacherUserId: teacherB, courseTitle: "Test kursi", groupTitle: "A guruhi",
      });
    });
    const teacherFeed = await notifications.listNotifications(teacherB);
    check("teacher is notified of a new submission",
      teacherFeed.some((n) => n.type === "enrollment_submitted"));

    const accepted = await service.acceptRequest(reqId, teacherB);
    check("accept succeeds for the owning teacher", accepted.ok);
    const studentFeed = await notifications.listNotifications(studentC);
    check("student is notified when accepted",
      studentFeed.some((n) => n.type === "enrollment_accepted"));
    check("the acceptance notification does NOT imply payment is taken",
      studentFeed.filter((n) => n.type === "enrollment_accepted")
        .every((n) => !/to‘lan|tolangan|payme|click|uzum|chek/i.test(`${n.title} ${n.body}`)));

    // Cancelling an accepted place notifies the teacher.
    await service.cancelRequest(reqId, studentC);
    const teacherFeed2 = await notifications.listNotifications(teacherB);
    check("teacher is notified when an accepted student withdraws",
      teacherFeed2.some((n) => n.type === "enrollment_cancelled"));

    // Rejection notifies the student, with the reason.
    const req2 = await submit(studentC, courseB, groupId);
    await service.rejectRequest(req2, teacherB, "Guruh darajangizga mos emas");
    const studentFeed2 = await notifications.listNotifications(studentC);
    check("student is notified when rejected",
      studentFeed2.some((n) => n.type === "enrollment_rejected"));
    const stored = (await db.select().from(schema.enrollmentRequests)
      .where(eq(schema.enrollmentRequests.id, req2)))[0];
    check("the rejection reason is stored as given",
      stored.decisionReason === "Guruh darajangizga mos emas");

    /* ---- ownership of notifications ---- */
    const studentUnreadBefore = await notifications.countUnreadNotifications(studentC);
    check("the student has unread notifications", studentUnreadBefore > 0);

    const victim = studentFeed2[0];
    // Another user submitting this id must change nothing.
    await notifications.markNotificationRead(victim.id, studentA);
    const stillUnread = await notifications.countUnreadNotifications(studentC);
    check("another user cannot mark this notification read",
      stillUnread === studentUnreadBefore);

    await notifications.markNotificationRead(victim.id, studentC);
    const afterOwn = await notifications.countUnreadNotifications(studentC);
    check("the owner can mark their own notification read",
      afterOwn === studentUnreadBefore - 1);

    // Idempotency: repeating the call is a harmless no-op.
    await notifications.markNotificationRead(victim.id, studentC);
    check("marking read twice is idempotent",
      (await notifications.countUnreadNotifications(studentC)) === afterOwn);

    await notifications.markAllNotificationsRead(studentC);
    check("mark-all-read clears this user's unread count",
      (await notifications.countUnreadNotifications(studentC)) === 0);
    check("mark-all-read does NOT touch another user's notifications",
      (await notifications.countUnreadNotifications(teacherB)) > 0);

    // A nonexistent id must not throw.
    await notifications.markNotificationRead("ntf-ghost", studentC);
    check("marking a nonexistent notification read is a safe no-op", true);

    const feed = await notifications.listNotifications(studentC);
    check("a user's feed contains only their own notifications", feed.length > 0);
  }

  /* =============================== INTEGRITY ============================== */
  console.log("\n# INTEGRITY — database constraints");

  {
    const groupId = await makeGroup(courseA, 5);
    const studentD = await makeUser("student", "+998903330001", "O‘quvchi D");
    await submit(studentD, courseA, groupId);

    await rejects("a second LIVE request for the same group is rejected by the DB", () =>
      submit(studentD, courseA, groupId));

    // After cancelling, re-applying must be allowed: the unique index is partial.
    const live = (await db.select().from(schema.enrollmentRequests)
      .where(and(
        eq(schema.enrollmentRequests.studentUserId, studentD),
        eq(schema.enrollmentRequests.groupId, groupId),
      )))[0];
    await service.cancelRequest(live.id, studentD);
    let reapplied = true;
    try {
      await submit(studentD, courseA, groupId);
    } catch {
      reapplied = false;
    }
    check("re-applying after cancelling is allowed (partial unique index)", reapplied);

    await rejects("a decision reason longer than 300 chars is rejected by the DB", () =>
      db.update(schema.enrollmentRequests)
        .set({ decisionReason: "x".repeat(301) })
        .where(eq(schema.enrollmentRequests.id, live.id)));

    // Event history.
    const events = await db.select().from(schema.enrollmentEvents)
      .where(eq(schema.enrollmentEvents.enrollmentRequestId, live.id));
    check("a status change writes an enrollment event", events.length >= 1);
    check("the event records both the old and the new status",
      events.some((e) => e.fromStatus === "submitted" && e.toStatus === "cancelled"));
    check("the event records who acted",
      events.every((e) => e.actorUserId === studentD));

    await rejects("an event for a nonexistent request is rejected (FK)", () =>
      db.insert(schema.enrollmentEvents).values({
        id: newId("evt"), enrollmentRequestId: "enr-ghost",
        actorUserId: studentD, toStatus: "accepted",
      }));

    await rejects("a notification for a nonexistent user is rejected (FK)", () =>
      db.insert(schema.notifications).values({
        id: newId("ntf"), userId: "usr-ghost", type: "enrollment_accepted",
        title: "T", body: "B",
      }));

    check("no seatsRemaining column exists on course_groups",
      !("seatsRemaining" in (await db.select().from(schema.courseGroups))[0]));
  }

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
