"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { hashPassword } from "../auth/password";
import {
  authenticateAdminEmail,
  authenticateMarketplaceEmail,
  authenticatePhone,
} from "../auth/credentials";
import { createSession, destroySession, maybePruneExpiredSessions } from "../auth/session";
import { newId } from "../auth/ids";
import { parseSafeNext } from "@/lib/safe-next";
import {
  adminLoginSchema,
  emailLoginSchema,
  emailRegisterSchema,
  fieldErrorsFrom,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  type ActionResult,
} from "../validation";
import { slugifyName, uniqueTeacherSlug } from "../slug";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMITED_MESSAGE,
  consumeRateLimits,
  rateLimitKey,
  requestClientIp,
  type RateLimitCheck,
} from "../rate-limit";
import {
  buildVerificationUrl,
  createVerificationToken,
} from "../auth/verification";
import { getEmailProvider } from "../email/provider";
import { maskEmail } from "@/lib/email";

/* -------------------------------------------------------------------------- */
/* Auth server actions — Phase 11.                                             */
/*                                                                              */
/* Server Actions (not route handlers) are the mutation surface: Next.js gives  */
/* them built-in CSRF protection (POST + Origin/Host check + unguessable action */
/* id), so no hand-rolled token is needed and no public JSON endpoint is        */
/* exposed for credentials.                                                     */
/*                                                                              */
/* Honesty: there is no SMS/OTP provider, so registration is phone + password   */
/* with argon2id. Nothing pretends a code was sent, there is no hard-coded      */
/* code and there is no bypass account.                                         */
/*                                                                              */
/* TWO LOGIN ACTIONS, TWO IDENTIFIER KINDS.                                     */
/*   loginAction      — phone + password: students, teachers, and the operator  */
/*                      accounts bootstrapped by `admin:create`.                */
/*   adminLoginAction — email + password: operator accounts created by          */
/*                      `admin:create-email`. It can only ever sign in an       */
/*                      `admin` row (see auth/credentials.ts).                  */
/* Both are AUTHENTICATION only. There is still no action, route or page that   */
/* can CREATE an operator account or grant the admin role: the only writer of   */
/* `users.role = 'admin'` remains the server-only CLI in scripts/admin.ts.      */
/* -------------------------------------------------------------------------- */

function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/* -------------------------------------------------------------------------- */
/* Phase 22 abuse protection. Every credential attempt spends from a durable,  */
/* Postgres-backed budget BEFORE any argon2id work runs, so a login flood      */
/* cannot burn CPU/memory on hashing. The per-identifier bucket stops          */
/* credential stuffing against one account; the per-IP bucket stops broad      */
/* spraying. A refusal is the same generic shape as any other failure.         */
/* -------------------------------------------------------------------------- */

function rateLimited(): ActionResult {
  return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
}

async function consumeAuthLimits(checks: RateLimitCheck[]): Promise<boolean> {
  const decision = await consumeRateLimits(checks);
  return decision.allowed;
}

export async function registerAction(form: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    role: formValue(form, "role"),
    name: formValue(form, "name"),
    phone: formValue(form, "phone"),
    password: formValue(form, "password"),
    next: form.get("next") === null ? null : formValue(form, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { role, name, phone, password } = parsed.data;

  const registerIp = await requestClientIp();
  const registerAllowed = await consumeAuthLimits([
    { policy: RATE_LIMIT_POLICIES.registerByPhone, key: rateLimitKey("register:phone", phone) },
    ...(registerIp
      ? [{ policy: RATE_LIMIT_POLICIES.registerByIp, key: rateLimitKey("register:ip", registerIp) }]
      : []),
  ]);
  if (!registerAllowed) return rateLimited();

  const db = getDb();

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      code: "duplicate_phone",
      message: "Bu raqam bilan hisob allaqachon mavjud. Kirishga urinib ko‘ring.",
      fieldErrors: { phone: "Bu raqam band." },
    };
  }

  const userId = newId("usr");
  const passwordHash = await hashPassword(password);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({ id: userId, role, phone, passwordHash });
      if (role === "student") {
        await tx.insert(schema.studentProfiles).values({
          userId,
          role: "student",
          name,
          languages: [],
          interests: [],
          onboardingCompleted: false,
        });
      } else {
        const slug = await uniqueTeacherSlug(tx, slugifyName(name));
        await tx.insert(schema.teacherProfiles).values({
          userId,
          role: "teacher",
          slug,
          name,
          categories: [],
          levels: [],
          formats: [],
          languages: [],
          // Explicitly unverified — no auto-verification anywhere.
          verification: "unverified",
          onboardingCompleted: false,
        });
      }
    });
  } catch (error) {
    console.error("registerAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return {
      ok: false,
      code: "server_error",
      message: "Hisob yaratilmadi. Keyinroq qayta urinib ko‘ring.",
    };
  }

  await createSession(userId);
  redirect(parseSafeNext(parsed.data.next ?? undefined) ?? "/onboarding");
}

