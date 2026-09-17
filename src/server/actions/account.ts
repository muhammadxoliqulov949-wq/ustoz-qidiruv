"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "../auth/guards";
import { createSession, destroySession } from "../auth/session";
import { changePassword, deactivateAccount } from "../account-service";
import {
  changePasswordSchema,
  deactivateAccountSchema,
  fieldErrorsFrom,
  type ActionResult,
} from "../validation";

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Hisob amali bajarilmadi." };
}

export async function changePasswordAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Parol ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    const result = await changePassword({
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
    if (!result.ok) return result;
    // The service revoked all sessions, including this one; mint one fresh
    // session so this browser remains signed in while other devices are out.
    await createSession(user.id);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    return failure("changePasswordAction", error);
  }
}

export async function deactivateAccountAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = deactivateAccountSchema.safeParse({
      password: String(form.get("password") ?? ""),
      confirmation: String(form.get("confirmation") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Parol va tasdiq so‘zini to‘g‘ri kiriting.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    const result = await deactivateAccount({ userId: user.id, password: parsed.data.password });
    if (!result.ok) return result;
    await destroySession();
    revalidatePath("/account");
    revalidatePath("/teachers");
    revalidatePath("/courses");
    // Redirect rather than showing a success UI under a session that no longer exists.
    redirect("/login?deactivated=1");
  } catch (error) {
    // Next's redirect throws a control-flow error and must not be converted into
    // a fake failure. Re-throw framework redirects; all other errors are safe.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
    return failure("deactivateAccountAction", error);
  }
}
