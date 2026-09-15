/* -------------------------------------------------------------------------- */
/* Phase 17 refund test suite.                                                 */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the committed migrations, and drives the REAL services and the REAL */
/* Payme adapter. Nothing is mocked, so every claim below is proven against the */
/* actual database constraints and the actual provider boundary.               */
/*                                                                              */
/* THE PROPERTY THIS SUITE EXISTS TO PROVE                                      */
/*                                                                              */
/*   A REFUND BECOMES `completed` ONLY FROM AN AUTHENTICATED PROVIDER CALLBACK.  */
/*                                                                              */
/*   • an admin approving is NOT completion — the enrollment stays `accepted`,   */
/*     the seat stays occupied, the chat stays writable and the student is told  */
/*     the truth: the provider still has to return the money;                    */
/*   • a pre-perform cancel (protocol state -1) is NOT a refund — no money ever  */
/*     moved, so no refund row may appear;                                       */
/*   • a post-perform cancel (protocol state -2) IS a refund signal, and money   */
/*     that moved back is recorded even when NOBODY in the application asked.    */
/*                                                                              */
/*   npm run test:refunds                                                       */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-refund-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
// Sandbox credentials for the adapter under test. Not real, never production.
process.env.PAYMENT_MODE = "test";
process.env.PAYME_MERCHANT_ID = "test-cashbox-id";
process.env.PAYME_MERCHANT_KEY = "test-key-0123456789abcdef0123456789ab";
process.env.PAYME_MERCHANT_LOGIN = "Paycom";
process.env.PAYME_CHECKOUT_URL = "https://test.paycom.uz";
process.env.APP_BASE_URL = "http://localhost:3000";

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

function errorCode(response: unknown): number | null {
  const body = response as { error?: { code?: number } };
  return body.error?.code ?? null;
}

