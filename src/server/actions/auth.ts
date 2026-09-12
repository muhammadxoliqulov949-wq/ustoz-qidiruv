"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, pruneExpiredSessions } from "../auth/session";
import { newId } from "../auth/ids";
import { parseSafeNext } from "@/lib/safe-next";
import {
  fieldErrorsFrom,
  loginSchema,
  registerSchema,
  type ActionResult,
} from "../validation";
import { slugifyName, uniqueTeacherSlug } from "../slug";

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
/* code and there is no bypass account.                                          */
/* -------------------------------------------------------------------------- */

function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
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

  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(eq(schema.users.phone, parsed.data.phone))
    .limit(1);

  const user = rows[0];
  // Same generic message for "no such account" and "wrong password" so the
  // endpoint cannot be used to enumerate registered phone numbers.
  const invalid: ActionResult = {
    ok: false,
    code: "invalid_credentials",
    message: "Raqam yoki parol noto‘g‘ri.",
  };
  if (!user) {
    // Equalise timing a little: still run a hash comparison against a dummy.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", parsed.data.password);
    return invalid;
  }
  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) return invalid;

  await createSession(user.id);
  void pruneExpiredSessions();

  const next = parseSafeNext(parsed.data.next ?? undefined);
  redirect(next ?? (user.role === "teacher" ? "/teacher/dashboard" : "/dashboard"));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
