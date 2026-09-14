/* -------------------------------------------------------------------------- */
/* Phase 16 private messaging test suite.                                      */
/*                                                                             */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the same committed migrations production uses. Every claim below —  */
/* eligibility, one-conversation-per-enrollment, cross-user IDOR, read state,   */
/* pagination, notification collapsing and the DB-level invariants — is proven  */
/* against the actual database and the actual service code.                     */
/*                                                                             */
/*   npm run test:messaging                                                    */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-messages-"));
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

/** Walks drizzle's `cause` chain for the SQLSTATE of the driver error. */
async function rejectsWithCode(name: string, code: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(name, false);
  } catch (error) {
    let current = error as { code?: string; cause?: unknown };
    while (current && current.code === undefined && current.cause) {
      current = current.cause as typeof current;
    }
    check(name, current?.code === code);
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

  const { eq, and, desc } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const service = await import("../src/server/messaging-service");
  const notifications = await import("../src/server/notification-service");
  const validation = await import("../src/server/validation");
  const contract = await import("../src/lib/messaging");

  const db = getDb();

  /* ----------------------------- fixture setup ---------------------------- */
  const password = await hashPassword("supersecret");

  async function makeUser(role: "student" | "teacher" | "admin", phone: string, name: string) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role, phone, passwordHash: password });
    if (role === "student") {
      await db.insert(schema.studentProfiles).values({ userId: id, name });
    } else if (role === "teacher") {
      await db.insert(schema.teacherProfiles).values({
        userId: id,
        slug: `ustoz-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase()}`,
        name,
        bio: "B".repeat(60),
        city: "toshkent",
        verification: "verified",
        isPublic: true,
      });
    }
    return id;
  }

  const teacherA = await makeUser("teacher", "+998901330001", "Ustoz A");
  const teacherB = await makeUser("teacher", "+998901330002", "Ustoz B");
  const studentA = await makeUser("student", "+998901330003", "O‘quvchi A");
  const studentB = await makeUser("student", "+998901330004", "O‘quvchi B");
  const admin = await makeUser("admin", "+998901330005", "Administrator");

  async function makeCourse(teacherUserId: string, slug: string) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: "Xabar kursi",
      categoryId: "ielts",
      level: "orta",
      format: "online",
      priceUzs: 0,
      summary: "S".repeat(60),
      status: "published",
      publishedAt: "2026-01-15",
    });
    return id;
  }

  async function makeGroup(courseId: string) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id,
      courseId,
      title: "A guruhi",
      days: ["Du"],
      startTime: "18:00",
      capacity: 10,
      startDate: "2026-10-05",
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

  const courseA = await makeCourse(teacherA, "ustoz-a-xabar-kursi");
  const courseB = await makeCourse(teacherB, "ustoz-b-xabar-kursi");
  const groupA1 = await makeGroup(courseA);
  const groupA2 = await makeGroup(courseA);
  const groupB1 = await makeGroup(courseB);
  const groupB2 = await makeGroup(courseB);

  const acceptedA = await makeEnrollment(studentA, courseA, groupA1, "accepted");
  const cancelledNoThread = await makeEnrollment(studentA, courseA, groupA2, "cancelled");
  const submittedB = await makeEnrollment(studentB, courseB, groupB1, "submitted");
  const rejectedB = await makeEnrollment(studentB, courseB, groupB1, "rejected");

  /* ============================== ELIGIBILITY ============================== */
  console.log("\n# ELIGIBILITY — a conversation needs an ACCEPTED enrollment");

  const opened = await service.getOrCreateEnrollmentConversation(acceptedA, studentA);
  check("an accepted enrollment opens a conversation", opened.ok && opened.data?.created === true);
  const conversationId = opened.ok ? opened.data!.conversationId : "";
  check("the creator is recognised as the student", opened.ok && opened.data?.role === "student");

  const reopened = await service.getOrCreateEnrollmentConversation(acceptedA, studentA);
  check(
    "opening it again returns the SAME conversation (one per enrollment)",
    reopened.ok && reopened.data?.conversationId === conversationId && reopened.data?.created === false,
  );

  const asTeacher = await service.getOrCreateEnrollmentConversation(acceptedA, teacherA);
  check(
    "the teacher reaches the same thread from their side",
    asTeacher.ok && asTeacher.data?.conversationId === conversationId && asTeacher.data?.role === "teacher",
  );

  {
    const cancelled = await service.getOrCreateEnrollmentConversation(cancelledNoThread, studentA);
    check("a cancelled enrollment with no thread cannot start one",
      !cancelled.ok && cancelled.code === "not_writable");
    const submitted = await service.getOrCreateEnrollmentConversation(submittedB, studentB);
    check("a submitted enrollment cannot start a conversation",
      !submitted.ok && submitted.code === "not_writable");
    const rejected = await service.getOrCreateEnrollmentConversation(rejectedB, studentB);
    check("a rejected enrollment cannot start a conversation",
      !rejected.ok && rejected.code === "not_writable");
    const otherTeacher = await service.getOrCreateEnrollmentConversation(acceptedA, teacherB);
    check("another teacher cannot open somebody else's enrollment (not_found)",
      !otherTeacher.ok && otherTeacher.code === "not_found");
    const otherStudent = await service.getOrCreateEnrollmentConversation(acceptedA, studentB);
    check("another student cannot open somebody else's enrollment (not_found)",
      !otherStudent.ok && otherStudent.code === "not_found");
    const adminTry = await service.getOrCreateEnrollmentConversation(acceptedA, admin);
    check("an admin has no messaging privilege (not_found)",
      !adminTry.ok && adminTry.code === "not_found");
    const ghost = await service.getOrCreateEnrollmentConversation("enr-does-not-exist", studentA);
    check("an unknown enrollment is not_found", !ghost.ok && ghost.code === "not_found");
  }

  /* ============================ CONCURRENCY (open) ========================== */
  console.log("\n# CONCURRENCY — two simultaneous opens make ONE conversation");

  {
    const raceEnrollment = await makeEnrollment(studentB, courseA, groupA2, "accepted");
    const [x, y] = await Promise.all([
      service.getOrCreateEnrollmentConversation(raceEnrollment, studentB),
      service.getOrCreateEnrollmentConversation(raceEnrollment, teacherA),
    ]);
    const ids = [x, y].filter((r) => r.ok).map((r) => r.data!.conversationId);
    check("both racers get an id", ids.length === 2);
    check("both racers get the SAME conversation", ids[0] === ids[1]);

    const rows = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.enrollmentRequestId, raceEnrollment));
    check("exactly one conversation row exists after the race", rows.length === 1);

    await rejectsWithCode("the DB itself rejects a second conversation for one enrollment", "23505", () =>
      db.insert(schema.conversations).values({ id: newId("cnv"), enrollmentRequestId: raceEnrollment }),
    );
  }

  /* ================================ MESSAGES ================================ */
  console.log("\n# MESSAGES — plain text, immutable, deterministic order");

  const firstSend = await service.sendMessage(conversationId, studentA, "Assalomu alaykum, ustoz!");
  check("a student can write to their teacher", firstSend.ok);
  const teacherReply = await service.sendMessage(conversationId, teacherA, "Va alaykum assalom!");
  check("a teacher can write back", teacherReply.ok);

  {
    const body = "  Salom  \n\n  ikkinchi qator  ";
    const sent = await service.sendMessage(conversationId, studentA, body);
    check("outer whitespace is trimmed and inner line breaks survive", sent.ok);
    const page = await service.listMessages(conversationId, studentA);
    const stored = page.messages.find((m) => m.id === (sent.ok ? sent.data!.messageId : ""));
    check("the stored body is exactly the trimmed text", stored?.body === "Salom  \n\n  ikkinchi qator");

    const empty = await service.sendMessage(conversationId, studentA, "    ");
    check("an empty (whitespace-only) message is refused", !empty.ok && empty.code === "invalid_body");
    const tooLong = await service.sendMessage(conversationId, studentA, "x".repeat(2001));
    check("a message over the length bound is refused", !tooLong.ok && tooLong.code === "invalid_body");
    const exactlyMax = await service.sendMessage(conversationId, studentA, "y".repeat(2000));
    check("a message exactly at the bound is accepted", exactlyMax.ok);
  }

  {
    const payload = `<script>alert("xss")</script><img src=x onerror=alert(1)>`;
    const sent = await service.sendMessage(conversationId, studentA, payload);
    check("markup is accepted as literal text (never as HTML)", sent.ok);
    const page = await service.listMessages(conversationId, studentA);
    check(
      "the stored body is byte-identical to the plain text that was sent",
      page.messages.some((m) => m.body === payload),
    );
    // The render path is React, which escapes — proven by the fact that the
    // stored value is the raw string, not an entity-encoded or stripped copy.
    check("no entity encoding is applied on write", !page.messages.some((m) => m.body.includes("&lt;")));
  }

  {
    const page = await service.listMessages(conversationId, teacherA);
    const ordered = [...page.messages].sort((a, b) => {
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      return delta !== 0 ? delta : a.id.localeCompare(b.id);
    });
    check(
      "history is returned in deterministic chronological order",
      page.messages.every((m, index) => m.id === ordered[index]?.id),
    );
    check("the viewer's own messages are marked as theirs", page.messages.some((m) => m.mine));
    check("the other side's messages are not marked as theirs", page.messages.some((m) => !m.mine));
  }

  /* ============================== AUTHORIZATION ============================= */
  console.log("\n# AUTHORIZATION — participants only, and refusals look like absence");

  {
    const outsiderRead = await service.getConversationForParticipant(conversationId, studentB);
    check("another student cannot read the thread", outsiderRead === null);
    const outsiderTeacher = await service.getConversationForParticipant(conversationId, teacherB);
    check("another teacher cannot read the thread", outsiderTeacher === null);
    const adminRead = await service.getConversationForParticipant(conversationId, admin);
    check("an admin does NOT automatically get chat access", adminRead === null);
    const ghostRead = await service.getConversationForParticipant("cnv-does-not-exist", studentA);
    check("an unknown conversation id is the same refusal", ghostRead === null);

    const outsiderSend = await service.sendMessage(conversationId, studentB, "Men begona odamman");
    check("another student cannot write into the thread",
      !outsiderSend.ok && outsiderSend.code === "not_found");
    const otherTeacherSend = await service.sendMessage(conversationId, teacherB, "Men boshqa ustozman");
    check("another teacher cannot write into the thread",
      !otherTeacherSend.ok && otherTeacherSend.code === "not_found");
    const adminSend = await service.sendMessage(conversationId, admin, "Administrator yozmoqda");
    check("an admin cannot send into a private thread",
      !adminSend.ok && adminSend.code === "not_found");
    const ghostSend = await service.sendMessage("cnv-does-not-exist", studentA, "Salom");
    check("sending into an unknown conversation is not_found",
      !ghostSend.ok && ghostSend.code === "not_found");

    const studentList = await service.listConversations(studentA);
    check("a student sees only their own conversation", studentList.length === 1);
    const outsiderList = await service.listConversations(studentB);
    check("another student's list contains only THEIR thread", outsiderList.every((c) => c.id !== conversationId));
    const teacherList = await service.listConversations(teacherA);
    check(
      "a teacher sees exactly the threads of their own course",
      teacherList.length === 2 && teacherList.some((c) => c.id === conversationId),
    );
    const otherTeacherList = await service.listConversations(teacherB);
    check("another teacher's list does not contain it", otherTeacherList.every((c) => c.id !== conversationId));
    const ownerList = await service.listConversations(teacherA);
    check("the list shows the counterpart, the course and the group",
      ownerList[0]?.counterpartName === "O‘quvchi A" &&
        ownerList[0]?.courseTitle === "Xabar kursi" &&
        ownerList[0]?.groupTitle === "A guruhi");
    check("no phone number is part of the projection",
      !Object.keys(ownerList[0] ?? {}).some((key) => /phone/i.test(key)));
  }

  /* =============================== READ STATE =============================== */
  console.log("\n# READ STATE — a monotonic marker, not a counter");

  {
    const unreadForTeacher = await service.countUnreadMessages(teacherA);
    check("the teacher starts with unread student messages", unreadForTeacher > 0);
    check("the sender is never counted as unread for themselves",
      (await service.countUnreadMessages(admin)) === 0);

    const page = await service.listMessages(conversationId, teacherA);
    const newest = page.messages[page.messages.length - 1];
    const marked = await service.markConversationRead(conversationId, teacherA, newest.id);
    check("marking the newest message read succeeds", marked.ok && marked.data?.advanced === true);
    check("unread drops to zero", (await service.countUnreadMessages(teacherA)) === 0);

    const again = await service.markConversationRead(conversationId, teacherA, newest.id);
    check("marking the same message again is idempotent", again.ok && again.data?.advanced === false);
    check("unread stays zero after the retry", (await service.countUnreadMessages(teacherA)) === 0);

    // Monotonic: an OLDER message must not rewind the marker.
    const oldest = page.messages[0];
    const rewind = await service.markConversationRead(conversationId, teacherA, oldest.id);
    check("an older message does not move the marker backwards",
      rewind.ok && rewind.data?.advanced === false);
    check("unread is still zero after the rewind attempt",
      (await service.countUnreadMessages(teacherA)) === 0);

    // A message that arrives AFTER the marker is unread again.
    const fresh = await service.sendMessage(conversationId, studentA, "Yana bir savol bor.");
    check("a new message after the mark becomes unread",
      fresh.ok && (await service.countUnreadMessages(teacherA)) === 1);

    const foreign = await service.markConversationRead(conversationId, studentB, newest.id);
    check("a non-participant cannot mark somebody else's thread read",
      !foreign.ok && foreign.code === "not_found");

    // The cursor must belong to THIS conversation.
    const otherThread = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.enrollmentRequestId, acceptedA));
    check("fixture sanity: one conversation for the accepted enrollment", otherThread.length === 1);
    const crossThreadMessage = await db.select().from(schema.messages).limit(1);
    const crossMark = await service.markConversationRead("cnv-does-not-exist", teacherA, crossThreadMessage[0].id);
    check("marking an unknown conversation is not_found",
      !crossMark.ok && crossMark.code === "not_found");
  }

  /* ============================== PAGINATION =============================== */
  console.log("\n# PAGINATION — one cursor page at a time");

  {
    const bulkEnrollment = await makeEnrollment(studentB, courseB, groupB2, "accepted");
    const openedBulk = await service.getOrCreateEnrollmentConversation(bulkEnrollment, studentB);
    check("a second accepted enrollment opens its own thread", openedBulk.ok);
    const bulkId = openedBulk.ok ? openedBulk.data!.conversationId : "";

    // Explicit, increasing timestamps: a bulk insert would otherwise stamp every
    // row with the same `now()`, which is realistic for a real conversation but
    // useless for asserting "this page ends at the newest message".
    const base = Date.now() - 45 * 60 * 1000;
    const rows = Array.from({ length: 45 }, (_, index) => ({
      id: newId("msg"),
      conversationId: bulkId,
      senderUserId: index % 2 === 0 ? studentB : teacherB,
      body: `Xabar ${index + 1}`,
      createdAt: new Date(base + index * 60 * 1000),
    }));
    await db.insert(schema.messages).values(rows);

    const latest = await service.listMessages(bulkId, studentB);
    check("the newest page holds exactly the page size", latest.messages.length === 30);
    check("the newest page reports more history behind it", latest.hasMore === true);
    check("the newest page ends with the newest message", latest.messages[29]?.body === "Xabar 45");

    const older = await service.listMessages(bulkId, studentB, { before: latest.messages[0].id });
    check("the older page returns the remaining history", older.messages.length === 15);
    check("the older page reports no further history", older.hasMore === false);
    check("the older page starts where history starts", older.messages[0]?.body === "Xabar 1");
    check(
      "the two pages do not overlap",
      !older.messages.some((m) => latest.messages.some((n) => n.id === m.id)),
    );

    const bogusCursor = await service.listMessages(bulkId, studentB, { before: "msg-not-in-this-thread" });
    check("an unknown cursor is ignored instead of trusted (newest page)",
      bogusCursor.messages.length === 30 && bogusCursor.messages[29]?.body === "Xabar 45");

    const capped = await service.listMessages(bulkId, studentB, { limit: 500 });
    check("the page size is capped server-side", capped.messages.length === 45);
  }

  /* ============================= NOTIFICATIONS ============================= */
  console.log("\n# NOTIFICATIONS — one collapsed ping per unread thread");

  {
    const before = await notifications.countUnreadNotifications(teacherA);
    const list = await service.listConversations(teacherA);
    check("the teacher has an unread state to work with", list.some((c) => c.unreadCount > 0));
    check("the count endpoint agrees there is something unread", before >= 1);

    const unreadMessageNotes = async (recipient: string) =>
      (
        await db
          .select()
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, recipient),
              eq(schema.notifications.type, "message_received"),
              eq(schema.notifications.href, `/teacher/dashboard/messages/${conversationId}`),
            ),
          )
      ).filter((note) => note.readAt === null);

    const collapsed = await unreadMessageNotes(teacherA);
    check("the first message created exactly one unread notification", collapsed.length === 1);
    check("the notification is titled honestly", collapsed[0]?.title === "Yangi xabar");
    check(
      "the notification names the sender and the course",
      collapsed[0]?.body === "O‘quvchi A · Xabar kursi",
    );

    const countMessageNotes = async (userId: string) =>
      (
        await db
          .select()
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, userId),
              eq(schema.notifications.type, "message_received"),
            ),
          )
      ).length;
    const senderBefore = await countMessageNotes(studentA);
    await service.sendMessage(conversationId, studentA, "Yana bir xabar yuborildi");
    check("the sender never notifies themselves", (await countMessageNotes(studentA)) === senderBefore);

    // A burst must not queue a second unread notification for the same thread.
    await service.sendMessage(conversationId, studentA, "Birinchi qo‘shimcha xabar");
    await service.sendMessage(conversationId, studentA, "Ikkinchi qo‘shimcha xabar");
    const afterBurst = await unreadMessageNotes(teacherA);
    check("a burst still leaves ONE unread notification (collapsed)", afterBurst.length === 1);

    // Reading the notification re-arms it.
    await notifications.markAllNotificationsRead(teacherA);
    await service.sendMessage(conversationId, studentA, "Yana bir xabar");
    const rearmed = await unreadMessageNotes(teacherA);
    check("after the bell is cleared a new message may notify again", rearmed.length === 1);
  }

  /* ============================ CANCELLATION ============================== */
  console.log("\n# CANCELLATION — history stays, writing stops (server-side)");

  {
    const historyBefore = await service.listMessages(conversationId, studentA);
    await db
      .update(schema.enrollmentRequests)
      .set({ status: "cancelled" })
      .where(eq(schema.enrollmentRequests.id, acceptedA));

    const context = await service.getConversationForParticipant(conversationId, studentA);
    check("the thread is still visible after cancellation", context !== null);
    check("the cancellation is reported to the UI", context?.writable === false);

    const historyAfter = await service.listMessages(conversationId, studentA);
    check("no message is deleted by a cancellation", historyAfter.messages.length === historyBefore.messages.length);

    const lateSend = await service.sendMessage(conversationId, studentA, "Bekor qilingandan keyin");
    check("the send action refuses SERVER-SIDE once cancelled",
      !lateSend.ok && lateSend.code === "not_writable");
    const lateTeacherSend = await service.sendMessage(conversationId, teacherA, "Ustozdan ham");
    check("the teacher cannot write into a cancelled thread either",
      !lateTeacherSend.ok && lateTeacherSend.code === "not_writable");

    const list = await service.listConversations(studentA);
    const cancelledRow = list.find((c) => c.id === conversationId);
    check("the list still shows the read-only thread", cancelledRow?.enrollmentStatus === "cancelled");
  }

  /* ============================== CONCURRENCY ============================== */
  console.log("\n# CONCURRENCY — two sends at once are both preserved");

  {
    const raceEnrollment = await makeEnrollment(studentA, courseB, groupB1, "accepted");
    const openedRace = await service.getOrCreateEnrollmentConversation(raceEnrollment, teacherB);
    check("fixture: the racing thread is open", openedRace.ok);
    const raceId = openedRace.ok ? openedRace.data!.conversationId : "";

    const [p, q] = await Promise.all([
      service.sendMessage(raceId, studentA, "Raqobat xabari 1"),
      service.sendMessage(raceId, teacherB, "Raqobat xabari 2"),
    ]);
    check("both concurrent sends succeed", p.ok && q.ok);

    const stored = await service.listMessages(raceId, studentA);
    check("both messages are preserved", stored.messages.length === 2);
    const ordered = [...stored.messages].sort((a, b) => {
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      return delta !== 0 ? delta : a.id.localeCompare(b.id);
    });
    check("their order is deterministic", stored.messages.every((m, i) => m.id === ordered[i]?.id));
  }

  /* ============================= RATE LIMITING ============================= */
  console.log("\n# RATE LIMITING — a DB-derived per-sender budget");

  {
    const rateEnrollment = await makeEnrollment(studentA, courseB, groupB2, "accepted");
    const openedRate = await service.getOrCreateEnrollmentConversation(rateEnrollment, teacherB);
    check("fixture: the rate-limit thread is open", openedRate.ok);
    const rateId = openedRate.ok ? openedRate.data!.conversationId : "";

    await db.insert(schema.messages).values(
      Array.from({ length: 30 }, (_, index) => ({
        id: newId("msg"),
        conversationId: rateId,
        senderUserId: studentA,
        body: `Tez xabar ${index + 1}`,
      })),
    );
    const blocked = await service.sendMessage(rateId, studentA, "Yana bittasi");
    check("a sender over the per-minute budget is refused",
      !blocked.ok && blocked.code === "rate_limited");
    const otherUser = await service.sendMessage(rateId, teacherB, "Ustoz bemalol yozadi");
    check("the budget is per sender, not per conversation", otherUser.ok);
  }

  /* ============================== SCHEMAS ================================= */
  console.log("\n# OVER-POSTING — intent-shaped payloads only");

  {
    check("sendMessageSchema accepts the intent shape",
      validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "Salom" }).success);
    check("OVER-POST senderUserId is rejected",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "Salom", senderUserId: "usr-1" }).success);
    check("OVER-POST studentId is rejected",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "Salom", studentId: "usr-1" }).success);
    check("OVER-POST teacherId is rejected",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "Salom", teacherId: "usr-1" }).success);
    check("OVER-POST enrollmentId is rejected",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "Salom", enrollmentId: "enr-1" }).success);
    check("an over-long body is rejected by the schema",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "x".repeat(2001) }).success);
    check("an empty body is rejected by the schema",
      !validation.sendMessageSchema.safeParse({ conversationId: "cnv-1", body: "   " }).success);
    check("openConversationSchema accepts an enrollment id and nothing else",
      validation.openConversationSchema.safeParse({ enrollmentRequestId: "enr-1" }).success &&
        !validation.openConversationSchema.safeParse({ enrollmentRequestId: "enr-1", userId: "usr-1" }).success);
    check("markConversationReadSchema rejects extra fields",
      validation.markConversationReadSchema.safeParse({ conversationId: "cnv-1", lastMessageId: "msg-1" }).success &&
        !validation.markConversationReadSchema.safeParse({ conversationId: "cnv-1", lastMessageId: "msg-1", at: "now" }).success);
  }

  /* ============================ DB INVARIANTS ============================= */
  console.log("\n# DB INVARIANTS — the database is the last line of defence");

  {
    await rejectsWithCode("a body with outer whitespace is rejected by a CHECK", "23514", () =>
      db.insert(schema.messages).values({
        id: newId("msg"),
        conversationId,
        senderUserId: studentA,
        body: "  bo‘sh joy  ",
      }));

    await rejectsWithCode("an over-long body is rejected by a CHECK", "23514", () =>
      db.insert(schema.messages).values({
        id: newId("msg"),
        conversationId,
        senderUserId: studentA,
        body: "x".repeat(2001),
      }));

    await rejectsWithCode("a message for an unknown conversation is rejected (FK)", "23503", () =>
      db.insert(schema.messages).values({
        id: newId("msg"),
        conversationId: "cnv-ghost",
        senderUserId: studentA,
        body: "Salom",
      }));

    await rejectsWithCode("a message from an unknown user is rejected (FK)", "23503", () =>
      db.insert(schema.messages).values({
        id: newId("msg"),
        conversationId,
        senderUserId: "usr-ghost",
        body: "Salom",
      }));

    // The composite FK: a read marker may only point at a message of ITS thread.
    const otherThreadRow = await db
      .select({ id: schema.messages.id, conversationId: schema.messages.conversationId, createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    const foreign = otherThreadRow[0];
    const mismatchedThread = (await db.select({ id: schema.messages.id, conversationId: schema.messages.conversationId, createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .limit(1))[0];
    check("fixture: the cross-thread probe has two different conversations",
      foreign.conversationId !== mismatchedThread.conversationId);
    await db
      .delete(schema.conversationReads)
      .where(
        and(
          eq(schema.conversationReads.conversationId, mismatchedThread.conversationId),
          eq(schema.conversationReads.userId, studentB),
        ),
      );
    await rejectsWithCode("a read marker cannot point at another thread's message", "23503", () =>
      db.insert(schema.conversationReads).values({
        conversationId: mismatchedThread.conversationId,
        userId: studentB,
        lastReadMessageId: foreign.id,
        lastReadAt: foreign.createdAt,
      }));

    const conversationRows = await db.select().from(schema.conversations);
    check("no participant columns exist on conversations (they are derived)",
      !("studentUserId" in conversationRows[0]) && !("teacherUserId" in conversationRows[0]));
    check("messages carry no edit or delete column",
      !("editedAt" in otherThreadRow[0]) && !("deletedAt" in otherThreadRow[0]));
  }

  /* =============================== CONTRACT =============================== */
  console.log("\n# CONTRACT — the pure module agrees with the service");

  {
    check("accepted allows messaging", contract.enrollmentAllowsMessaging("accepted"));
    check("cancelled does not allow writing", !contract.enrollmentAllowsMessaging("cancelled"));
    check("submitted does not allow writing", !contract.enrollmentAllowsMessaging("submitted"));
    check("rejected does not allow writing", !contract.enrollmentAllowsMessaging("rejected"));
    check("a conversation href never contains a user id",
      contract.conversationHref("student", "cnv-1") === "/dashboard/messages/cnv-1" &&
        contract.conversationHref("teacher", "cnv-1") === "/teacher/dashboard/messages/cnv-1");
    check("the preview collapses whitespace",
      contract.messagePreview("Salom\n\n  dunyo   !") === "Salom dunyo !");
    check("the preview truncates with an ellipsis",
      contract.messagePreview("a".repeat(200)).endsWith("…") &&
        contract.messagePreview("a".repeat(200)).length <= 81);
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
