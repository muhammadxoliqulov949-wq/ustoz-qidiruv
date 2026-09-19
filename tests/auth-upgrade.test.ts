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
    setMockGoogleJwks,
    signOAuthState,
    verifyAndParseOAuthState,
    setMockOAuthStateSecret,
  } = await import("../src/server/auth/oauth");
  type GoogleJwk = import("../src/server/auth/oauth").GoogleJwk;
  const { parseSafeNext } = await import("../src/lib/safe-next");
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

  /* ==================== 1. GOOGLE ID TOKEN CRYPTO & CLAIMS ==================== */
  console.log("\n# 1. Google ID token cryptographic signature & claims");

  const { generateKeyPairSync, createSign } = await import("node:crypto");
  const { publicKey: testPublicKey, privateKey: testPrivateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const { privateKey: attackerPrivateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const testJwk = {
    ...testPublicKey.export({ format: "jwk" }),
    kid: "google-test-kid-1",
    alg: "RS256",
    use: "sig",
  } as GoogleJwk;

  // Inject trusted test JWK (simulating Google's certs endpoint)
  setMockGoogleJwks([testJwk]);

  function makeSignedJwt(
    payload: Record<string, unknown>,
    options: { kid?: string; alg?: string; key?: import("node:crypto").KeyObject } = {},
  ): string {
    const kid = options.kid ?? "google-test-kid-1";
    const alg = options.alg ?? "RS256";
    const header = Buffer.from(JSON.stringify({ alg, typ: "JWT", kid })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = Buffer.from(`${header}.${body}`);

    if (alg === "none") {
      return `${header}.${body}.`;
    }

    const signer = createSign("RSA-SHA256");
    signer.update(data);
    const sig = signer.sign(options.key ?? testPrivateKey).toString("base64url");
    return `${header}.${body}.${sig}`;
  }

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

  const validJwt = makeSignedJwt(validClaims);
  const validResult = await validateGoogleIdToken(validJwt, validNonce, CLIENT_ID);
  check("valid Google ID token passes cryptographic signature & validation", validResult.ok === true);

  // 1. Forged signature: tampered body
  const tamperedJwt = `${validJwt.slice(0, -10)}abcdefghij`;
  const tamperedResult = await validateGoogleIdToken(tamperedJwt, validNonce, CLIENT_ID);
  check(
    "tampered signature is cryptographically rejected",
    !tamperedResult.ok && tamperedResult.code === "invalid_signature",
  );

  // 2. Forged signature: signed by attacker key
  const forgedJwt = makeSignedJwt(validClaims, { key: attackerPrivateKey });
  const forgedResult = await validateGoogleIdToken(forgedJwt, validNonce, CLIENT_ID);
  check(
    "token signed by untrusted key is cryptographically rejected",
    !forgedResult.ok && forgedResult.code === "invalid_signature",
  );

  // 3. Algorithm restriction: alg=none rejected
  const algNoneJwt = makeSignedJwt(validClaims, { alg: "none" });
  const algNoneResult = await validateGoogleIdToken(algNoneJwt, validNonce, CLIENT_ID);
  check(
    "alg=none is rejected by algorithm restriction",
    !algNoneResult.ok && algNoneResult.code === "unsupported_algorithm",
  );

  // 4. Unknown kid rejected
  const unknownKidJwt = makeSignedJwt(validClaims, { kid: "non-existent-kid" });
  const unknownKidResult = await validateGoogleIdToken(unknownKidJwt, validNonce, CLIENT_ID);
  check(
    "unknown kid rejected against trusted JWKS",
    !unknownKidResult.ok && unknownKidResult.code === "unknown_signing_key",
  );

  // 5. Invalid issuer
  const badIssuerJwt = makeSignedJwt({ ...validClaims, iss: "https://untrusted-issuer.com" });
  const badIssuerResult = await validateGoogleIdToken(badIssuerJwt, validNonce, CLIENT_ID);
  check("wrong issuer rejected", !badIssuerResult.ok && badIssuerResult.code === "invalid_issuer");

  // 6. Invalid audience
  const badAudJwt = makeSignedJwt({ ...validClaims, aud: "wrong-client-id" });
  const badAudResult = await validateGoogleIdToken(badAudJwt, validNonce, CLIENT_ID);
  check("wrong audience rejected", !badAudResult.ok && badAudResult.code === "invalid_audience");

  // 7. Expired token
  const expiredJwt = makeSignedJwt({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 60 });
  const expiredResult = await validateGoogleIdToken(expiredJwt, validNonce, CLIENT_ID);
  check("expired ID token rejected", !expiredResult.ok && expiredResult.code === "token_expired");

  // 8. Invalid nonce
  const badNonceResult = await validateGoogleIdToken(validJwt, "wrong-nonce", CLIENT_ID);
  check("nonce mismatch rejected", !badNonceResult.ok && badNonceResult.code === "invalid_nonce");

  // 9. Unverified email
  const unverifiedEmailJwt = makeSignedJwt({ ...validClaims, email_verified: false });
  const unverifiedEmailResult = await validateGoogleIdToken(unverifiedEmailJwt, validNonce, CLIENT_ID);
  check(
    "unverified Google email rejected",
    !unverifiedEmailResult.ok && unverifiedEmailResult.code === "email_not_verified",
  );

  /* ==================== 2. OAUTH STATE COOKIE INTEGRITY ==================== */
  console.log("\n# 2. OAuth state cookie cryptographic integrity & tamper protection");

  const validOAuthPayload = {
    state: "valid-random-state-string-32-chars-long",
    nonce: "valid-random-nonce-string-32-chars-long",
    codeVerifier: "valid-pkce-verifier-string-32-chars-long",
    role: "student" as const,
    next: "/dashboard/saved",
  };

  // 1. Unsigned cookie rejection (plain JSON)
  const unsignedCookieJson = JSON.stringify(validOAuthPayload);
  const unsignedRes = verifyAndParseOAuthState(unsignedCookieJson);
  check(
    "unsigned OAuth state cookie rejected (plain JSON)",
    !unsignedRes.ok && unsignedRes.code === "unsigned_cookie",
  );

  // 2. Unsigned / malformed string rejection
  const nonV1Cookie = "legacy.nonversioned.payload";
  const nonV1Res = verifyAndParseOAuthState(nonV1Cookie);
  check(
    "unsigned OAuth state cookie rejected (missing v1 prefix)",
    !nonV1Res.ok && nonV1Res.code === "unsigned_cookie",
  );

  const malformedCookie = "v1.onlytwoparts";
  const malformedRes = verifyAndParseOAuthState(malformedCookie);
  check(
    "malformed OAuth state cookie rejected (wrong segments)",
    !malformedRes.ok && malformedRes.code === "malformed_cookie",
  );

  // Helper to tamper payload while keeping original HMAC
  const validSignedCookie = signOAuthState(validOAuthPayload);
  const [vPrefix, validPayloadB64, originalHmac] = validSignedCookie.split(".");

  function tamperPayload(mutate: (p: Record<string, unknown>) => void): string {
    const json = JSON.parse(Buffer.from(validPayloadB64, "base64url").toString("utf8"));
    mutate(json);
    const tamperedB64 = Buffer.from(JSON.stringify(json)).toString("base64url");
    return `${vPrefix}.${tamperedB64}.${originalHmac}`;
  }

  // 3. Altered state rejection
  const alteredStateCookie = tamperPayload((p) => {
    p.state = "attacker-altered-state";
  });
  const alteredStateRes = verifyAndParseOAuthState(alteredStateCookie);
  check(
    "altered state parameter rejected (invalid signature)",
    !alteredStateRes.ok && alteredStateRes.code === "invalid_signature",
  );

  // 4. Altered nonce rejection
  const alteredNonceCookie = tamperPayload((p) => {
    p.nonce = "attacker-altered-nonce";
  });
  const alteredNonceRes = verifyAndParseOAuthState(alteredNonceCookie);
  check(
    "altered nonce parameter rejected (invalid signature)",
    !alteredNonceRes.ok && alteredNonceRes.code === "invalid_signature",
  );

  // 5. Altered PKCE codeVerifier rejection
  const alteredVerifierCookie = tamperPayload((p) => {
    p.codeVerifier = "attacker-altered-verifier";
  });
  const alteredVerifierRes = verifyAndParseOAuthState(alteredVerifierCookie);
  check(
    "altered PKCE codeVerifier parameter rejected (invalid signature)",
    !alteredVerifierRes.ok && alteredVerifierRes.code === "invalid_signature",
  );

  // 6. Altered role rejection (tampered payload with original HMAC)
  const alteredRoleCookie = tamperPayload((p) => {
    p.role = "teacher";
  });
  const alteredRoleRes = verifyAndParseOAuthState(alteredRoleCookie);
  check(
    "altered role parameter rejected (invalid signature)",
    !alteredRoleRes.ok && alteredRoleRes.code === "invalid_signature",
  );

  // 7. Forged role='admin' rejection even when signed with valid secret
  const forgedAdminCookie = signOAuthState({
    ...validOAuthPayload,
    role: "admin" as unknown as "student" | "teacher",
  });
  const forgedAdminRes = verifyAndParseOAuthState(forgedAdminCookie);
  check(
    "forged role='admin' in state strictly rejected",
    !forgedAdminRes.ok && forgedAdminRes.code === "invalid_payload",
  );

  // 8. Altered next rejection
  const alteredNextCookie = tamperPayload((p) => {
    p.next = "https://evil.com/phish";
  });
  const alteredNextRes = verifyAndParseOAuthState(alteredNextCookie);
  check(
    "altered next parameter rejected (invalid signature)",
    !alteredNextRes.ok && alteredNextRes.code === "invalid_signature",
  );

  // 9. Corrupted HMAC rejection
  const corruptedHmacCookie = `${vPrefix}.${validPayloadB64}.${originalHmac.slice(0, -5)}XXXXX`;
  const corruptedHmacRes = verifyAndParseOAuthState(corruptedHmacCookie);
  check(
    "corrupted HMAC signature bytes rejected",
    !corruptedHmacRes.ok && corruptedHmacRes.code === "invalid_signature",
  );

  // 10. Untrusted/different HMAC secret rejection
  const untrustedSecretCookie = signOAuthState(
    validOAuthPayload,
    "untrusted-rogue-secret-attacker-key-32-chars",
  );
  const untrustedSecretRes = verifyAndParseOAuthState(untrustedSecretCookie);
  check(
    "OAuth state signed with untrusted secret rejected",
    !untrustedSecretRes.ok && untrustedSecretRes.code === "invalid_signature",
  );

  // 11. Expired signed state payload rejection (server-side TTL)
  const expiredCookie = signOAuthState({
    ...validOAuthPayload,
    issuedAt: Date.now() - 700 * 1000,
    expiresAt: Date.now() - 50 * 1000, // expired 50s ago
  });
  const expiredRes = verifyAndParseOAuthState(expiredCookie);
  check(
    "expired signed state payload rejected by server-side TTL",
    !expiredRes.ok && expiredRes.code === "expired_state",
  );

  // 12. Valid signed state succeeds
  const validRes = verifyAndParseOAuthState(validSignedCookie);
  check(
    "valid signed OAuth state succeeds",
    validRes.ok === true &&
      validRes.state.state === validOAuthPayload.state &&
      validRes.state.nonce === validOAuthPayload.nonce &&
      validRes.state.codeVerifier === validOAuthPayload.codeVerifier &&
      validRes.state.role === "student" &&
      validRes.state.next === "/dashboard/saved" &&
      validRes.state.expiresAt > Date.now(),
  );

  // 13. Student and teacher are the only allowed public roles
  const validTeacherSigned = signOAuthState({
    ...validOAuthPayload,
    role: "teacher",
  });
  const validTeacherRes = verifyAndParseOAuthState(validTeacherSigned);
  check(
    "role='teacher' in signed state accepted",
    validTeacherRes.ok === true && validTeacherRes.state.role === "teacher",
  );

  const invalidRoleCookie = signOAuthState({
    ...validOAuthPayload,
    role: "operator" as unknown as "student" | "teacher",
  });
  const invalidRoleRes = verifyAndParseOAuthState(invalidRoleCookie);
  check(
    "arbitrary role in signed state rejected",
    !invalidRoleRes.ok && invalidRoleRes.code === "invalid_payload",
  );

  // 14. Custom secret override via setMockOAuthStateSecret
  setMockOAuthStateSecret("mock-custom-oauth-state-secret-32-chars");
  const mockSigned = signOAuthState(validOAuthPayload);
  const mockVerified = verifyAndParseOAuthState(mockSigned);
  check(
    "setMockOAuthStateSecret overrides signing and verification secret",
    mockVerified.ok === true,
  );
  setMockOAuthStateSecret(null);

  // 15. Safe-next protection remains intact
  const safeInternal = parseSafeNext("/dashboard");
  const openRedirect1 = parseSafeNext("https://attacker.com/evil");
  const openRedirect2 = parseSafeNext("//attacker.com/evil");
  const javascriptUrl = parseSafeNext("javascript:alert(1)");
  check(
    "safe-next accepts internal paths and rejects open redirects",
    safeInternal === "/dashboard" &&
      openRedirect1 === null &&
      openRedirect2 === null &&
      javascriptUrl === null,
  );

  /* ================= 3. GOOGLE ACCOUNT RESOLUTION & LINKING ================= */
  console.log("\n# 3. Google account resolution & linking safety");

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

  /* ================= 4. EMAIL/PASSWORD & VERIFICATION ================= */
  console.log("\n# 4. Email/Password registration & verification lifecycle");

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

  /* ==================== 5. RATE LIMITING & COOLDOWNS ==================== */
  console.log("\n# 5. Rate limiting, cooldowns & email provider");

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

  /* ================= 6. DEACTIVATION & BACKWARD COMPAT ================= */
  console.log("\n# 6. Account deactivation & backward compatibility");

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
