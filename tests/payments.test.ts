/* -------------------------------------------------------------------------- */
/* Phase 14 payment test suite.                                                */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the committed migrations. Every claim about idempotency, amounts,   */
/* authorization and the Payme protocol is therefore proven against the actual  */
/* database and the actual adapter — not a mock.                                */
/*                                                                              */
/* The single most important property under test:                               */
/*                                                                              */
/*   A PAYMENT CAN ONLY BECOME `succeeded` VIA AN AUTHENTICATED PROVIDER        */
/*   CALLBACK. No browser action, no query parameter, no student server action  */
/*   can produce that state.                                                    */
/*                                                                              */
/*   npm run test:payments                                                      */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-pay-"));
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

function throws(name: string, fn: () => unknown): void {
  try {
    fn();
    check(name, false);
  } catch {
    check(name, true);
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

/** Shorthand for reading the error code out of a JSON-RPC response. */
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

  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const money = await import("../src/lib/money");
  const status = await import("../src/lib/payment-status");
  const service = await import("../src/server/payments/payment-service");
  const protocol = await import("../src/server/payments/payme-protocol");
  const adapter = await import("../src/server/payments/payme-adapter");
  const enrollment = await import("../src/server/enrollment-service");

  const db = getDb();
  const AUTH = `Basic ${Buffer.from("Paycom:test-key-0123456789abcdef0123456789ab").toString("base64")}`;

  /* ----------------------------- fixture setup ---------------------------- */
  const password = await hashPassword("supersecret");

  async function makeUser(role: "student" | "teacher", phone: string, name: string) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role, phone, passwordHash: password });
    if (role === "student") {
      await db.insert(schema.studentProfiles).values({ userId: id, name });
    } else {
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
      id, slug, teacherUserId, title: "Test kursi", categoryId: "ielts",
      level: "orta", format: "online", priceUzs, summary: "S".repeat(60),
      status: "published", publishedAt: "2026-01-15",
    });
    return id;
  }

  async function makeGroup(courseId: string) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id, courseId, title: "A guruhi", days: ["Du"], startTime: "18:00",
      capacity: 10, startDate: "2026-10-05",
    });
    return id;
  }

  async function makeEnrollment(
    studentUserId: string,
    courseId: string,
    groupId: string,
    enrollmentStatus: "submitted" | "accepted",
  ) {
    const id = newId("enr");
    await db.insert(schema.enrollmentRequests).values({
      id, studentUserId, courseId, groupId, note: "Qiziqaman", status: enrollmentStatus,
    });
    return id;
  }

  const teacher = await makeUser("teacher", "+998901110001", "Ustoz A");
  const studentA = await makeUser("student", "+998901110003", "O‘quvchi A");
  const studentB = await makeUser("student", "+998901110004", "O‘quvchi B");

  const paidCourse = await makeCourse(teacher, "pullik-kurs", 150_000);
  const freeCourse = await makeCourse(teacher, "bepul-kurs", 0);
  const paidGroup = await makeGroup(paidCourse);
  const freeGroup = await makeGroup(freeCourse);

  /* ================================= MONEY ================================ */
  console.log("\n# MONEY — integer tiyin arithmetic");

  check("150 000 so‘m is 15 000 000 tiyin",
    money.somToTiyin(150_000) === BigInt(15_000_000));
  check("zero converts to zero", money.somToTiyin(0) === BigInt(0));
  check("conversion round-trips", money.tiyinToSom(money.somToTiyin(99_999)) === 99_999);
  check("one so‘m is one hundred tiyin", money.somToTiyin(1) === BigInt(100));
  throws("a negative price is rejected", () => money.somToTiyin(-1));
  throws("a fractional price is rejected", () => money.somToTiyin(1500.5));
  throws("NaN is rejected", () => money.somToTiyin(Number.NaN));
  throws("Infinity is rejected", () => money.somToTiyin(Number.POSITIVE_INFINITY));
  throws("an absurd price is rejected (overflow guard)",
    () => money.somToTiyin(money.MAX_PRICE_SOM + 1));
  check("the maximum price still converts",
    money.somToTiyin(money.MAX_PRICE_SOM) === money.MAX_AMOUNT_TIYIN);

  check("a provider amount of 15000000 parses",
    money.parseProviderAmount(15_000_000) === BigInt(15_000_000));
  check("a fractional provider amount is refused",
    money.parseProviderAmount(1500.5) === null);
  check("a string provider amount is refused",
    money.parseProviderAmount("15000000") === null);
  check("a negative provider amount is refused",
    money.parseProviderAmount(-100) === null);
  check("zero is free", money.isFreePriceSom(0));
  check("a priced course is not free", !money.isFreePriceSom(1));

  /* ================================ DOMAIN ================================ */
  console.log("\n# DOMAIN — eligibility and the price snapshot");

  const enrAccepted = await makeEnrollment(studentA, paidCourse, paidGroup, "accepted");
  const enrSubmitted = await makeEnrollment(studentB, paidCourse, paidGroup, "submitted");
  const enrFree = await makeEnrollment(studentA, freeCourse, freeGroup, "accepted");

  check("`paid` is not an enrollment status",
    !Object.keys(
      (await import("../src/lib/enrollment-status")).ENROLLMENT_STATUS_LABEL,
    ).includes("paid"));

  const payable = await service.getPayableEnrollment(enrAccepted, studentA);
  check("an accepted enrollment is payable", payable !== null);
  check("the payable enrollment carries the course price", payable?.priceUzs === 150_000);

  check("a submitted enrollment is NOT payable",
    (await service.getPayableEnrollment(enrSubmitted, studentB)) === null);
  check("another student cannot load this enrollment (IDOR)",
    (await service.getPayableEnrollment(enrAccepted, studentB)) === null);
  check("a teacher id cannot load a student enrollment",
    (await service.getPayableEnrollment(enrAccepted, teacher)) === null);
  check("a nonexistent enrollment is not payable",
    (await service.getPayableEnrollment("enr-ghost", studentA)) === null);

  const freeAttempt = await service.ensurePaymentForEnrollment(enrFree, studentA);
  check("a FREE course never creates a payment", !freeAttempt.ok);
  check("the free course refusal uses the required wording",
    !freeAttempt.ok && freeAttempt.message === "Kurs bepul. To‘lov talab qilinmaydi.");
  check("no payment row exists for the free enrollment",
    (await db.select().from(schema.payments)
      .where(eq(schema.payments.enrollmentRequestId, enrFree))).length === 0);

  const crossStudent = await service.ensurePaymentForEnrollment(enrAccepted, studentB);
  check("another student cannot create a payment for this enrollment", !crossStudent.ok);

  const submittedAttempt = await service.ensurePaymentForEnrollment(enrSubmitted, studentB);
  check("a not-yet-accepted enrollment cannot be paid", !submittedAttempt.ok);

  const first = await service.ensurePaymentForEnrollment(enrAccepted, studentA);
  check("an accepted paid enrollment creates a payment", first.ok);
  const paymentId = first.ok ? first.payment.id : "";
  check("the new payment starts pending", first.ok && first.payment.status === "pending");
  check("the amount is the server-derived snapshot in tiyin",
    first.ok && first.payment.amountTiyin === BigInt(15_000_000));
  check("the currency is UZS", first.ok && first.payment.currency === "UZS");
  check("a creation event was recorded",
    (await service.listPaymentEvents(paymentId)).some((e) => e.type === "payment_created"));

  /* --------------------------- the price snapshot -------------------------- */
  await db.update(schema.courses).set({ priceUzs: 999_000 })
    .where(eq(schema.courses.id, paidCourse));

  const afterEdit = await service.getPaymentForStudent(paymentId, studentA);
  check("raising the course price does NOT change an existing payment",
    afterEdit?.amountTiyin === BigInt(15_000_000));

  await db.update(schema.courses).set({ priceUzs: 150_000 })
    .where(eq(schema.courses.id, paidCourse));

  /* ============================== IDEMPOTENCY ============================= */
  console.log("\n# IDEMPOTENCY — one obligation, one transaction, one payment");

  const second = await service.ensurePaymentForEnrollment(enrAccepted, studentA);
  check("a second initiation reuses the same obligation",
    second.ok && second.payment.id === paymentId);
  check("the second initiation reports that it created nothing",
    second.ok && second.created === false);

  const concurrent = await Promise.all([
    service.ensurePaymentForEnrollment(enrAccepted, studentA),
    service.ensurePaymentForEnrollment(enrAccepted, studentA),
    service.ensurePaymentForEnrollment(enrAccepted, studentA),
  ]);
  check("three simultaneous initiations all succeed", concurrent.every((r) => r.ok));
  check("…and all return the SAME payment id",
    concurrent.every((r) => r.ok && r.payment.id === paymentId));
  check("exactly one live payment row exists for the enrollment",
    (await db.select().from(schema.payments)
      .where(eq(schema.payments.enrollmentRequestId, enrAccepted))).length === 1);

  await rejects("the DB itself refuses a second live obligation", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: enrAccepted, studentUserId: studentA,
      provider: "payme", amountTiyin: BigInt(15_000_000), status: "pending",
    }));

  /* ================================= PAYME ================================ */
  console.log("\n# PAYME — the six Merchant API methods");

  check("exactly six methods are implemented", protocol.PAYME_METHODS.length === 6);
  check("the method names match the official protocol",
    ["CheckPerformTransaction", "CreateTransaction", "PerformTransaction",
      "CancelTransaction", "CheckTransaction", "GetStatement"]
      .every((m) => protocol.PAYME_METHODS.includes(m as never)));
  check("the states are 1 / 2 / -1 / -2",
    protocol.PAYME_STATE.CREATED === 1 && protocol.PAYME_STATE.PERFORMED === 2 &&
    protocol.PAYME_STATE.CANCELLED === -1 &&
    protocol.PAYME_STATE.CANCELLED_AFTER_PERFORM === -2);
  check("the transaction timeout is the official 12 hours",
    protocol.PAYME_TRANSACTION_TIMEOUT_MS === 43_200_000);

  /* ------------------------------- auth ------------------------------------ */
  const config = (await import("../src/server/env")).paymeConfig();
  if (!config) throw new Error("test config missing");

  check("valid Basic credentials are accepted", adapter.verifyPaymeAuth(AUTH, config));
  check("a missing Authorization header is rejected",
    !adapter.verifyPaymeAuth(null, config));
  check("an empty header is rejected", !adapter.verifyPaymeAuth("", config));
  check("a Bearer token is rejected",
    !adapter.verifyPaymeAuth("Bearer sometoken", config));
  check("the wrong key is rejected", !adapter.verifyPaymeAuth(
    `Basic ${Buffer.from("Paycom:wrong-key").toString("base64")}`, config));
  check("the wrong login is rejected", !adapter.verifyPaymeAuth(
    `Basic ${Buffer.from(`Attacker:${config.merchantKey}`).toString("base64")}`, config));
  check("a header with no colon is rejected", !adapter.verifyPaymeAuth(
    `Basic ${Buffer.from("nocolonhere").toString("base64")}`, config));
  check("a key that merely starts correctly is rejected", !adapter.verifyPaymeAuth(
    `Basic ${Buffer.from(`Paycom:${config.merchantKey.slice(0, 10)}`).toString("base64")}`,
    config));

  /* -------------------------- CheckPerformTransaction ---------------------- */
  const cpt = await adapter.handlePaymeRequest({
    id: 1, method: "CheckPerformTransaction",
    params: { amount: 15_000_000, account: { payment_id: paymentId } },
  });
  check("CheckPerformTransaction allows a valid account+amount",
    result(cpt)?.allow === true);

  check("CheckPerformTransaction rejects a wrong amount with -31001",
    errorCode(await adapter.handlePaymeRequest({
      id: 2, method: "CheckPerformTransaction",
      params: { amount: 1, account: { payment_id: paymentId } },
    })) === -31001);

  const unknownAccount = await adapter.handlePaymeRequest({
    id: 3, method: "CheckPerformTransaction",
    params: { amount: 15_000_000, account: { payment_id: "pay-ghost" } },
  });
  check("CheckPerformTransaction rejects an unknown account in -31050..-31099",
    (errorCode(unknownAccount) ?? 0) <= -31050 && (errorCode(unknownAccount) ?? 0) >= -31099);
  check("…and names the offending account field in `data`",
    (unknownAccount as { error?: { data?: string } }).error?.data === "payment_id");
  check("…and carries a localized message object",
    typeof (unknownAccount as { error?: { message?: { uz?: string } } }).error?.message
      ?.uz === "string");

  check("a missing account is rejected as an account error",
    ((errorCode(await adapter.handlePaymeRequest({
      id: 4, method: "CheckPerformTransaction", params: { amount: 15_000_000 },
    })) ?? 0) <= -31050));

  check("an unknown method returns -32601",
    errorCode(await adapter.handlePaymeRequest({
      id: 5, method: "MakeMeRich", params: {},
    })) === -32601);
  check("a method-shaped injection is not dispatched",
    errorCode(await adapter.handlePaymeRequest({
      id: 6, method: "performTransaction", params: {},
    })) === -32601);
  check("a non-object body is rejected",
    errorCode(await adapter.handlePaymeRequest("nope")) === -32600);

  /* ----------------------------- CreateTransaction -------------------------- */
  const PTX = "payme-tx-000000000000000000001";
  const createdAt = Date.now();

  const create1 = await adapter.handlePaymeRequest({
    id: 10, method: "CreateTransaction",
    params: { id: PTX, time: createdAt, amount: 15_000_000,
      account: { payment_id: paymentId } },
  });
  check("CreateTransaction succeeds", result(create1) !== null);
  check("…and reports state 1 (created)", result(create1)?.state === 1);
  check("…and echoes create_time", result(create1)?.create_time === createdAt);

  const create2 = await adapter.handlePaymeRequest({
    id: 11, method: "CreateTransaction",
    params: { id: PTX, time: createdAt, amount: 15_000_000,
      account: { payment_id: paymentId } },
  });
  check("a REPEATED CreateTransaction returns an identical result",
    JSON.stringify(result(create2)) === JSON.stringify(result(create1)));
  check("…and did not create a second transaction row",
    (await db.select().from(schema.paymentTransactions)).length === 1);

  check("a SECOND transaction for the same pending obligation returns -31008",
    errorCode(await adapter.handlePaymeRequest({
      id: 12, method: "CreateTransaction",
      params: { id: "payme-tx-other", time: Date.now(), amount: 15_000_000,
        account: { payment_id: paymentId } },
    })) === -31008);

  check("CreateTransaction with a tampered amount returns -31001",
    errorCode(await adapter.handlePaymeRequest({
      id: 13, method: "CreateTransaction",
      params: { id: "payme-tx-cheap", time: Date.now(), amount: 100,
        account: { payment_id: paymentId } },
    })) === -31001);

  check("CreateTransaction for an unknown account is an account error",
    ((errorCode(await adapter.handlePaymeRequest({
      id: 14, method: "CreateTransaction",
      params: { id: "payme-tx-ghost", time: Date.now(), amount: 15_000_000,
        account: { payment_id: "pay-ghost" } },
    })) ?? 0) <= -31050));

  /* ------------------------------ CheckTransaction -------------------------- */
  const checkBefore = await adapter.handlePaymeRequest({
    id: 20, method: "CheckTransaction", params: { id: PTX },
  });
  check("CheckTransaction reports state 1 before performing",
    result(checkBefore)?.state === 1);
  check("…with perform_time zero", result(checkBefore)?.perform_time === 0);
  check("CheckTransaction for an unknown id returns -31003",
    errorCode(await adapter.handlePaymeRequest({
      id: 21, method: "CheckTransaction", params: { id: "payme-tx-nope" },
    })) === -31003);

  /* ----------------------------- PerformTransaction ------------------------- */
  const beforePerform = await service.getPaymentForStudent(paymentId, studentA);
  check("the payment is still pending before PerformTransaction",
    beforePerform?.status === "pending");

  const perform1 = await adapter.handlePaymeRequest({
    id: 30, method: "PerformTransaction", params: { id: PTX },
  });
  check("PerformTransaction succeeds", result(perform1) !== null);
  check("…and reports state 2 (performed)", result(perform1)?.state === 2);

  const afterPerform = await service.getPaymentForStudent(paymentId, studentA);
  check("the payment is now succeeded", afterPerform?.status === "succeeded");
  check("…and paidAt was stamped", afterPerform?.paidAt !== null);

  const notifications = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.userId, studentA));
  const paidNotes = notifications.filter((n) => n.type === "payment_succeeded");
  check("the student was notified exactly once", paidNotes.length === 1);
  check("the notification uses the required wording",
    paidNotes[0]?.title === "To‘lov muvaffaqiyatli tasdiqlandi");

  const perform2 = await adapter.handlePaymeRequest({
    id: 31, method: "PerformTransaction", params: { id: PTX },
  });
  check("a REPEATED PerformTransaction returns an identical result",
    JSON.stringify(result(perform2)) === JSON.stringify(result(perform1)));

  const notesAfterRetry = (await db.select().from(schema.notifications)
    .where(eq(schema.notifications.userId, studentA)))
    .filter((n) => n.type === "payment_succeeded");
  check("the repeat did NOT produce a second notification",
    notesAfterRetry.length === 1);
  check("the repeat did NOT append a duplicate success event",
    (await service.listPaymentEvents(paymentId))
      .filter((e) => e.type === "payment_succeeded").length === 1);

  const concurrentPerform = await Promise.all([
    adapter.handlePaymeRequest({ id: 32, method: "PerformTransaction", params: { id: PTX } }),
    adapter.handlePaymeRequest({ id: 33, method: "PerformTransaction", params: { id: PTX } }),
  ]);
  check("two simultaneous Performs both answer successfully",
    concurrentPerform.every((r) => result(r) !== null));
  check("…and still exactly one success notification exists",
    (await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, studentA)))
      .filter((n) => n.type === "payment_succeeded").length === 1);

  check("PerformTransaction for an unknown id returns -31003",
    errorCode(await adapter.handlePaymeRequest({
      id: 34, method: "PerformTransaction", params: { id: "payme-tx-nope" },
    })) === -31003);

  const checkAfter = await adapter.handlePaymeRequest({
    id: 35, method: "CheckTransaction", params: { id: PTX },
  });
  check("CheckTransaction now reports state 2", result(checkAfter)?.state === 2);

  /* -------------------------------- GetStatement ---------------------------- */
  const statement = await adapter.handlePaymeRequest({
    id: 40, method: "GetStatement",
    params: { from: createdAt - 60_000, to: Date.now() + 60_000 },
  });
  const txs = (result(statement)?.transactions ?? []) as Array<Record<string, unknown>>;
  check("GetStatement returns a transactions array", Array.isArray(txs));
  check("…containing our transaction", txs.some((t) => t.id === PTX));
  check("…with the amount in tiyin", txs.some((t) => t.amount === 15_000_000));
  check("…and an empty window returns nothing",
    ((result(await adapter.handlePaymeRequest({
      id: 41, method: "GetStatement", params: { from: 1, to: 2 },
    }))?.transactions ?? []) as unknown[]).length === 0);

  /* ================================ SECURITY ============================== */
  console.log("\n# SECURITY — only an authenticated callback can settle");

  check("a paid enrollment reports a succeeded payment",
    await service.hasSucceededPayment(enrAccepted));

  const cancelPaid = await enrollment.cancelRequest(enrAccepted, studentA);
  check("a PAID enrollment cannot be self-cancelled", !cancelPaid.ok);
  check("…and the refusal is honest about refunds",
    !cancelPaid.ok && cancelPaid.message ===
      "To‘langan yozilishni bekor qilish va pulni qaytarish jarayoni hali qo‘llab-quvvatlanmaydi.");
  check("…and the enrollment is still accepted",
    (await db.select().from(schema.enrollmentRequests)
      .where(eq(schema.enrollmentRequests.id, enrAccepted)))[0]?.status === "accepted");

  /* An accepted but UNPAID enrollment must still be cancellable. */
  const studentC = await makeUser("student", "+998901110007", "O‘quvchi C");
  const enrUnpaid = await makeEnrollment(studentC, paidCourse, paidGroup, "accepted");
  await service.ensurePaymentForEnrollment(enrUnpaid, studentC);
  const cancelUnpaid = await enrollment.cancelRequest(enrUnpaid, studentC);
  check("an accepted but UNPAID enrollment is still cancellable", cancelUnpaid.ok);

  check("another student cannot read this payment (IDOR)",
    (await service.getPaymentForStudent(paymentId, studentB)) === null);
  check("a teacher cannot read the payment through the student accessor",
    (await service.getPaymentForStudent(paymentId, teacher)) === null);
  check("an unknown payment id returns nothing",
    (await service.getPaymentForStudent("pay-ghost", studentA)) === null);

  /*
   * Static inspection rather than import: these modules pull in Next.js
   * client runtime. What matters is the exported SURFACE — there must be no
   * action anywhere that a browser could call to declare a payment settled.
   */
  const actionExports = (source: string): string[] =>
    Array.from(
      readFileSync(path.join(process.cwd(), source), "utf8")
        .matchAll(/export async function (\w+)/g),
    ).map((m) => m[1]);

  check("the payment action module exports only the initiation action",
    JSON.stringify(actionExports("src/server/actions/payment.ts")) ===
      JSON.stringify(["startPaymentAction"]));
  check("no exported action can declare a payment settled",
    ["src/server/actions/payment.ts", "src/server/actions/enrollment.ts",
      "src/server/actions/enrollment-decision.ts"]
      .flatMap(actionExports)
      .every((name) => !/succeed|markPaid|confirmPayment|settle/i.test(name)));
  check("only the provider callback path can mark a payment performed",
    !readFileSync(path.join(process.cwd(), "src/server/actions/payment.ts"), "utf8")
      .includes("markPerformed"));

  /* Amount tampering at the database boundary. */
  await rejects("a zero-amount payment is refused by a CHECK constraint", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: enrSubmitted, studentUserId: studentB,
      provider: "payme", amountTiyin: BigInt(0), status: "pending",
    }));
  await rejects("a negative-amount payment is refused", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: enrSubmitted, studentUserId: studentB,
      provider: "payme", amountTiyin: BigInt(-1), status: "pending",
    }));
  await rejects("a foreign currency is refused", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: enrSubmitted, studentUserId: studentB,
      provider: "payme", amountTiyin: BigInt(100), currency: "USD", status: "pending",
    }));
  await rejects("a payment for a nonexistent enrollment is refused (FK)", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: "enr-ghost", studentUserId: studentB,
      provider: "payme", amountTiyin: BigInt(100), status: "pending",
    }));
  await rejects("a duplicate provider transaction id is refused", () =>
    db.insert(schema.paymentTransactions).values({
      id: newId("ptx"), paymentId, provider: "payme", providerTransactionId: PTX,
      providerCreatedAt: BigInt(Date.now()), state: 1,
    }));
  await rejects("an invented transaction state is refused", () =>
    db.insert(schema.paymentTransactions).values({
      id: newId("ptx"), paymentId, provider: "payme",
      providerTransactionId: "payme-tx-weird",
      providerCreatedAt: BigInt(Date.now()), state: 7,
    }));
  await rejects("marking succeeded without paidAt is refused", () =>
    db.insert(schema.payments).values({
      id: newId("pay"), enrollmentRequestId: enrSubmitted, studentUserId: studentB,
      provider: "payme", amountTiyin: BigInt(100), status: "succeeded",
    }));

  /* ----------------------------- CancelTransaction -------------------------- */
  console.log("\n# CANCEL — protocol-correct, not a user-facing refund");

  const cancelPerformed = await adapter.handlePaymeRequest({
    id: 50, method: "CancelTransaction", params: { id: PTX, reason: 5 },
  });
  const cancelState = result(cancelPerformed)?.state;
  check("cancelling a PERFORMED transaction yields state -2",
    cancelState === -2);
  check("…and the payment REMAINS succeeded (no fake refund)",
    (await service.getPaymentForStudent(paymentId, studentA))?.status === "succeeded");
  check("a repeated CancelTransaction returns an identical result",
    JSON.stringify(result(await adapter.handlePaymeRequest({
      id: 51, method: "CancelTransaction", params: { id: PTX, reason: 5 },
    }))) === JSON.stringify(result(cancelPerformed)));
  check("CancelTransaction for an unknown id returns -31003",
    errorCode(await adapter.handlePaymeRequest({
      id: 52, method: "CancelTransaction", params: { id: "payme-tx-nope", reason: 5 },
    })) === -31003);

  /* Cancelling a transaction that was never performed → -1 and `cancelled`. */
  const studentD = await makeUser("student", "+998901110008", "O‘quvchi D");
  const enrD = await makeEnrollment(studentD, paidCourse, paidGroup, "accepted");
  const payD = await service.ensurePaymentForEnrollment(enrD, studentD);
  const payDId = payD.ok ? payD.payment.id : "";
  const PTX_D = "payme-tx-000000000000000000002";
  await adapter.handlePaymeRequest({
    id: 60, method: "CreateTransaction",
    params: { id: PTX_D, time: Date.now(), amount: 15_000_000,
      account: { payment_id: payDId } },
  });
  const cancelCreated = await adapter.handlePaymeRequest({
    id: 61, method: "CancelTransaction", params: { id: PTX_D, reason: 4 },
  });
  check("cancelling a CREATED transaction yields state -1",
    result(cancelCreated)?.state === -1);
  check("…and the payment becomes cancelled",
    (await service.getPaymentForStudent(payDId, studentD))?.status === "cancelled");
  check("…and no success notification was ever sent to that student",
    (await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, studentD)))
      .filter((n) => n.type === "payment_succeeded").length === 0);
  check("a cancelled obligation no longer blocks a fresh one",
    (await service.ensurePaymentForEnrollment(enrD, studentD)).ok);

  /* ================================= STATUS =============================== */
  console.log("\n# STATUS — the student-facing projection");

  check("the four payment statuses are exactly pending/succeeded/cancelled/failed",
    JSON.stringify(status.PAYMENT_STATUSES) ===
      JSON.stringify(["pending", "succeeded", "cancelled", "failed"]));
  check("there is no refund status",
    !status.PAYMENT_STATUSES.includes("refunded" as never));
  check("an accepted place with no attempt yet reads “To‘lov kutilmoqda”",
    status.PAYMENT_REQUIRED_LABEL === "To‘lov kutilmoqda");
  check("a started attempt reads “To‘lov jarayonda”",
    status.PAYMENT_STATUS_LABEL.pending === "To‘lov jarayonda");
  check("succeeded reads “To‘lov qilindi”",
    status.PAYMENT_STATUS_LABEL.succeeded === "To‘lov qilindi");
  check("no label calls the student completed or certified",
    !Object.values(status.PAYMENT_STATUS_LABEL)
      .some((label) => /tugatdi|bitirdi|sertifikat/i.test(label)));
  check("the free-course note is the required sentence",
    status.FREE_COURSE_NOTE === "Kurs bepul. To‘lov talab qilinmaydi.");
  check("pending may become succeeded",
    status.canTransitionPayment("pending", "succeeded"));
  check("succeeded is final",
    !status.canTransitionPayment("succeeded", "cancelled") &&
    status.isFinalPaymentStatus("succeeded"));
  check("a cancelled or failed attempt may be retried",
    status.canRetryPayment("cancelled") && status.canRetryPayment("failed"));
  check("a succeeded payment is never retryable (no double charge)",
    !status.canRetryPayment("succeeded") && !status.isPayable("succeeded"));
  check("an open obligation is payable", status.isPayable("pending"));

  check("the teacher projection of a free course is “to‘lov talab qilinmaydi”",
    status.teacherPaymentView(true, null) === "not_required");
  check("the teacher projection of an unpaid place is “awaiting”",
    status.teacherPaymentView(false, "pending") === "awaiting");
  check("the teacher projection of a paid place is “paid”",
    status.teacherPaymentView(false, "succeeded") === "paid");
  check("no teacher label exposes an amount",
    !Object.values(status.TEACHER_PAYMENT_LABEL).some((l) => /\d/.test(l)));

  /* --------------------------- checkout URL building ------------------------ */
  const url = adapter.paymeProvider.buildCheckoutUrl({
    paymentId, amountTiyin: BigInt(15_000_000), returnUrl: "http://localhost:3000/x",
  });
  check("the checkout URL points at the configured host",
    url.startsWith("https://test.paycom.uz/"));
  const decoded = Buffer.from(url.split("/").pop() ?? "", "base64").toString("utf8");
  check("the encoded payload carries the cashbox id", decoded.includes("m=test-cashbox-id"));
  check("…the account field name matches our adapter",
    decoded.includes(`ac.payment_id=${paymentId}`));
  check("…and the amount in tiyin", decoded.includes("a=15000000"));
  check("the merchant KEY never appears in the checkout URL",
    !decoded.includes(config.merchantKey) && !url.includes(config.merchantKey));

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