/* -------------------------------------------------------------------------- */
/* Email + Password Registration — Phase 23.5.                                */
/*                                                                              */
/* Creates an unverified student or teacher account, stores an expiring         */
/* single-use verification token hash, and sends an activation email.           */
/* An authenticated session is NOT issued until email ownership is proven.      */
/* -------------------------------------------------------------------------- */
export async function registerEmailAction(form: FormData): Promise<ActionResult> {
  const parsed = emailRegisterSchema.safeParse({
    role: formValue(form, "role"),
    name: formValue(form, "name"),
    email: formValue(form, "email"),
    password: formValue(form, "password"),
    confirmPassword: formValue(form, "confirmPassword"),
    next: form.get("next") === null ? null : formValue(form, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { role, name, email, password } = parsed.data;

  const registerIp = await requestClientIp();
  const registerAllowed = await consumeAuthLimits([
    { policy: RATE_LIMIT_POLICIES.registerByEmail, key: rateLimitKey("register:email", email) },
    ...(registerIp
      ? [{ policy: RATE_LIMIT_POLICIES.registerByIp, key: rateLimitKey("register:ip", registerIp) }]
      : []),
  ]);
  if (!registerAllowed) return rateLimited();

  const db = getDb();

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return {
      ok: false,
      code: "duplicate_email",
      message: "Bu email bilan hisob allaqachon mavjud. Kirishga urinib ko‘ring.",
      fieldErrors: { email: "Bu email band." },
    };
  }

  const userId = newId("usr");
  const passwordHash = await hashPassword(password);
  let rawToken = "";

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        role,
        email,
        phone: null,
        passwordHash,
        emailVerifiedAt: null,
      });

      if (role === "student") {
        await tx.insert(schema.studentProfiles).values({
          userId,
          role: "student",
          name,
          languages: [],
          interests: [],
          onboardingCompleted: false,
        });
      } else {
        const slug = await uniqueTeacherSlug(tx, slugifyName(name));
        await tx.insert(schema.teacherProfiles).values({
          userId,
          role: "teacher",
          slug,
          name,
          categories: [],
          levels: [],
          formats: [],
          languages: [],
          verification: "unverified",
          onboardingCompleted: false,
        });
      }

      rawToken = await createVerificationToken(userId, email, tx);
    });
  } catch (error) {
    console.error("registerEmailAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return {
      ok: false,
      code: "server_error",
      message: "Hisob yaratilmadi. Keyinroq qayta urinib ko‘ring.",
    };
  }

  // Dispatch email verification link (never throws, returns delivery status)
  const verifyUrl = buildVerificationUrl(rawToken);
  await getEmailProvider().sendVerificationEmail(email, { name, verifyUrl });

  // No session is minted. Direct the user to the verification holding page.
  redirect(`/verify-email?sent=1&email=${encodeURIComponent(maskEmail(email))}`);
}

