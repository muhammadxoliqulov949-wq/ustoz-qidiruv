/* -------------------------------------------------------------------------- */
/* Phase 23.5 Authentication Upgrade test suite.                              */
/*                                                                              */
/* Tests Google OAuth/OIDC, email + password fallback, email verification      */
/* lifecycle, account linking safety, rate limiting, and backward              */
/* compatibility against a real PGlite PostgreSQL database.                    */
/*                                                                              */
/*   npm run test:auth                                                          */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-auth-upgrade-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.AUTH_EMAIL_FROM = "onboarding@resend.dev";

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

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from("mock-sig").toString("base64url");
  return `${header}.${body}.${sig}`;
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

  const { getDb, schema } = await import("../src/server/db/client");
  const { eq, and } = await import("drizzle-orm");
  const { hashPassword } = await import("../src/server/auth/password");
  const { hashToken, newId } = await import("../src/server/auth/ids");
  const {
    authenticatePhone,
    authenticateAdminEmail,
    authenticateMarketplaceEmail,
  } = await import("../src/server/auth/credentials");
  const {
    validateGoogleIdToken,
    resolveGoogleUser,
  } = await import("../src/server/auth/oauth");
  const {
    createVerificationToken,
    verifyEmailToken,
  } = await import("../src/server/auth/verification");
  const { DevEmailProvider, getEmailProvider } = await import("../src/server/email/provider");
  const {
    emailRegisterSchema,
    roleSchema,
  } = await import("../src/server/validation");
  const {
    RATE_LIMIT_POLICIES,
    consumeRateLimit,
    rateLimitKey,
  } = await import("../src/server/rate-limit");
  const { enforceSessionCap, MAX_SESSIONS_PER_USER } = await import(
    "../src/server/auth/session"
  );
  const db = getDb();

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

  /* ==================== 1. GOOGLE ID TOKEN CLAIMS ==================== */
  console.log("\n# 1. Google ID token validation & claims");

  const validNonce = "secure-nonce-123456";
  const validClaims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-10001",
    email: "student.google@example.com",
    email_verified: true,
    name: "Alisher Google",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce: validNonce,
  };

  const validJwt = makeJwt(validClaims);
  const validResult = validateGoogleIdToken(validJwt, validNonce, CLIENT_ID);
  check("valid Google ID token passes validation", validResult.ok === true);

  // Invalid issuer
  const badIssuerJwt = makeJwt({ ...validClaims, iss: "https://untrusted-issuer.com" });
  const badIssuerResult = validateGoogleIdToken(badIssuerJwt, validNonce, CLIENT_ID);
  check("wrong issuer rejected", !badIssuerResult.ok && badIssuerResult.code === "invalid_issuer");

  // Invalid audience
  const badAudJwt = makeJwt({ ...validClaims, aud: "wrong-client-id" });
  const badAudResult = validateGoogleIdToken(badAudJwt, validNonce, CLIENT_ID);
  check("wrong audience rejected", !badAudResult.ok && badAudResult.code === "invalid_audience");

  // Expired token
  const expiredJwt = makeJwt({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 60 });
  const expiredResult = validateGoogleIdToken(expiredJwt, validNonce, CLIENT_ID);
  check("expired ID token rejected", !expiredResult.ok && expiredResult.code === "token_expired");

  // Invalid nonce
  const badNonceResult = validateGoogleIdToken(validJwt, "wrong-nonce", CLIENT_ID);
  check("nonce mismatch rejected", !badNonceResult.ok && badNonceResult.code === "invalid_nonce");

  // Unverified email
  const unverifiedEmailJwt = makeJwt({ ...validClaims, email_verified: false });
  const unverifiedEmailResult = validateGoogleIdToken(unverifiedEmailJwt, validNonce, CLIENT_ID);
  check(
    "unverified Google email rejected",
    !unverifiedEmailResult.ok && unverifiedEmailResult.code === "email_not_verified",
  );

  /* ================= 2. GOOGLE ACCOUNT RESOLUTION & LINKING ================= */
  console.log("\n# 2. Google account resolution & linking safety");

  // A. Create new user via Google
  const googleUserRes = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-20001",
      email: "new.student@gmail.com",
    },
    "student",
  );

  check("new user registered via Google", googleUserRes.ok === true);
  let newGoogleUserId = "";
  if (googleUserRes.ok) {
    newGoogleUserId = googleUserRes.userId;
    check("new user assigned role student", googleUserRes.role === "student");

    const userRow = (
      await db.select().from(schema.users).where(eq(schema.users.id, newGoogleUserId))
    )[0];
    check("user has null passwordHash", userRow.passwordHash === null);
    check("user has verified email timestamp", userRow.emailVerifiedAt !== null);

    const studentRow = (
      await db
        .select()
        .from(schema.studentProfiles)
        .where(eq(schema.studentProfiles.userId, newGoogleUserId))
    )[0];
    check("student profile created with Google name", studentRow.name === "Alisher Google");

    const authAccount = (
      await db
        .select()
        .from(schema.authAccounts)
        .where(
          and(
            eq(schema.authAccounts.provider, "google"),
            eq(schema.authAccounts.providerAccountId, "google-sub-20001"),
          ),
        )
    )[0];
    check(
      "auth_accounts row created with google provider and sub",
      authAccount && authAccount.userId === newGoogleUserId,
    );
  }

  // B. Resolving existing sub returns same user
  const secondRes = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-20001",
      email: "new.student@gmail.com",
    },
    "student",
  );
  check("sub lookup resolves the same user", secondRes.ok && secondRes.userId === newGoogleUserId);

  // C. Google auth cannot change existing role
  const roleTamperRes = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-20001",
      email: "new.student@gmail.com",
    },
    "teacher", // Attacker sends teacher
  );
  check("Google auth cannot mutate existing role", roleTamperRes.ok && roleTamperRes.role === "student");

  // D. Linking to existing student by verified email
  const existingStudentPassword = await hashPassword("student-password-123");
  const existingStudentId = newId("usr");
  await db.insert(schema.users).values({
    id: existingStudentId,
    role: "student",
    email: "existing.learner@example.com",
    passwordHash: existingStudentPassword,
    accountStatus: "active",
    emailVerifiedAt: null,
  });
  await db.insert(schema.studentProfiles).values({
    userId: existingStudentId,
    role: "student",
    name: "Existing Learner",
  });

  const linkRes = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-30001",
      email: "existing.learner@example.com",
    },
    "student",
  );
  check("existing email matches and links user", linkRes.ok && linkRes.userId === existingStudentId);

  const linkedUserRow = (
    await db.select().from(schema.users).where(eq(schema.users.id, existingStudentId))
  )[0];
  check("linking marks email_verified_at", linkedUserRow.emailVerifiedAt !== null);

  const linkedAccount = (
    await db
      .select()
      .from(schema.authAccounts)
      .where(eq(schema.authAccounts.userId, existingStudentId))
  )[0];
  check("auth_accounts linked to existing user", linkedAccount.providerAccountId === "google-sub-30001");

  // E. ADMIN PROTECTION: Google cannot link or authenticate operator account
  const adminPassword = await hashPassword("admin-operator-password");
  const adminId = newId("usr");
  await db.insert(schema.users).values({
    id: adminId,
    role: "admin",
    email: "super.admin@ustoz-ops.uz",
    passwordHash: adminPassword,
    accountStatus: "active",
    emailVerifiedAt: new Date(),
  });

  const adminGoogleRes = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-40001",
      email: "super.admin@ustoz-ops.uz",
    },
    "student",
  );
  check(
    "Google OAuth matching admin email is strictly refused",
    !adminGoogleRes.ok && adminGoogleRes.code === "admin_forbidden",
  );

  // F. Duplicate provider identity collision constraint
  await rejects("auth_accounts enforces uniqueness on (provider, provider_account_id)", () =>
    db.insert(schema.authAccounts).values({
      id: newId("acc"),
      userId: existingStudentId,
      provider: "google",
      providerAccountId: "google-sub-20001", // already owned by newGoogleUserId
      providerEmail: "other@gmail.com",
    }),
  );

  /* ================= 3. EMAIL/PASSWORD & VERIFICATION ================= */
  console.log("\n# 3. Email/Password registration & verification lifecycle");

  // Input validation
  check(
    "roleSchema accepts only student and teacher",
    roleSchema.safeParse("student").success &&
      roleSchema.safeParse("teacher").success &&
      !roleSchema.safeParse("admin").success,
  );

  const validRegInput = {
    role: "teacher",
    name: "Teacher Nodira",
    email: "nodira@example.com",
    password: "securePassword123",
    confirmPassword: "securePassword123",
  };
  check("valid email registration schema passes", emailRegisterSchema.safeParse(validRegInput).success);

  const mismatchRegInput = { ...validRegInput, confirmPassword: "wrongConfirmPassword" };
  check("password mismatch rejected", !emailRegisterSchema.safeParse(mismatchRegInput).success);

  // Registration flow in DB
  const teacherId = newId("usr");
  const teacherHash = await hashPassword("securePassword123");
  await db.insert(schema.users).values({
    id: teacherId,
    role: "teacher",
    email: "nodira@example.com",
    passwordHash: teacherHash,
    emailVerifiedAt: null, // Unverified
    accountStatus: "active",
  });
  await db.insert(schema.teacherProfiles).values({
    userId: teacherId,
    role: "teacher",
    slug: "nodira-teacher",
    name: "Teacher Nodira",
    verification: "unverified",
  });

  // Block unverified email login
  const unverifiedLogin = await authenticateMarketplaceEmail("nodira@example.com", "securePassword123");
  check(
    "unverified email login blocked",
    !unverifiedLogin.ok && unverifiedLogin.code === "unverified_email",
  );

  // Mint verification token
  const rawToken = await createVerificationToken(teacherId, "nodira@example.com");
  check("raw token is valid length", rawToken.length >= 32);

  const tokenRows = await db
    .select()
    .from(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, teacherId));
  check("exactly one token row exists for user", tokenRows.length === 1);
  check("token is stored as hash, not plaintext", tokenRows[0].tokenHash === hashToken(rawToken));

  // Old token invalid after resend (issuing fresh token invalidates prior)
  const secondToken = await createVerificationToken(teacherId, "nodira@example.com");
  const tokensAfterResend = await db
    .select()
    .from(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, teacherId));
  check("prior token was deleted on resend", tokensAfterResend.length === 1);
  check(
    "old token fails verification after resend",
    !(await verifyEmailToken(rawToken)).ok,
  );

  // Verification success with current token
  const verifyResult = await verifyEmailToken(secondToken);
  check("current token verification succeeds", verifyResult.ok === true);

  const verifiedUser = (
    await db.select().from(schema.users).where(eq(schema.users.id, teacherId))
  )[0];
  check("user email_verified_at set after verification", verifiedUser.emailVerifiedAt !== null);

  const tokensAfterVerify = await db
    .select()
    .from(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, teacherId));
  check("token row deleted after single-use consumption", tokensAfterVerify.length === 0);

  // Reused token fails safely
  const reusedVerify = await verifyEmailToken(secondToken);
  check("reused token rejected safely", !reusedVerify.ok && reusedVerify.code === "invalid_token");

  // Now login succeeds
  const verifiedLogin = await authenticateMarketplaceEmail("nodira@example.com", "securePassword123");
  check(
    "login succeeds after verification",
    verifiedLogin.ok === true && verifiedLogin.id === teacherId && verifiedLogin.role === "teacher",
  );

  // Wrong password rejected
  const wrongPasswordLogin = await authenticateMarketplaceEmail("nodira@example.com", "wrong-pass");
  check(
    "wrong password rejected",
    !wrongPasswordLogin.ok && wrongPasswordLogin.code === "invalid_credentials",
  );

  // Expired token rejection
  const expiredUserId = newId("usr");
  await db.insert(schema.users).values({
    id: expiredUserId,
    role: "student",
    email: "expired@example.com",
    passwordHash: teacherHash,
    emailVerifiedAt: null,
    accountStatus: "active",
  });
  const expiredRawToken = "expired-token-1234567890123456";
  await db.insert(schema.emailVerificationTokens).values({
    id: newId("evt"),
    userId: expiredUserId,
    tokenHash: hashToken(expiredRawToken),
    email: "expired@example.com",
    expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
  });

  const expiredVerifyResult = await verifyEmailToken(expiredRawToken);
  check(
    "expired token rejected",
    !expiredVerifyResult.ok && expiredVerifyResult.code === "expired",
  );

  /* ==================== 4. RATE LIMITING & COOLDOWNS ==================== */
  console.log("\n# 4. Rate limiting, cooldowns & email provider");

  const testEmail = "throttle@example.com";
  const cooldownKey = rateLimitKey("verify:cooldown", testEmail);

  const attempt1 = await consumeRateLimit(RATE_LIMIT_POLICIES.verifyResendCooldown, cooldownKey);
  check("first resend attempt allowed", attempt1.allowed === true);

  const attempt2 = await consumeRateLimit(RATE_LIMIT_POLICIES.verifyResendCooldown, cooldownKey);
  check("second immediate resend attempt refused (60s cooldown)", attempt2.allowed === false);

  // Daily limit
  const dailyKey = rateLimitKey("verify:daily", testEmail);
  for (let i = 0; i < 5; i++) {
    await consumeRateLimit(RATE_LIMIT_POLICIES.verifyResendDaily, dailyKey);
  }
  const attempt6 = await consumeRateLimit(RATE_LIMIT_POLICIES.verifyResendDaily, dailyKey);
  check("6th resend attempt in 24h refused (max 5/day)", attempt6.allowed === false);

  // DevEmailProvider in-memory delivery
  DevEmailProvider.clear();
  const emailProvider = getEmailProvider();
  await emailProvider.sendVerificationEmail("tester@example.com", {
    name: "Tester",
    verifyUrl: "http://localhost:3000/verify-email?token=xyz",
  });
  check(
    "DevEmailProvider records sent email in-memory without network call",
    DevEmailProvider.sentEmails.length === 1 &&
      DevEmailProvider.sentEmails[0].to === "tester@example.com",
  );

  /* ================= 5. DEACTIVATION & BACKWARD COMPAT ================= */
  console.log("\n# 5. Account deactivation & backward compatibility");

  // Deactivated user blocked on all methods
  const deactUserId = newId("usr");
  const deactHash = await hashPassword("deact-pass-1234");
  await db.insert(schema.users).values({
    id: deactUserId,
    role: "student",
    phone: "+998901234999",
    email: "deactivated@example.com",
    passwordHash: deactHash,
    emailVerifiedAt: new Date(),
    accountStatus: "deactivated",
    deactivatedAt: new Date(),
  });
  await db.insert(schema.authAccounts).values({
    id: newId("acc"),
    userId: deactUserId,
    provider: "google",
    providerAccountId: "google-sub-deact",
    providerEmail: "deactivated@example.com",
  });

  check(
    "deactivated account blocked on phone login",
    (await authenticatePhone("+998901234999", "deact-pass-1234")).ok === false,
  );

  check(
    "deactivated account blocked on marketplace email login",
    (await authenticateMarketplaceEmail("deactivated@example.com", "deact-pass-1234")).ok === false,
  );

  const deactGoogle = await resolveGoogleUser(
    {
      ...validClaims,
      sub: "google-sub-deact",
      email: "deactivated@example.com",
    },
    "student",
  );
  check(
    "deactivated account blocked on Google login",
    !deactGoogle.ok && deactGoogle.code === "account_deactivated",
  );

  // Existing phone login preserved
  const phoneUserId = newId("usr");
  const phoneHash = await hashPassword("phone-only-pass");
  await db.insert(schema.users).values({
    id: phoneUserId,
    role: "student",
    phone: "+998901112299",
    email: null,
    passwordHash: phoneHash,
    accountStatus: "active",
  });

  const phoneLogin = await authenticatePhone("+998901112299", "phone-only-pass");
  check(
    "existing phone account logs in successfully without email",
    phoneLogin.ok === true && phoneLogin.id === phoneUserId,
  );

  // Admin login preserved
  const adminLogin = await authenticateAdminEmail("super.admin@ustoz-ops.uz", "admin-operator-password");
  check(
    "admin email login works as expected",
    adminLogin.ok === true && adminLogin.id === adminId && adminLogin.role === "admin",
  );

  // Admin cannot log in via marketplace email login
  const adminViaMarketplace = await authenticateMarketplaceEmail(
    "super.admin@ustoz-ops.uz",
    "admin-operator-password",
  );
  check(
    "admin cannot authenticate via marketplace email login",
    adminViaMarketplace.ok === false,
  );

  // Session creation & cap preserved
  const testSessionId = newId("ses");
  const rawSessionToken = "test-token-12345678901234567890";
  await db.insert(schema.sessions).values({
    id: testSessionId,
    tokenHash: hashToken(rawSessionToken),
    userId: phoneUserId,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });

  const userSessions = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, phoneUserId));
  check("session created in sessions table with tokenHash", userSessions.length === 1 && userSessions[0].tokenHash === hashToken(rawSessionToken));

  const capRevoked = await enforceSessionCap(phoneUserId);
  check("session cap enforced cleanly", capRevoked === 0 && userSessions.length <= MAX_SESSIONS_PER_USER);

  await raw.close();
  rmSync(DATA_DIR, { recursive: true, force: true });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error("Failures:", failures);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
