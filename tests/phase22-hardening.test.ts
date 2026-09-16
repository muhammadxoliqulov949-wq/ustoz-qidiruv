/* -------------------------------------------------------------------------- */
/* Phase 22 security / performance / scalability hardening suite.                */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the same committed migrations production uses — including the new    */
/* Phase 22 migration, whose objects are asserted to exist. Nothing is mocked.   */
/*                                                                              */
/* WHAT THIS SUITE PROVES                                                         */
/*   1. The `pg` TLS policy: deprecated `sslmode` aliases are rewritten to the   */
/*      explicitly-verifying `verify-full`; production refuses plaintext,        */
/*      `disable` and unknown modes — and no error ever contains the URL.        */
/*   2. The shipped security headers: strict in production, preview-compatible   */
/*      in development, private routes never publicly cacheable.                 */
/*   3. The durable rate limiter: budgets hold across consumes, windows expire,  */
/*      keys are isolated, refusal extends nothing, old rows are reaped.         */
/*   4. Session hygiene: cookie flags per environment, a per-user session cap,   */
/*      and expiry-only pruning.                                                 */
/*   5. Small robustness fixes: malformed media keys decode to null (404, not    */
/*      500) and unique violations are recognised structurally.                  */
/*   6. Scalability behaviour: concurrent refund submissions converge on ONE     */
/*      live row with a success answer for every caller.                         */
/*                                                                              */
/*   npm run test:phase22                                                       */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-phase22-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
// Sandbox credentials for the refund-convergence fixture. Not real, never used.
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

  const { and, eq, sql } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { DatabaseConfigError } = await import("../src/server/db/errors");
  const { normalizePostgresUrl } = await import("../src/server/db/postgres-url");
  const headersLib = await import("../src/lib/security-headers");
  const rateLimit = await import("../src/server/rate-limit");
  const sessionLib = await import("../src/server/auth/session");
  const { newId, hashToken } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const { safeJoinKeySegments } = await import("../src/server/storage/keys");
  const { errorCode, isUniqueViolation, logError } = await import("../src/server/log");
  const db = getDb();

  /* ------------------------- migration 0011 objects ------------------------ */
  console.log("\n# migration 0011_phase22_hardening");
  const indexRows = (await db.execute(
    sql`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('rate_limit_events_key_created_idx', 'sessions_expires_at_idx')`,
  )) as unknown as { rows: { indexname: string }[] };
  const indexNames = new Set((indexRows.rows ?? []).map((row) => row.indexname));
  check("rate_limit_events key index exists", indexNames.has("rate_limit_events_key_created_idx"));
  check("sessions expires_at index exists", indexNames.has("sessions_expires_at_idx"));
  // The table accepts and returns rows (proves the CHECK + identity column).
  await db.insert(schema.rateLimitEvents).values({ key: "phase22:probe", createdAt: new Date() });
  const probe = await db
    .select()
    .from(schema.rateLimitEvents)
    .where(eq(schema.rateLimitEvents.key, "phase22:probe"));
  check("rate_limit_events stores a row", probe.length === 1 && typeof probe[0]?.id === "number");
  await db.delete(schema.rateLimitEvents).where(eq(schema.rateLimitEvents.key, "phase22:probe"));

  /* ------------------------------ TLS policy ------------------------------ */
  console.log("\n# postgres TLS policy");
  const SECRET = "s3cr3t-p4ssw0rd-never-logged";
  const base = `postgresql://ustoz:${SECRET}@ep-test-123.eu-central-1.aws.neon.tech:5432/ustoz`;
  check(
    "sslmode=require is rewritten to verify-full",
    normalizePostgresUrl(`${base}?sslmode=require`, "production").connectionString.includes(
      "sslmode=verify-full",
    ),
  );
  check(
    "sslmode=prefer is rewritten to verify-full",
    normalizePostgresUrl(`${base}?sslmode=prefer`, "production").sslmode === "verify-full",
  );
  check(
    "sslmode=verify-ca is rewritten to verify-full",
    normalizePostgresUrl(`${base}?sslmode=verify-ca`, "production").sslmode === "verify-full",
  );
  check(
    "sslmode=verify-full passes through",
    normalizePostgresUrl(`${base}?sslmode=verify-full`, "production").sslmode === "verify-full",
  );
  const rewritten = normalizePostgresUrl(
    `${base}?sslmode=require&connect_timeout=10`,
    "production",
  ).connectionString;
  check(
    "the rewrite preserves host, database and other params",
    rewritten.includes("ep-test-123.eu-central-1.aws.neon.tech") &&
      rewritten.includes("/ustoz") &&
      rewritten.includes("connect_timeout=10"),
  );
  const expectConfigError = (name: string, fn: () => unknown): void => {
    try {
      fn();
      check(name, false);
    } catch (error) {
      check(name, error instanceof DatabaseConfigError && error.name === "DatabaseConfigError");
    }
  };
  expectConfigError("production refuses a missing sslmode", () =>
    normalizePostgresUrl(base, "production"),
  );
  expectConfigError("production refuses sslmode=disable", () =>
    normalizePostgresUrl(`${base}?sslmode=disable`, "production"),
  );
  expectConfigError("production refuses an unknown sslmode", () =>
    normalizePostgresUrl(`${base}?sslmode=sometimes`, "production"),
  );
  expectConfigError("a non-postgres scheme is refused", () =>
    normalizePostgresUrl("mysql://host/db?sslmode=verify-full", "production"),
  );
  check(
    "development still allows a missing sslmode (laptop postgres)",
    normalizePostgresUrl(base, "development").sslmode === null,
  );
  check(
    "development still allows sslmode=disable",
    normalizePostgresUrl(`${base}?sslmode=disable`, "development").sslmode === "disable",
  );
  check(
    "development rewrites require too (dev negotiates what prod negotiates)",
    normalizePostgresUrl(`${base}?sslmode=require`, "development").sslmode === "verify-full",
  );
  try {
    normalizePostgresUrl(`${base}?sslmode=disable`, "production");
    check("refusal errors never contain the URL", false);
  } catch (error) {
    const message = (error as Error).message;
    check(
      "refusal errors never contain the URL",
      !message.includes(SECRET) && !message.includes("neon.tech") && message.includes("DATABASE_URL"),
    );
  }

  /* ---------------------------- security headers --------------------------- */
  console.log("\n# security headers");
  const prodCsp = headersLib.buildContentSecurityPolicy(true);
  const devCsp = headersLib.buildContentSecurityPolicy(false);
  check("production CSP forbids all framing", prodCsp.includes("frame-ancestors 'none'"));
  check(
    "development CSP permits the sandbox preview host",
    devCsp.includes("https://*.e2b.app") && !devCsp.includes("frame-ancestors 'none'"),
  );
  check("production CSP has no unsafe-eval", !prodCsp.includes("unsafe-eval"));
  check("development CSP allows unsafe-eval for HMR", devCsp.includes("unsafe-eval"));
  check(
    "production CSP upgrades insecure requests",
    prodCsp.includes("upgrade-insecure-requests") && !devCsp.includes("upgrade-insecure-requests"),
  );
  check("CSP pins form targets to self + payme", prodCsp.includes("form-action 'self' https://checkout.paycom.uz https://checkout.test.paycom.uz"));
  check("CSP blocks plugins and base-tag injection", prodCsp.includes("object-src 'none'") && prodCsp.includes("base-uri 'self'"));
  check("CSP serves images from self + https + data + blob", prodCsp.includes("img-src 'self' https: data: blob:"));

  const prodHeaders = headersLib.buildGlobalSecurityHeaders(true);
  const prodByKey = new Map(prodHeaders.map((h) => [h.key, h.value]));
  check("nosniff is set", prodByKey.get("X-Content-Type-Options") === "nosniff");
  check(
    "referrer policy is strict-origin-when-cross-origin",
    prodByKey.get("Referrer-Policy") === "strict-origin-when-cross-origin",
  );
  check(
    "permissions policy disables sensors + payment API",
    prodByKey.get("Permissions-Policy") === "camera=(), microphone=(), geolocation=(), payment=()",
  );
  check("COOP is same-origin", prodByKey.get("Cross-Origin-Opener-Policy") === "same-origin");
  check("production sends X-Frame-Options DENY", prodByKey.get("X-Frame-Options") === "DENY");
  check(
    "production sends HSTS with subdomains",
    (prodByKey.get("Strict-Transport-Security") ?? "").includes("includeSubDomains"),
  );
  const devByKey = new Map(headersLib.buildGlobalSecurityHeaders(false).map((h) => [h.key, h.value]));
  check("development omits X-Frame-Options (preview iframe)", !devByKey.has("X-Frame-Options"));
  check("development omits HSTS (plain http)", !devByKey.has("Strict-Transport-Security"));

  const rules = headersLib.buildHeaderRules(true);
  check("a global rule covers every route", rules.some((r) => r.source === "/:path*"));
  const noStoreSources = rules
    .filter((r) => r.headers.some((h) => h.key === "Cache-Control" && h.value === "no-store"))
    .map((r) => r.source);
  for (const source of [
    "/dashboard",
    "/dashboard/:path*",
    "/teacher/dashboard",
    "/teacher/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/notifications",
    "/enroll/:path*",
  ]) {
    check(`private route ${source} is no-store`, noStoreSources.includes(source));
  }

  /* --------------------------- rate-limit helpers -------------------------- */
  console.log("\n# rate-limit keys + client IP");
  check(
    "keys join name + identifiers",
    rateLimit.rateLimitKey("login:phone", "+998901112233") === "login:phone:+998901112233",
  );
  check(
    "keys strip hostile characters",
    rateLimit.rateLimitKey("x", "a:b\nc d\te%f") === "x:a_b_c_d_e%f",
  );
  check(
    "keys are capped at the database CHECK length",
    rateLimit.rateLimitKey("x", "a".repeat(500)).length <= 200,
  );
  check(
    "client IP is the first forwarded-for entry",
    rateLimit.parseClientIp("203.0.113.7, 70.41.3.18", null) === "203.0.113.7",
  );
  check(
    "x-real-ip is the fallback",
    rateLimit.parseClientIp(null, "2001:db8::1") === "2001:db8::1",
  );
  check("missing headers yield null", rateLimit.parseClientIp(null, null) === null);
  check("garbage is not an IP", rateLimit.parseClientIp("evil.example.com", null) === null);
  check("an overlong value is not an IP", rateLimit.parseClientIp("1".repeat(65), null) === null);
  check(
    "headers() outside a request yields null (identity-only limiting)",
    (await rateLimit.requestClientIp()) === null,
  );
  const policies = Object.values(rateLimit.RATE_LIMIT_POLICIES);
  check(
    "every policy has a positive limit and window",
    policies.length > 0 && policies.every((p) => p.limit > 0 && p.windowSeconds > 0),
  );
  check("the refusal copy is generic (no budget disclosed)", !/\d/.test(rateLimit.RATE_LIMITED_MESSAGE));

  /* ------------------------------ limiter (DB) ----------------------------- */
  console.log("\n# durable limiter behaviour");
  const tiny = { name: "phase22:tiny", limit: 3, windowSeconds: 60 };
  const keyA = rateLimit.rateLimitKey(tiny.name, "victim-a");
  const t0 = Date.now();
  const d1 = await rateLimit.consumeRateLimit(tiny, keyA, { nowMs: t0 });
  const d2 = await rateLimit.consumeRateLimit(tiny, keyA, { nowMs: t0 + 1000 });
  const d3 = await rateLimit.consumeRateLimit(tiny, keyA, { nowMs: t0 + 2000 });
  check("attempts under the limit are allowed", d1.allowed && d2.allowed && d3.allowed);
  check("remaining counts down", d1.remaining === 2 && d2.remaining === 1 && d3.remaining === 0);
  const blocked = await rateLimit.consumeRateLimit(tiny, keyA, { nowMs: t0 + 3000 });
  check("the attempt past the limit is refused", !blocked.allowed && blocked.remaining === 0);
  const rowsAfterBlock = await db
    .select()
    .from(schema.rateLimitEvents)
    .where(eq(schema.rateLimitEvents.key, keyA));
  check("a refused attempt records nothing (no self-extending block)", rowsAfterBlock.length === 3);
  const keyB = rateLimit.rateLimitKey(tiny.name, "victim-b");
  check(
    "another key has its own budget",
    (await rateLimit.consumeRateLimit(tiny, keyB, { nowMs: t0 + 3000 })).allowed,
  );
  // Past the window: all three rows (t0..t0+2s, 60 s window) are expired.
  const afterExpiry = await rateLimit.consumeRateLimit(tiny, keyA, { nowMs: t0 + 63_000 });
  check(
    "the window expiring restores the FULL budget",
    afterExpiry.allowed && afterExpiry.remaining === 2,
  );
  const rowsAfterExpiry = await db
    .select()
    .from(schema.rateLimitEvents)
    .where(eq(schema.rateLimitEvents.key, keyA));
  check("expired rows are deleted on consume (hot keys stay small)", rowsAfterExpiry.length === 1);

  const multi = await rateLimit.consumeRateLimits([
    { policy: tiny, key: rateLimit.rateLimitKey(tiny.name, "multi") },
    { policy: tiny, key: rateLimit.rateLimitKey(tiny.name, "multi") },
  ]);
  check("multi-consume allows when every bucket allows", multi.allowed);
  await rateLimit.consumeRateLimit(tiny, rateLimit.rateLimitKey(tiny.name, "multi"), { nowMs: t0 });
  await rateLimit.consumeRateLimit(tiny, rateLimit.rateLimitKey(tiny.name, "multi"), { nowMs: t0 });
  const multiBlocked = await rateLimit.consumeRateLimits([
    { policy: tiny, key: rateLimit.rateLimitKey(tiny.name, "multi-fresh") },
    { policy: tiny, key: rateLimit.rateLimitKey(tiny.name, "multi") },
  ]);
  check("multi-consume stops at the first refusing bucket", !multiBlocked.allowed);

  // Sweep: ancient rows die, live rows survive.
  const ancient = rateLimit.rateLimitKey("phase22:sweep", "ancient");
  const live = rateLimit.rateLimitKey("phase22:sweep", "live");
  const now = new Date();
  await db.insert(schema.rateLimitEvents).values({
    key: ancient,
    createdAt: new Date(now.getTime() - 25 * 3600 * 1000),
  });
  await db.insert(schema.rateLimitEvents).values({ key: live, createdAt: now });
  const swept = await rateLimit.sweepExpired(now);
  check("the sweep reports what it reaped", swept >= 1);
  const ancientLeft = await db
    .select()
    .from(schema.rateLimitEvents)
    .where(eq(schema.rateLimitEvents.key, ancient));
  const liveLeft = await db
    .select()
    .from(schema.rateLimitEvents)
    .where(eq(schema.rateLimitEvents.key, live));
  check("rows older than any window are reaped", ancientLeft.length === 0);
  check("live rows survive the sweep", liveLeft.length === 1);

  /* ------------------------------- sessions -------------------------------- */
  console.log("\n# session hygiene");
  const expiry = new Date("2030-01-01T00:00:00Z");
  const prodFlags = sessionLib.sessionCookieOptions(expiry, { insecureCookies: false, production: true });
  check("production cookies are HttpOnly", prodFlags.httpOnly === true);
  check("production cookies are SameSite=Lax", prodFlags.sameSite === "lax");
  check("production cookies are Path=/", prodFlags.path === "/");
  check("production cookies are Secure", prodFlags.secure === true);
  check("the expiry passes through", prodFlags.expires === expiry);
  check(
    "development cookies are not Secure",
    sessionLib.sessionCookieOptions(expiry, { insecureCookies: false, production: false }).secure === false,
  );
  check(
    "the insecure flag drops Secure even in production",
    sessionLib.sessionCookieOptions(expiry, { insecureCookies: true, production: true }).secure === false,
  );

  const passwordHash = await hashPassword("phase22-session-test");
  const sessionUser = newId("usr");
  const otherUser = newId("usr");
  await db.insert(schema.users).values({ id: sessionUser, role: "student", phone: "+998901112233", passwordHash });
  await db.insert(schema.users).values({ id: otherUser, role: "student", phone: "+998901112244", passwordHash });
  for (let i = 0; i < 12; i += 1) {
    await db.insert(schema.sessions).values({
      id: `ses-phase22-${String(i).padStart(2, "0")}`,
      tokenHash: hashToken(`phase22-token-${i}`),
      userId: sessionUser,
      createdAt: new Date(t0 + i * 1000),
      expiresAt: new Date(t0 + 30 * 24 * 3600 * 1000),
    });
  }
  const otherSessionId = newId("ses");
  await db.insert(schema.sessions).values({
    id: otherSessionId,
    tokenHash: hashToken("phase22-other-token"),
    userId: otherUser,
    expiresAt: new Date(t0 + 30 * 24 * 3600 * 1000),
  });
  const revoked = await sessionLib.enforceSessionCap(sessionUser);
  check("overflow sessions are revoked", revoked === 2);
  const kept = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, sessionUser));
  check("the cap keeps exactly MAX_SESSIONS_PER_USER", kept.length === sessionLib.MAX_SESSIONS_PER_USER);
  const keptIds = new Set(kept.map((row) => row.id));
  check(
    "the NEWEST sessions survive the cap",
    keptIds.has("ses-phase22-11") && keptIds.has("ses-phase22-10") && !keptIds.has("ses-phase22-00"),
  );
  check(
    "other users are untouched by the cap",
    (await sessionLib.enforceSessionCap(otherUser)) === 0 &&
      (await db.select().from(schema.sessions).where(eq(schema.sessions.userId, otherUser))).length === 1,
  );

  const expiredId = newId("ses");
  await db.insert(schema.sessions).values({
    id: expiredId,
    tokenHash: hashToken("phase22-expired-token"),
    userId: sessionUser,
    expiresAt: new Date(t0 - 1000),
  });
  await sessionLib.pruneExpiredSessions();
  const expiredLeft = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, expiredId));
  check("pruning deletes expired rows", expiredLeft.length === 0);
  check(
    "pruning keeps live rows",
    (await db.select().from(schema.sessions).where(eq(schema.sessions.userId, sessionUser))).length ===
      sessionLib.MAX_SESSIONS_PER_USER,
  );

  /* ------------------------- small robustness fixes ------------------------ */
  console.log("\n# robustness helpers");
  check(
    "well-formed segments join to a key",
    safeJoinKeySegments(["public", "course-covers", "a.jpg"]) === "public/course-covers/a.jpg",
  );
  check("percent-encoded segments decode", safeJoinKeySegments(["public", "a%20b.jpg"]) === "public/a b.jpg");
  check("malformed percent-encoding yields null (404, not 500)", safeJoinKeySegments(["public", "%E0%A4%A"]) === null);
  check("a unique violation is recognised", isUniqueViolation({ code: "23505" }) === true);
  check("other codes are not unique violations", isUniqueViolation({ code: "23503" }) === false);
  check("a missing code is not a unique violation", isUniqueViolation({}) === false);
  check("errorCode reads codes", errorCode({ code: "22P02" }) === "22P02");
  check("errorCode degrades to unknown", errorCode(null) === "unknown" && errorCode({}) === "unknown");

  // logError carries scope + code + whitelisted extras — never the message.
  const lines: string[] = [];
  const originalError = console.error;
  console.error = ((...args: unknown[]) => {
    lines.push(JSON.stringify(args));
  }) as typeof console.error;
  try {
    logError("phase22-scope", new Error("contains TOP-SECRET-TOKEN payload"), { attempt: 3 });
  } finally {
    console.error = originalError;
  }
  check("logError logs the scope", lines.some((line) => line.includes("phase22-scope")));
  check("logError logs whitelisted extras", lines.some((line) => line.includes("attempt")));
  check("logError never logs the thrown message", !lines.some((line) => line.includes("TOP-SECRET-TOKEN")));

  /* --------------------- concurrent refund convergence --------------------- */
  console.log("\n# concurrent refund convergence");
  const refunds = await import("../src/server/refund-service");
  const payments = await import("../src/server/payments/payment-service");
  const adapter = await import("../src/server/payments/payme-adapter");

  const teacherId = newId("usr");
  await db.insert(schema.users).values({ id: teacherId, role: "teacher", phone: "+998901113300", passwordHash });
  await db.insert(schema.teacherProfiles).values({
    userId: teacherId,
    slug: "ustoz-phase22",
    name: "Ustoz Phase22",
    bio: "B".repeat(60),
    city: "toshkent",
  });
  const courseId = newId("crs");
  await db.insert(schema.courses).values({
    id: courseId,
    slug: "kurs-phase22",
    teacherUserId: teacherId,
    title: "Kurs Phase22",
    categoryId: "ielts",
    level: "orta",
    format: "online",
    priceUzs: 150_000,
    summary: "S".repeat(60),
    status: "published",
    publishedAt: "2026-01-15",
  });
  const groupId = newId("grp");
  await db.insert(schema.courseGroups).values({
    id: groupId,
    courseId,
    title: "A guruhi",
    days: ["Du"],
    startTime: "18:00",
    capacity: 4,
    startDate: "2026-10-05",
  });
  const studentId = newId("usr");
  await db.insert(schema.users).values({ id: studentId, role: "student", phone: "+998901113311", passwordHash });
  await db.insert(schema.studentProfiles).values({ userId: studentId, name: "O‘quvchi Phase22" });
  const enrollmentId = newId("enr");
  await db.insert(schema.enrollmentRequests).values({
    id: enrollmentId,
    studentUserId: studentId,
    courseId,
    groupId,
    status: "accepted",
  });
  const obligation = await payments.ensurePaymentForEnrollment(enrollmentId, studentId);
  if (!obligation.ok) throw new Error("fixture failure: payment obligation missing");
  const txId = `payme-tx-phase22-${Date.now()}`;
  await adapter.handlePaymeRequest({
    id: 1,
    method: "CreateTransaction",
    params: { id: txId, time: Date.now(), amount: 15_000_000, account: { payment_id: obligation.payment.id } },
  });
  await adapter.handlePaymeRequest({ id: 2, method: "PerformTransaction", params: { id: txId } });

  const racers = await Promise.all([
    refunds.requestRefund({ enrollmentRequestId: enrollmentId, studentUserId: studentId, reason: "birinchi bosish" }),
    refunds.requestRefund({ enrollmentRequestId: enrollmentId, studentUserId: studentId, reason: "ikkinchi bosish" }),
    refunds.requestRefund({ enrollmentRequestId: enrollmentId, studentUserId: studentId, reason: "uchinchi bosish" }),
  ]);
  check("simultaneous refund submits all answer successfully", racers.every((r) => r.ok));
  const ids = new Set(racers.filter((r) => r.ok).map((r) => r.ok && r.data.refundRequestId));
  check("…and they converge on ONE live row", ids.size === 1);
  const liveRows = await db
    .select()
    .from(schema.refundRequests)
    .where(
      and(
        eq(schema.refundRequests.enrollmentRequestId, enrollmentId),
        eq(schema.refundRequests.status, "requested"),
      ),
    );
  check("…with exactly one row in the database", liveRows.length === 1);

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