/* -------------------------------------------------------------------------- */
/* Email + Password Marketplace Login — Phase 23.5.                            */
/*                                                                              */
/* Authenticates students and teachers who use email identifiers.               */
/* Refuses unverified email accounts until verification succeeds.               */
/* -------------------------------------------------------------------------- */
export async function loginEmailAction(form: FormData): Promise<ActionResult> {
  const parsed = emailLoginSchema.safeParse({
    email: formValue(form, "email"),
    password: formValue(form, "password"),
    next: form.get("next") === null ? null : formValue(form, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const loginIp = await requestClientIp();
  const loginAllowed = await consumeAuthLimits([
    {
      policy: RATE_LIMIT_POLICIES.loginByEmail,
      key: rateLimitKey("login:email", parsed.data.email),
    },
    ...(loginIp
      ? [{ policy: RATE_LIMIT_POLICIES.authByIp, key: rateLimitKey("auth:ip", loginIp) }]
      : []),
  ]);
  if (!loginAllowed) return rateLimited();

  const authenticated = await authenticateMarketplaceEmail(
    parsed.data.email,
    parsed.data.password,
  );

  if (!authenticated.ok) {
    if (authenticated.code === "unverified_email") {
      return {
        ok: false,
        code: "unverified_email",
        message:
          "Email manzilingiz hali tasdiqlanmagan. Iltimos, pochtangizga yuborilgan tasdiqlash havolasini bosing yoki quyida qayta yuborishni so‘rang.",
        fieldErrors: { email: "Email tasdiqlanmagan." },
      };
    }
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Email yoki parol noto‘g‘ri.",
    };
  }

  await createSession(authenticated.id);
  void maybePruneExpiredSessions();

  const next = parseSafeNext(parsed.data.next ?? undefined);
  const home =
    authenticated.role === "teacher"
      ? "/teacher/dashboard"
      : "/dashboard";
  redirect(next ?? home);
}

/* -------------------------------------------------------------------------- */
/* Resend Email Verification — Phase 23.5.                                    */
/*                                                                              */
/* Rate-limited: 60s cooldown per address, 5 per day. Generic response prevents */
/* account enumeration.                                                         */
/* -------------------------------------------------------------------------- */
export async function resendVerificationAction(form: FormData): Promise<ActionResult> {
  const parsed = resendVerificationSchema.safeParse({
    email: formValue(form, "email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "To‘g‘ri email manzilini kiriting.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { email } = parsed.data;
  const clientIp = await requestClientIp();

  const cooldownDecision = await consumeRateLimits([
    {
      policy: RATE_LIMIT_POLICIES.verifyResendCooldown,
      key: rateLimitKey("verify:cooldown", email),
    },
  ]);
  if (!cooldownDecision.allowed) {
    return {
      ok: false,
      code: "cooldown",
      message: "Iltimos, qayta yuborishdan oldin 60 soniya kuting.",
    };
  }

  const dailyAllowed = await consumeAuthLimits([
    {
      policy: RATE_LIMIT_POLICIES.verifyResendDaily,
      key: rateLimitKey("verify:daily", email),
    },
    ...(clientIp
      ? [{ policy: RATE_LIMIT_POLICIES.verifyByIp, key: rateLimitKey("verify:ip", clientIp) }]
      : []),
  ]);
  if (!dailyAllowed) {
    return {
      ok: false,
      code: "daily_limit",
      message: "Kunlik yuborish limitiga yetdingiz. Iltimos, ertaga qayta urinib ko‘ring.",
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      accountStatus: schema.users.accountStatus,
    })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), eq(schema.users.accountStatus, "active")))
    .limit(1);

  const user = rows[0];
  if (user && !user.emailVerifiedAt && user.role !== "admin") {
    let name = "Foydalanuvchi";
    if (user.role === "student") {
      const student = await db
        .select({ name: schema.studentProfiles.name })
        .from(schema.studentProfiles)
        .where(eq(schema.studentProfiles.userId, user.id))
        .limit(1);
      if (student[0]?.name) name = student[0].name;
    } else if (user.role === "teacher") {
      const teacher = await db
        .select({ name: schema.teacherProfiles.name })
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, user.id))
        .limit(1);
      if (teacher[0]?.name) name = teacher[0].name;
    }

    const rawToken = await createVerificationToken(user.id, user.email!);
    const verifyUrl = buildVerificationUrl(rawToken);
    await getEmailProvider().sendVerificationEmail(user.email!, { name, verifyUrl });
  }

  // Generic message: no account enumeration
  return {
    ok: true,
    message: "Agar ushbu email bilan tasdiqlanmagan hisob mavjud bo‘lsa, tasdiqlash xati yuborildi.",
  };
}