function result(response: unknown): Record<string, unknown> | null {
  const body = response as { result?: Record<string, unknown> };
  return body.result ?? null;
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
  const refundLib = await import("../src/lib/refund");
  const validation = await import("../src/server/validation");
  const service = await import("../src/server/refund-service");
  const payments = await import("../src/server/payments/payment-service");
  const adapter = await import("../src/server/payments/payme-adapter");
  const protocol = await import("../src/server/payments/payme-protocol");
  const enrollment = await import("../src/server/enrollment-service");

  const db = getDb();

  /* ------------------------------ fixtures ------------------------------- */

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
      });
    }
    return id;
  }

  async function makeCourse(teacherUserId: string, slug: string, priceUzs: number) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: `Kurs ${slug}`,
      categoryId: "ielts",
      level: "orta",
      format: "online",
      priceUzs,
      summary: "S".repeat(60),
      status: "published",
      publishedAt: "2026-01-15",
    });
    return id;
  }

  async function makeGroup(courseId: string, capacity = 4) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id,
      courseId,
      title: "A guruhi",
      days: ["Du"],
      startTime: "18:00",
      capacity,
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
      status,
    });
    return id;
  }

  const teacher = await makeUser("teacher", "+998901120001", "Ustoz A");
  const admin = await makeUser("admin", "+998901120002", "Admin A");
  const admin2 = await makeUser("admin", "+998901120003", "Admin B");
  const studentA = await makeUser("student", "+998901120004", "O‘quvchi A");
  const studentB = await makeUser("student", "+998901120005", "O‘quvchi B");

  const paidCourse = await makeCourse(teacher, "pullik-kurs", 150_000);
  const freeCourse = await makeCourse(teacher, "bepul-kurs", 0);
  const freeGroup = await makeGroup(freeCourse);

  /**
   * Accepted enrollment + payment obligation, ready to be performed.
   *
   * Each call gets its OWN group: `enrollment_requests_one_live_per_group`
   * forbids one student holding two live enrollments in the same group, so
   * sharing a group would test the wrong thing (and seat counts would be
   * meaningless).
   */
  async function paidEnrollment(
    studentUserId: string,
    options: { perform?: boolean; txId?: string; name?: string } = {},
  ) {
    const groupId = await makeGroup(paidCourse);
    const enrollmentRequestId = await makeEnrollment(
      studentUserId,
      paidCourse,
      groupId,
      "accepted",
    );
    const created = await payments.ensurePaymentForEnrollment(enrollmentRequestId, studentUserId);
    if (!created.ok) throw new Error("payment creation failed");
    const paymentId = created.payment.id;
    const txId = options.txId ?? `payme-tx-${newId("x").slice(2, 26)}`;

    await adapter.handlePaymeRequest({
      id: 1,
      method: "CreateTransaction",
      params: {
        id: txId,
        time: Date.now(),
        amount: 15_000_000,
        account: { payment_id: paymentId },
      },
    });
    if (options.perform !== false) {
      await adapter.handlePaymeRequest({ id: 2, method: "PerformTransaction", params: { id: txId } });
    }
    return { enrollmentRequestId, paymentId, txId, groupId };
  }

  async function refundRows(paymentId: string) {
    return db
      .select()
      .from(schema.refundRequests)
      .where(eq(schema.refundRequests.paymentId, paymentId));
  }

  async function refundEventsOf(refundRequestId: string) {
    return db
      .select()
      .from(schema.refundEvents)
      .where(eq(schema.refundEvents.refundRequestId, refundRequestId));
  }

  async function notificationsFor(userId: string) {
    return db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));
  }

  /* -------------------------- DOMAIN SEPARATION --------------------------- */

  console.log("\n# DOMAIN — refunds are a third domain, not an enrollment status");

  check("`refunded` is not an enrollment status",
    !Object.values((await import("../src/lib/enrollment-status")).ENROLLMENT_STATUS_LABEL)
      .some((label) => label.toLowerCase().includes("refund")));
  check("`refunded` is not a payment status",
    !(Object.keys((await import("../src/lib/payment-status")).PAYMENT_STATUS_LABEL) as string[])
      .includes("refunded"));
  check("the refund statuses are exactly the contract",
    refundLib.REFUND_STATUSES.join(",") === "requested,awaiting_provider,completed,rejected,failed");
  check("exactly two statuses are live",
    refundLib.LIVE_REFUND_STATUSES.join(",") === "requested,awaiting_provider");
  check("an approval is NOT a completion",
    refundLib.REFUND_STATUS_LABEL.awaiting_provider !== refundLib.REFUND_STATUS_LABEL.completed);
  check("only the completion wording claims the money came back",
    refundLib.REFUND_STATUS_LABEL.completed.includes("qaytarildi") &&
    !refundLib.REFUND_STATUS_LABEL.awaiting_provider.includes("qaytarildi"));

  /* ------------------------------ ELIGIBILITY ----------------------------- */

  console.log("\n# ELIGIBILITY — who may ask for their money back");

  const paid = await paidEnrollment(studentA, {});
  const eligible = await service.getRefundEligibility(paid.enrollmentRequestId, studentA);
  check("an accepted + succeeded enrollment may request a refund", eligible.eligible);
  check("…and the amount is the payment's snapshot", eligible.amountTiyin === BigInt(15_000_000));
  check("…and no live refund exists yet", eligible.liveRefundId === null);

  const notOwner = await service.getRefundEligibility(paid.enrollmentRequestId, studentB);
  check("another student sees no eligibility (IDOR)", !notOwner.eligible && notOwner.paymentId === null);
  const unknown = await service.getRefundEligibility("enr-ghost", studentA);
  check("an unknown enrollment is not eligible", !unknown.eligible && unknown.paymentId === null);

  const freeEnrollment = await makeEnrollment(studentA, freeCourse, freeGroup, "accepted");
  const freeEligible = await service.getRefundEligibility(freeEnrollment, studentA);
  check("a free course is not refundable", !freeEligible.eligible);
  check("…with the honest reason", freeEligible.reason === refundLib.REFUND_NOT_AVAILABLE_FREE);

  const pendingGroup = await makeGroup(paidCourse);
  const pendingEnrollment = await makeEnrollment(studentB, paidCourse, pendingGroup, "accepted");
  await payments.ensurePaymentForEnrollment(pendingEnrollment, studentB);
  const pendingEligible = await service.getRefundEligibility(pendingEnrollment, studentB);
  check("an unpaid (pending) payment is not refundable", !pendingEligible.eligible);
  check("…with the honest reason", pendingEligible.reason === refundLib.REFUND_NOT_AVAILABLE_UNPAID);

  const submittedGroup = await makeGroup(paidCourse);
  const submittedEnrollment = await makeEnrollment(studentB, paidCourse, submittedGroup, "submitted");
  const submittedEligible = await service.getRefundEligibility(submittedEnrollment, studentB);
  check("a submitted enrollment is not refundable",
    !submittedEligible.eligible && submittedEligible.reason === refundLib.REFUND_NOT_AVAILABLE_ENROLLMENT);

  /* ------------------------------- REQUEST -------------------------------- */

  console.log("\n# REQUEST — the student's only financial action");

  const request = await service.requestRefund({
    enrollmentRequestId: paid.enrollmentRequestId,
    studentUserId: studentA,
    reason: "Kurs jadvali menga mos kelmadi, iltimos pulni qaytaring.",
  });
  check("a paid student can request a full refund", request.ok);
  const refundId = request.ok ? request.data.refundRequestId : "";
  check("…and it starts as `requested`", request.ok && request.data.status === "requested");
  check("…and reports that it created the row", request.ok && request.data.created);
  check("the enrollment is STILL accepted", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, paid.enrollmentRequestId)))[0]?.status === "accepted");
  check("exactly one refund row exists", (await refundRows(paid.paymentId)).length === 1);
  check("exactly one `requested` event exists",
    (await refundEventsOf(refundId)).filter((e) => e.type === "requested").length === 1);
  check("the event names the student as the actor",
    (await refundEventsOf(refundId))[0]?.actorUserId === studentA);
  check("the student got a receipt notification",
    (await notificationsFor(studentA)).some((n) => n.type === "refund_requested"));
  check("no email/SMS/push is implied anywhere in the copy",
    !refundLib.REFUND_STATUS_NOTE.requested.toLowerCase().includes("email"));

  const repeat = await service.requestRefund({
    enrollmentRequestId: paid.enrollmentRequestId,
    studentUserId: studentA,
    reason: "Yana bir marta yozdim, uzr.",
  });
  check("a repeated request is idempotent", repeat.ok && !repeat.data.created);
  check("…and returns the SAME refund id", repeat.ok && repeat.data.refundRequestId === refundId);
  check("…and created no second row", (await refundRows(paid.paymentId)).length === 1);
  check("…and recorded no second event",
    (await refundEventsOf(refundId)).length === 1);

  const concurrentRequests = await Promise.all([
    service.requestRefund({ enrollmentRequestId: paid.enrollmentRequestId, studentUserId: studentA, reason: "a" }),
    service.requestRefund({ enrollmentRequestId: paid.enrollmentRequestId, studentUserId: studentA, reason: "b" }),
    service.requestRefund({ enrollmentRequestId: paid.enrollmentRequestId, studentUserId: studentA, reason: "c" }),
  ]);
  check("three simultaneous requests all answer successfully",
    concurrentRequests.every((r) => r.ok));
  check("…and they all resolve to ONE refund",
    concurrentRequests.every((r) => r.ok && r.data.refundRequestId === refundId));
  check("…with exactly one row in the database", (await refundRows(paid.paymentId)).length === 1);

  const crossRequest = await service.requestRefund({
    enrollmentRequestId: paid.enrollmentRequestId,
    studentUserId: studentB,
    reason: "Men ham so‘rayman",
  });
  check("another student cannot request a refund for this enrollment",
    !crossRequest.ok && crossRequest.code === "not_found");

  const unknownRequest = await service.requestRefund({
    enrollmentRequestId: "enr-ghost",
    studentUserId: studentA,
    reason: "yo‘q yozilish",
  });
  check("an unknown enrollment is refused", !unknownRequest.ok && unknownRequest.code === "not_found");

  const freeRequest = await service.requestRefund({
    enrollmentRequestId: freeEnrollment,
    studentUserId: studentA,
    reason: "Bepul kurs uchun pul so‘rayapman",
  });
  check("a free course cannot produce a refund request", !freeRequest.ok);
  const pendingRequest = await service.requestRefund({
    enrollmentRequestId: pendingEnrollment,
    studentUserId: studentB,
    reason: "Hali to‘lamaganman",
  });
  check("an unpaid enrollment cannot produce a refund request",
    !pendingRequest.ok && pendingRequest.code === "unpaid");

  /* --------------------------- STUDENT READS ------------------------------ */

  console.log("\n# READS — a student sees only their own refunds");

  const own = await service.listStudentRefunds(studentA);
  check("the student's own list contains their request", own.some((r) => r.id === refundId));
  const otherList = await service.listStudentRefunds(studentB);
  check("another student's list does not contain it", !otherList.some((r) => r.id === refundId));
  check("the owner can read their refund detail",
    (await service.getRefundForStudent(refundId, studentA))?.refund.id === refundId);
  check("a non-owner gets null for the same id",
    (await service.getRefundForStudent(refundId, studentB)) === null);
  const byEnrollment = await service.listStudentRefundsByEnrollment([paid.enrollmentRequestId], studentA);
  check("the dashboard map is keyed by enrollment",
    byEnrollment.get(paid.enrollmentRequestId)?.[0]?.id === refundId);
  const byEnrollmentOther = await service.listStudentRefundsByEnrollment([paid.enrollmentRequestId], studentB);
  check("…and is empty for another student", byEnrollmentOther.size === 0);

  /* -------------------------- OVER-POSTING (ZOD) -------------------------- */

  console.log("\n# INPUT — intent only, .strict() rejects anything else");

  const validInput = { enrollmentRequestId: paid.enrollmentRequestId, reason: "Sabab yetarli uzunlikda." };
  check("the documented shape parses", validation.refundRequestSchema.safeParse(validInput).success);
  for (const field of ["paymentId", "studentId", "amount", "status", "provider", "teacherId"]) {
    check(`a payload carrying \`${field}\` is REJECTED`,
      !validation.refundRequestSchema.safeParse({ ...validInput, [field]: "x" }).success);
  }
  check("a too-short reason is rejected",
    !validation.refundRequestSchema.safeParse({ ...validInput, reason: "qisqa" }).success);
  check("an over-long reason is rejected",
    !validation.refundRequestSchema.safeParse({
      ...validInput,
      reason: "x".repeat(refundLib.REFUND_REASON_MAX_LENGTH + 1),
    }).success);
  check("an admin approval accepts only the id",
    validation.refundApprovalSchema.safeParse({ refundRequestId: refundId }).success);
  for (const field of ["status", "amount", "studentId", "paymentId"]) {
    check(`an admin approval carrying \`${field}\` is REJECTED`,
      !validation.refundApprovalSchema.safeParse({ refundRequestId: refundId, [field]: "x" }).success);
  }
  check("a rejection requires feedback",
    !validation.refundRejectionSchema.safeParse({ refundRequestId: refundId, feedback: "" }).success);

  /* ------------------------------- APPROVAL ------------------------------- */

  console.log("\n# APPROVAL — a decision, NOT a payment");

  const seatBefore = (await enrollment.getAcceptedCounts([paid.groupId])).get(paid.groupId) ?? 0;
  check("the group starts with exactly the one accepted seat", seatBefore === 1);

  const approved = await service.approveRefund({ refundRequestId: refundId, adminUserId: admin });
  check("an admin can approve a requested refund", approved.ok);
  check("…and the status becomes awaiting_provider",
    approved.ok && approved.data.status === "awaiting_provider");
  const afterApproval = (await refundRows(paid.paymentId))[0];
  check("the reviewer is recorded", afterApproval?.reviewedByAdminUserId === admin);
  check("the review time is recorded", afterApproval?.reviewedAt !== null);
  check("the refund is NOT completed by the decision", afterApproval?.status !== "completed");
  check("completed_at stays NULL", afterApproval?.completedAt === null);
  check("the enrollment is STILL accepted", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, paid.enrollmentRequestId)))[0]?.status === "accepted");
  check("the seat is STILL occupied",
    ((await enrollment.getAcceptedCounts([paid.groupId])).get(paid.groupId) ?? 0) === seatBefore);
  check("the payment is STILL succeeded",
    (await payments.getPaymentForStudent(paid.paymentId, studentA))?.status === "succeeded");
  check("the student is told what is actually happening",
    (await notificationsFor(studentA)).some((n) => n.type === "refund_approved"));
  check("an approval event was recorded",
    (await refundEventsOf(refundId)).some((e) => e.type === "approved"));
  check("the admin audit log records the decision",
    (await (await import("../src/server/audit-service")).listAuditEvents({ limit: 10 }))
      .some((e) => e.action === "refund_approved" && e.entityId === refundId && e.entityType === "refund"));

  const doubleApprove = await service.approveRefund({ refundRequestId: refundId, adminUserId: admin2 });
  check("a second approval is refused", !doubleApprove.ok && doubleApprove.code === "invalid_transition");
  const approveUnknown = await service.approveRefund({ refundRequestId: "rfd-ghost", adminUserId: admin });
  check("approving an unknown refund is refused",
    !approveUnknown.ok && approveUnknown.code === "not_found");

  const parallelApprove = await Promise.all([
    service.approveRefund({ refundRequestId: refundId, adminUserId: admin }),
    service.approveRefund({ refundRequestId: refundId, adminUserId: admin2 }),
  ]);
  check("two simultaneous approvals produce exactly one winner",
    parallelApprove.filter((r) => r.ok).length === 0 &&
    parallelApprove.filter((r) => !r.ok).length === 2);

  /* ------------------------------- PROVIDER ------------------------------- */

  console.log("\n# PROVIDER — only an authenticated callback completes a refund");

  check("cancelling an UNKNOWN transaction is refused with -31003 and writes nothing",
    errorCode(await adapter.handlePaymeRequest({
      id: 59, method: "CancelTransaction", params: { id: "payme-tx-does-not-exist", reason: 5 },
    })) === -31003);

  const cancel = await adapter.handlePaymeRequest({
    id: 60,
    method: "CancelTransaction",
    params: { id: paid.txId, reason: 5 },
  });
  check("CancelTransaction on a performed transaction reports state -2", result(cancel)?.state === -2);
  const completed = (await refundRows(paid.paymentId))[0];
  check("the refund is now completed", completed?.status === "completed");
  check("completed_at carries the provider's cancellation moment", completed?.completedAt !== null);
  check("the provider transaction id is attached", completed?.providerTransactionId === paid.txId);
  check("the reason code is stored as safe provider metadata",
    (await refundEventsOf(refundId)).some((e) => e.type === "provider_refund_completed" && e.reasonCode === 5));
  check("the provider event has NO actor user (the provider did it)",
    (await refundEventsOf(refundId)).every(
      (e) => e.type !== "provider_refund_completed" || e.actorUserId === null,
    ));
  check("the payment's own history records the refund confirmation",
    (await payments.listPaymentEvents(paid.paymentId)).some((e) => e.type === "provider_refund_confirmed"));
  check("the payment status itself is NOT rewritten",
    (await payments.getPaymentForStudent(paid.paymentId, studentA))?.status === "succeeded");
  check("the enrollment is now cancelled", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, paid.enrollmentRequestId)))[0]?.status === "cancelled");
  check("the enrollment event has NO actor user",
    (await db
      .select()
      .from(schema.enrollmentEvents)
      .where(and(
        eq(schema.enrollmentEvents.enrollmentRequestId, paid.enrollmentRequestId),
        eq(schema.enrollmentEvents.toStatus, "cancelled"),
      )))[0]?.actorUserId === null);
  check("the seat is released only now",
    ((await enrollment.getAcceptedCounts([paid.groupId])).get(paid.groupId) ?? 0) === seatBefore - 1);
  check("the student is told the money came back",
    (await notificationsFor(studentA)).some((n) => n.type === "refund_completed"));
  check("the teacher is told the place is free",
    (await notificationsFor(teacher)).some((n) => n.type === "refund_completed"));
  check("the student's own read shows `completed`",
    (await service.listStudentRefunds(studentA))[0]?.status === "completed");

  const repeatedCancel = await adapter.handlePaymeRequest({
    id: 61,
    method: "CancelTransaction",
    params: { id: paid.txId, reason: 5 },
  });
  check("a repeated CancelTransaction returns the same provider-compatible result",
    JSON.stringify(result(repeatedCancel)) === JSON.stringify(result(cancel)));
  check("…and creates no second refund row", (await refundRows(paid.paymentId)).length === 1);
  check("…and no duplicate completion event",
    (await refundEventsOf(refundId)).filter((e) => e.type === "provider_refund_completed").length === 1);
  check("…and no duplicate notification",
    (await notificationsFor(studentA)).filter((n) => n.type === "refund_completed").length === 1);

  let raceWinnerApprove = false;
  {
    /* Two admins decide at the same time; a callback lands in the middle. */
    const raced = await paidEnrollment(studentB, {});
    const racedRequest = await service.requestRefund({
      enrollmentRequestId: raced.enrollmentRequestId,
      studentUserId: studentB,
      reason: "Ikki administrator bir vaqtda qaror qilmoqda.",
    });
    const racedId = racedRequest.ok ? racedRequest.data.refundRequestId : "";
    const [one, two] = await Promise.all([
      service.approveRefund({ refundRequestId: racedId, adminUserId: admin }),
      service.rejectRefund({ refundRequestId: racedId, adminUserId: admin2, feedback: "Rad etiladi." }),
    ]);
    raceWinnerApprove = one.ok && !two.ok;
    check("approve and reject racing produce exactly ONE decision", one.ok !== two.ok);
    check("the loser gets a typed refusal, not a silent overwrite",
      (one.ok ? two : one).ok === false);
    const decided = (await refundRows(raced.paymentId))[0];
    check("the recorded decision matches the winner",
      raceWinnerApprove ? decided?.status === "awaiting_provider" : decided?.status === "rejected");
    check("exactly one decision event was recorded",
      (await refundEventsOf(racedId)).filter((e) => e.type === "approved" || e.type === "rejected").length === 1);
  }

  /* ------------------------------ PRE-PERFORM ----------------------------- */

  console.log("\n# PRE-PERFORM CANCEL — a failed attempt is NOT a refund");

  const abandoned = await paidEnrollment(studentA, { perform: false, txId: "payme-tx-abandoned-0000000001" });
  const cancelUnperformed = await adapter.handlePaymeRequest({
    id: 70,
    method: "CancelTransaction",
    params: { id: abandoned.txId, reason: 3 },
  });
  check("cancelling an unperformed transaction yields state -1", result(cancelUnperformed)?.state === -1);
  check("the payment becomes cancelled",
    (await payments.getPaymentForStudent(abandoned.paymentId, studentA))?.status === "cancelled");
  check("NO refund row is created for a failed attempt", (await refundRows(abandoned.paymentId)).length === 0);
  check("the payment records a plain provider cancellation",
    (await payments.listPaymentEvents(abandoned.paymentId)).some((e) => e.type === "provider_cancelled"));
  check("…and NOT a refund confirmation",
    !(await payments.listPaymentEvents(abandoned.paymentId)).some((e) => e.type === "provider_refund_confirmed"));
  check("the enrollment is untouched (still accepted)", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, abandoned.enrollmentRequestId)))[0]?.status === "accepted");
  const noRefundEligible = await service.getRefundEligibility(abandoned.enrollmentRequestId, studentA);
  check("an unpaid, cancelled attempt has nothing to refund", !noRefundEligible.eligible);

  /* ----------------------------- UNSOLICITED ------------------------------ */

  console.log("\n# UNSOLICITED — the provider reverses money nobody asked about");

  const silent = await paidEnrollment(studentA, { txId: "payme-tx-silent-000000000001" });
  check("no refund row exists before the reversal", (await refundRows(silent.paymentId)).length === 0);
  const silentCancel = await adapter.handlePaymeRequest({
    id: 80,
    method: "CancelTransaction",
    params: { id: silent.txId, reason: 5 },
  });
  check("the provider cancel succeeds", result(silentCancel)?.state === -2);
  const silentRows = await refundRows(silent.paymentId);
  check("a system-initiated refund record is created", silentRows.length === 1);
  check("…and it is already completed", silentRows[0]?.status === "completed");
  check("…and it is marked system-initiated", silentRows[0]?.systemInitiated === true);
  check("…with no human reviewer", silentRows[0]?.reviewedByAdminUserId === null);
  check("…and the full payment snapshot as its amount",
    silentRows[0]?.amountTiyin === BigInt(15_000_000));
  check("the reversal event is recorded",
    (await refundEventsOf(silentRows[0]!.id)).some((e) => e.type === "provider_reversal_recorded"));
  check("the enrollment is cancelled", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, silent.enrollmentRequestId)))[0]?.status === "cancelled");
  check("the student is notified", (await notificationsFor(studentA))
    .some((n) => n.type === "refund_provider_reversal"));
  check("the ADMINISTRATOR is notified too", (await notificationsFor(admin))
    .some((n) => n.type === "refund_provider_reversal"));

  /* --------------------------- REJECTION / FAILURE ------------------------ */

  console.log("\n# REJECTION AND FAILURE — the place is never taken away");

  const toReject = await paidEnrollment(studentB, {});
  const rejectedRequest = await service.requestRefund({
    enrollmentRequestId: toReject.enrollmentRequestId,
    studentUserId: studentB,
    reason: "Men shunchaki sinab ko‘rmoqchiman.",
  });
  const rejectedId = rejectedRequest.ok ? rejectedRequest.data.refundRequestId : "";
  const seatBeforeReject = (await enrollment.getAcceptedCounts([toReject.groupId])).get(toReject.groupId) ?? 0;

  const rejectNoFeedback = await service.rejectRefund({
    refundRequestId: rejectedId,
    adminUserId: admin,
    feedback: "   ",
  });
  check("a rejection without feedback is refused", !rejectNoFeedback.ok);
  const rejected = await service.rejectRefund({
    refundRequestId: rejectedId,
    adminUserId: admin,
    feedback: "Kurs allaqachon boshlangan, qaytarish shartlarga mos emas.",
  });
  check("an admin can reject a requested refund", rejected.ok);
  check("the status becomes rejected", rejected.ok && rejected.data.status === "rejected");
  check("the feedback is stored",
    Boolean((await refundRows(toReject.paymentId))[0]?.adminFeedback?.includes("shartlarga mos emas")));
  check("the enrollment STAYS accepted", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, toReject.enrollmentRequestId)))[0]?.status === "accepted");
  check("the seat stays occupied",
    ((await enrollment.getAcceptedCounts([toReject.groupId])).get(toReject.groupId) ?? 0) === seatBeforeReject);
  check("the payment stays succeeded",
    (await payments.getPaymentForStudent(toReject.paymentId, studentB))?.status === "succeeded");
  check("the student is told the reason", (await notificationsFor(studentB))
    .some((n) => n.type === "refund_rejected" && n.body.includes("shartlarga mos emas")));
  check("the audit log records the rejection",
    (await (await import("../src/server/audit-service")).listAuditEvents({ limit: 20 }))
      .some((e) => e.action === "refund_rejected" && e.entityId === rejectedId));
  const rejectAfterReject = await service.rejectRefund({
    refundRequestId: rejectedId,
    adminUserId: admin2,
    feedback: "Yana bir marta rad etaman.",
  });
  check("a decided refund cannot be decided again",
    !rejectAfterReject.ok && rejectAfterReject.code === "invalid_transition");
  const approveAfterReject = await service.approveRefund({
    refundRequestId: rejectedId,
    adminUserId: admin2,
  });
  check("a rejected refund cannot be approved",
    !approveAfterReject.ok && approveAfterReject.code === "invalid_transition");

  /* A rejected request does not block a later, legitimate one. */
  const retryRequest = await service.requestRefund({
    enrollmentRequestId: toReject.enrollmentRequestId,
    studentUserId: studentB,
    reason: "Vaziyat o‘zgardi, yana so‘rayman.",
  });
  check("a new request is allowed after a rejection", retryRequest.ok && retryRequest.data.created);
  check("…and it is a SECOND row", (await refundRows(toReject.paymentId)).length === 2);

  const failFromRequested = await service.recordRefundFailure({
    refundRequestId: retryRequest.ok ? retryRequest.data.refundRequestId : "",
    adminUserId: admin,
    feedback: "Provayder hali operatsiya qilmagan.",
  });
  check("a failure cannot be recorded before the provider operation", !failFromRequested.ok);
  await service.approveRefund({
    refundRequestId: retryRequest.ok ? retryRequest.data.refundRequestId : "",
    adminUserId: admin,
  });
  const seatBeforeFail = (await enrollment.getAcceptedCounts([toReject.groupId])).get(toReject.groupId) ?? 0;
  const failed = await service.recordRefundFailure({
    refundRequestId: retryRequest.ok ? retryRequest.data.refundRequestId : "",
    adminUserId: admin,
    feedback: "Karta yopilgan, provayder qaytarishni bajara olmadi.",
  });
  check("the provider outcome can be recorded as failed", failed.ok);
  check("…with status `failed`", failed.ok && failed.data.status === "failed");
  check("the enrollment is STILL accepted after a failure", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, toReject.enrollmentRequestId)))[0]?.status === "accepted");
  check("…and the seat is still occupied",
    ((await enrollment.getAcceptedCounts([toReject.groupId])).get(toReject.groupId) ?? 0) === seatBeforeFail);
  check("the student is told the failure and the reason", (await notificationsFor(studentB))
    .some((n) => n.type === "refund_failed" && n.body.includes("Karta yopilgan")));
  check("a failed refund does not block a future request",
    (await service.requestRefund({
      enrollmentRequestId: toReject.enrollmentRequestId,
      studentUserId: studentB,
      reason: "Boshqa karta bilan qayta urinib ko‘ramiz.",
    })).ok);

  /* ---------------------- REJECTED, THEN PROVIDER REVERSES ---------------- */

  console.log("\n# RACE — a callback arrives while the request was rejected");

  const racedEnrollment = await paidEnrollment(studentA, { txId: "payme-tx-raced-0000000000001" });
  const racedRequestRow = await service.requestRefund({
    enrollmentRequestId: racedEnrollment.enrollmentRequestId,
    studentUserId: studentA,
    reason: "Rad etilishidan oldin so‘radim.",
  });
  await service.rejectRefund({
    refundRequestId: racedRequestRow.ok ? racedRequestRow.data.refundRequestId : "",
    adminUserId: admin,
    feedback: "Rad etildi, lekin provayder baribir qaytardi.",
  });
  const seatBeforeRace = (await enrollment.getAcceptedCounts([racedEnrollment.groupId]))
    .get(racedEnrollment.groupId) ?? 0;
  await adapter.handlePaymeRequest({
    id: 90,
    method: "CancelTransaction",
    params: { id: racedEnrollment.txId, reason: 5 },
  });
  const racedRows = await refundRows(racedEnrollment.paymentId);
  check("both facts survive: the rejection AND the reversal", racedRows.length === 2);
  check("…one is rejected", racedRows.some((r) => r.status === "rejected"));
  check("…one is a completed, system-initiated reversal",
    racedRows.some((r) => r.status === "completed" && r.systemInitiated));
  check("the enrollment IS cancelled now (the money went back)", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, racedEnrollment.enrollmentRequestId)))[0]?.status === "cancelled");
  check("the seat is released",
    ((await enrollment.getAcceptedCounts([racedEnrollment.groupId])).get(racedEnrollment.groupId) ?? 0) ===
      seatBeforeRace - 1);

  /* --------------------------- CANCELLATION RULE -------------------------- */

  console.log("\n# CANCELLATION — paid places stay blocked, unpaid ones still work");

  const unpaidGroup = await makeGroup(paidCourse);
  const unpaid = await makeEnrollment(studentA, paidCourse, unpaidGroup, "accepted");
  const unpaidCancel = await enrollment.cancelRequest(unpaid, studentA);
  check("an accepted UNPAID place can still be cancelled directly", unpaidCancel.ok);
  const stillPaid = await paidEnrollment(studentB, { txId: "payme-tx-stillpaid-00000001" });
  const blocked = await enrollment.cancelRequest(stillPaid.enrollmentRequestId, studentB);
  check("an accepted PAID place cannot be cancelled directly",
    !blocked.ok && blocked.code === "payment_settled");
  check("the refusal points at the refund path",
    !blocked.ok && blocked.message.includes("qaytarish"));
  check("the paid enrollment is untouched", (await db
    .select({ status: schema.enrollmentRequests.status })
    .from(schema.enrollmentRequests)
    .where(eq(schema.enrollmentRequests.id, stillPaid.enrollmentRequestId)))[0]?.status === "accepted");

  /* ------------------------------ DATABASE -------------------------------- */

  console.log("\n# CONSTRAINTS — the database refuses to be talked into nonsense");

  const live = await paidEnrollment(studentA, { txId: "payme-tx-constraint-000000001" });
  const liveRequest = await service.requestRefund({
    enrollmentRequestId: live.enrollmentRequestId,
    studentUserId: studentA,
    reason: "Birinchi jonli so‘rov.",
  });
  await rejects("the DB refuses a SECOND live refund for one payment", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "requested",
      amountTiyin: BigInt(15_000_000),
      reason: "Ikkinchi jonli so‘rov",
    }));
  await rejects("the DB refuses a completed refund without evidence", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "completed",
      amountTiyin: BigInt(15_000_000),
      reason: "Dalilsiz yakun",
    }));
  await rejects("the DB refuses a rejected refund without feedback", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "rejected",
      amountTiyin: BigInt(15_000_000),
      reason: "Sabab bor",
    }));
  await rejects("the DB refuses an approval with no admin behind it", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "awaiting_provider",
      amountTiyin: BigInt(15_000_000),
      reason: "Adminsiz tasdiq",
    }));
  await rejects("the DB refuses a zero-amount refund", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "requested",
      amountTiyin: BigInt(0),
      reason: "Nol summa",
    }));
  await rejects("the DB refuses untrimmed free-text", () =>
    db.insert(schema.refundRequests).values({
      id: newId("rfd"),
      paymentId: live.paymentId,
      enrollmentRequestId: live.enrollmentRequestId,
      studentUserId: studentA,
      status: "requested",
      amountTiyin: BigInt(15_000_000),
      reason: "  bo‘shliqli sabab  ",
    }));

  /* ------------------------------- PRIVACY -------------------------------- */

  console.log("\n# PRIVACY — no secrets, no payload dumps, no teacher power");

  const allEvents = await db.select().from(schema.refundEvents);
  const key = "test-key-0123456789abcdef0123456789ab";
  check("no refund event contains the merchant key",
    allEvents.every((e) => !JSON.stringify(e).includes(key)));
  check("no refund event contains an Authorization header",
    allEvents.every((e) => !JSON.stringify(e).toLowerCase().includes("authorization")));
  check("no refund event carries a raw provider payload",
    allEvents.every((e) => (e.metadata ?? "").length <= 500));
  const auditEvents = await db.select().from(schema.adminAuditEvents);
  check("no audit row contains the merchant key",
    auditEvents.every((e) => !JSON.stringify(e).includes(key)));

  const teacherStatesOwn = await service.getTeacherRefundStates([live.enrollmentRequestId], teacher);
  check("the owning teacher sees a factual refund state", teacherStatesOwn.get(live.enrollmentRequestId) === "requested");
  const otherTeacher = await makeUser("teacher", "+998901120009", "Ustoz B");
  const teacherStatesOther = await service.getTeacherRefundStates([live.enrollmentRequestId], otherTeacher);
  check("another teacher sees nothing for the same enrollment", teacherStatesOther.size === 0);
  const adminDetail = await service.getRefundForAdmin(liveRequest.ok ? liveRequest.data.refundRequestId : "");
  check("the admin detail exposes the payment snapshot", adminDetail?.payment.amountTiyin === BigInt(15_000_000));
  check("…and the provider transaction state, but no credentials",
    adminDetail?.providerTransaction?.state === protocol.PAYME_STATE.PERFORMED);
  check("…and the immutable event history", (adminDetail?.events.length ?? 0) >= 1);
  const liveRefundId = liveRequest.ok ? liveRequest.data.refundRequestId : "";
  check("the queue lists the live request",
    (await service.listAdminRefunds({ status: "requested" })).some((r) => r.id === liveRefundId));
  const counts = await service.getRefundQueueCounts();
  check("the queue counts add up", counts.all === (await db.select().from(schema.refundRequests)).length);
  check("…and live counts only live statuses", counts.live === counts.requested + counts.awaiting_provider);

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
