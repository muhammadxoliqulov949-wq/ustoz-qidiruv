import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { hashPassword } from "./password";
import { newId } from "./ids";
import { buildVerificationUrl, createVerificationToken } from "./verification";
import { getEmailProvider, isEmailDeliveryAvailable } from "../email/provider";
import { slugifyName, uniqueTeacherSlug } from "../slug";
import { logError } from "../log";

/* -------------------------------------------------------------------------- */
/* Email Registration & Verification Service — Phase 23.5.                     */
/*                                                                              */
/* Separated from server actions so logic can be called and verified directly   */
/* in test harnesses without Next.js request context or navigation redirects.   */
/*                                                                              */
/* ANTI-ENUMERATION GUARANTEES:                                                 */
/*   • Registration with an existing email returns identical success semantics  */
/*     as a new registration.                                                   */
/*   • Never reveals whether an existing email belongs to student, teacher,     */
/*     or admin.                                                                */
/*   • Existing accounts (passwords, profiles, roles) are NEVER mutated or       */
/*     overwritten.                                                             */
/*   • Admin accounts are strictly protected.                                   */
/*   • If an existing account is active and unverified, a fresh verification    */
/*     token is issued so legitimate users can finish signup.                   */
/* -------------------------------------------------------------------------- */

export type RegisterEmailResult =
  | { ok: true; email: string; isNew: boolean }
  | {
      ok: false;
      code: "email_service_unavailable" | "server_error";
      message: string;
    };

export async function registerEmail(input: {
  role: "student" | "teacher";
  name: string;
  email: string;
  password: string;
}): Promise<RegisterEmailResult> {
  // Fail-safe: In production, require email delivery capability (e.g. RESEND_API_KEY)
  if (!isEmailDeliveryAvailable()) {
    return {
      ok: false,
      code: "email_service_unavailable",
      message: "Email xizmati vaqtincha mavjud emas. Iltimos, keyinroq qayta urinib ko‘ring.",
    };
  }

  const db = getDb();

  const existing = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      email: schema.users.email,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      accountStatus: schema.users.accountStatus,
    })
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    // Anti-enumeration:
    // 1. Never reveal whether the email exists or what role it has (student/teacher/admin).
    // 2. Never mutate or overwrite an existing account (passwordHash, role, profiles).
    // 3. Admin accounts remain strictly protected.
    // 4. If an active, unverified marketplace user registers again, resend an activation email.
    if (user && !user.emailVerifiedAt && user.role !== "admin" && user.accountStatus === "active") {
      try {
        const rawToken = await createVerificationToken(user.id, user.email!);
        const verifyUrl = buildVerificationUrl(rawToken);
        await getEmailProvider().sendVerificationEmail(user.email!, {
          name: input.name,
          verifyUrl,
        });
      } catch (err) {
        logError("Resend on duplicate registration failed", err);
      }
    }
    // Return identical success shape without disclosing existence
    return { ok: true, email: input.email, isNew: false };
  }

  const userId = newId("usr");
  const passwordHash = await hashPassword(input.password);
  let rawToken = "";

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        role: input.role,
        email: input.email,
        phone: null,
        passwordHash,
        emailVerifiedAt: null,
      });

      if (input.role === "student") {
        await tx.insert(schema.studentProfiles).values({
          userId,
          role: "student",
          name: input.name,
          languages: [],
          interests: [],
          onboardingCompleted: false,
        });
      } else {
        const slug = await uniqueTeacherSlug(tx, slugifyName(input.name));
        await tx.insert(schema.teacherProfiles).values({
          userId,
          role: "teacher",
          slug,
          name: input.name,
          categories: [],
          levels: [],
          formats: [],
          languages: [],
          verification: "unverified",
          onboardingCompleted: false,
        });
      }

      rawToken = await createVerificationToken(userId, input.email, tx);
    });
  } catch (error) {
    logError("registerEmail failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return {
      ok: false,
      code: "server_error",
      message: "Hisob yaratilmadi. Keyinroq qayta urinib ko‘ring.",
    };
  }

  // Dispatch email verification link
  const verifyUrl = buildVerificationUrl(rawToken);
  const delivery = await getEmailProvider().sendVerificationEmail(input.email, {
    name: input.name,
    verifyUrl,
  });

  if (!delivery.success) {
    return {
      ok: false,
      code: "email_service_unavailable",
      message: "Email xizmati vaqtincha mavjud emas. Iltimos, keyinroq qayta urinib ko‘ring.",
    };
  }

  return { ok: true, email: input.email, isNew: true };
}

export type ResendVerificationServiceResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "email_service_unavailable";
      message: string;
    };

export async function resendVerification(email: string): Promise<ResendVerificationServiceResult> {
  // Fail-safe: In production, require email delivery capability (e.g. RESEND_API_KEY)
  if (!isEmailDeliveryAvailable()) {
    return {
      ok: false,
      code: "email_service_unavailable",
      message: "Email xizmati vaqtincha mavjud emas. Iltimos, keyinroq qayta urinib ko‘ring.",
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

    try {
      const rawToken = await createVerificationToken(user.id, user.email!);
      const verifyUrl = buildVerificationUrl(rawToken);
      await getEmailProvider().sendVerificationEmail(user.email!, { name, verifyUrl });
    } catch (err) {
      logError("resendVerification send failed", err);
    }
  }

  // Generic message: no account enumeration
  return {
    ok: true,
    message: "Agar ushbu email tasdiqlanmagan hisobga tegishli bo‘lsa, tasdiqlash xati yuborildi.",
  };
}