export async function loginAction(form: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    phone: formValue(form, "phone"),
    password: formValue(form, "password"),
    next: form.get("next") === null ? null : formValue(form, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  // Before the argon2id verification: hashing is the expensive step, and a
  // flood of attempts must be refused before it burns CPU and memory.
  const loginIp = await requestClientIp();
  const loginAllowed = await consumeAuthLimits([
    {
      policy: RATE_LIMIT_POLICIES.loginByPhone,
      key: rateLimitKey("login:phone", parsed.data.phone),
    },
    ...(loginIp
      ? [{ policy: RATE_LIMIT_POLICIES.authByIp, key: rateLimitKey("auth:ip", loginIp) }]
      : []),
  ]);
  if (!loginAllowed) return rateLimited();

  const authenticated = await authenticatePhone(parsed.data.phone, parsed.data.password);
  // Same generic message for "no such account" and "wrong password" so the
  // endpoint cannot be used to enumerate registered phone numbers.
  if (!authenticated.ok) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Raqam yoki parol noto‘g‘ri.",
    };
  }

  await createSession(authenticated.id);
  void maybePruneExpiredSessions();

  /*
   * Phase 15: each role lands in its OWN area. An admin has no student or
   * teacher profile, so sending them to /dashboard would render an empty
   * cabinet (and bounce them straight back).
   */
  const next = parseSafeNext(parsed.data.next ?? undefined);
  const home =
    authenticated.role === "admin"
      ? "/admin"
      : authenticated.role === "teacher"
        ? "/teacher/dashboard"
        : "/dashboard";
  redirect(next ?? home);
}

/**
 * Operator login — email + password.
 *
 * Separate from `loginAction` on purpose: the marketplace login above is
 * untouched, and this action cannot authenticate a student or a teacher even in
 * principle, because an email can only exist on an `admin` row (database CHECK
 * `users_email_admin_only`, re-verified in `authenticateAdminEmail`).
 *
 * It authenticates; it never creates. An operator account exists only if
 * `npm run admin:create-email` made one on the server, so this form is not a
 * registration surface and offers no link to one.
 */
export async function adminLoginAction(form: FormData): Promise<ActionResult> {
  const parsed = adminLoginSchema.safeParse({
    email: formValue(form, "email"),
    password: formValue(form, "password"),
    next: form.get("next") === null ? null : formValue(form, "next"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  // Same pre-hash throttle as the marketplace login: operator accounts are
  // the highest-value brute-force target in the system.
  const adminIp = await requestClientIp();
  const adminAllowed = await consumeAuthLimits([
    {
      policy: RATE_LIMIT_POLICIES.loginByEmail,
      key: rateLimitKey("login:email", parsed.data.email),
    },
    ...(adminIp
      ? [{ policy: RATE_LIMIT_POLICIES.authByIp, key: rateLimitKey("auth:ip", adminIp) }]
      : []),
  ]);
  if (!adminAllowed) return rateLimited();

  const authenticated = await authenticateAdminEmail(parsed.data.email, parsed.data.password);
  // One generic message for unknown address, wrong password and "that email
  // belongs to a non-operator" alike — nothing here enumerates accounts.
  if (!authenticated.ok) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Email yoki parol noto‘g‘ri.",
    };
  }

  await createSession(authenticated.id);
  void maybePruneExpiredSessions();

  // An operator has exactly one area. A ?next= target is still honoured when it
  // is an internal path; the role guards decide what that path may show.
  redirect(parseSafeNext(parsed.data.next ?? undefined) ?? "/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
