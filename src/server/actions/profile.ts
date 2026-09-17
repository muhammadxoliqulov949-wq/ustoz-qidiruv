"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { AuthError, requireRole } from "../auth/guards";
import {
  fieldErrorsFrom,
  studentProfileSchema,
  type ActionResult,
} from "../validation";
import { saveTeacherProfile, teacherProfileFormCandidate } from "../profile-service";

/* -------------------------------------------------------------------------- */
/* Profile / onboarding persistence — Phase 11.                                */
/*                                                                              */
/* AUTHORIZATION: the row is selected by `eq(userId, session.user.id)`. There   */
/* is no userId parameter on any of these actions, so "edit someone else's      */
/* profile" is not an access-control check that could be forgotten — it is an   */
/* operation the API cannot express. Role is likewise taken from the session,   */
/* never from the payload (and `.strict()` rejects a payload that tries).       */
/*                                                                              */
/* `verification` is intentionally NOT writable here: a teacher cannot verify   */
/* themselves, and no Phase 11 code path sets 'verified'.                       */
/* -------------------------------------------------------------------------- */

function toResult(error: unknown): ActionResult {
  if (error instanceof AuthError) {
    return { ok: false, code: error.code, message: error.message };
  }
  console.error("profile action failed", {
    code: (error as { code?: string }).code ?? "unknown",
  });
  return { ok: false, code: "server_error", message: "Saqlanmadi. Keyinroq urinib ko‘ring." };
}

export async function saveStudentProfileAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("student");
    const parsed = studentProfileSchema.safeParse({
      name: String(form.get("name") ?? ""),
      city: form.get("city") === "" || form.get("city") === null ? null : String(form.get("city")),
      preferredFormat:
        form.get("preferredFormat") === "" || form.get("preferredFormat") === null
          ? null
          : String(form.get("preferredFormat")),
      languages: form.getAll("languages").map(String),
      interests: form.getAll("interests").map(String),
      onboardingCompleted: form.get("onboardingCompleted") === "1",
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
    await db
      .update(schema.studentProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.studentProfiles.userId, user.id));
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function saveTeacherProfileAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    /*
     * Identity from the session, values from the form. The write lives in
     * profile-service so the verification suite can prove the persisted fields
     * are the ones verification reads; the schema there is `.strict()`, so a
     * payload carrying `verification`, `slug`, `photo` or a user id is rejected
     * rather than applied.
     */
    return await saveTeacherProfile(user.id, teacherProfileFormCandidate(form));
  } catch (error) {
    return toResult(error);
  }
}
