import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import {
  fieldErrorsFrom,
  teacherProfileSchema,
  type ActionResult,
} from "./validation";

/* -------------------------------------------------------------------------- */
/* Teacher profile writes — the persistence half of profile editing.            */
/*                                                                              */
/* Split out of the server action for one reason: an action resolves the SESSION */
/* (it cannot be called without a request), so the write itself was untestable   */
/* and the verification suite could not prove that the fields a teacher edits    */
/* are the fields verification reads. Everything below takes the teacher id as   */
/* an explicit argument — exactly like verification-service and review-service — */
/* and the action's only job is `requireRole("teacher")` plus this call.         */
/*                                                                              */
/* WHAT IS NOT WRITABLE HERE                                                    */
/*   • `verification` — a teacher cannot verify themselves, and no code path in  */
/*     this module can even name the column;                                    */
/*   • `slug` — public URL identity, minted at registration;                     */
/*   • `photo` — managed media, written only by file-service;                    */
/*   • rating / review / student counters — derived aggregates.                  */
/* The `.strict()` schema is the enforcement: a payload carrying any of them is  */
/* REJECTED with field errors, not silently stripped.                            */
/* -------------------------------------------------------------------------- */

/**
 * FormData → the exact object `teacherProfileSchema` validates.
 *
 * Lives server-side (it is the reader for the action) but takes a plain
 * `FormData`, which is also what the browser builds with
 * `buildTeacherProfileFormData()`. The regression suite calls this on the
 * builder's output, so the encoding and the decoding are tested as one path.
 *
 * A field that is absent and a field that is empty both decode to the empty
 * value: `""` for text, `null` for city/specialization, `null` for the year.
 */
export function teacherProfileFormCandidate(form: FormData): Record<string, unknown> {
  const text = (field: string): string => {
    const value = form.get(field);
    return value === null ? "" : String(value);
  };
  const nullableText = (field: string): string | null => {
    const value = form.get(field);
    return value === null || String(value).trim() === "" ? null : String(value);
  };
  const list = (field: string): string[] => form.getAll(field).map(String);
  const experienceRaw = text("experienceYears").trim();

  return {
    name: text("name"),
    specialization: nullableText("specialization"),
    city: nullableText("city"),
    district: text("district"),
    categories: list("categories"),
    levels: list("levels"),
    formats: list("formats"),
    languages: list("languages"),
    experienceYears: experienceRaw === "" ? null : Number(experienceRaw),
    bio: text("bio"),
    approach: text("approach"),
    onboardingCompleted: form.get("onboardingCompleted") === "1",
  };
}

/**
 * Write the session teacher's profile row.
 *
 * The row is addressed by `eq(userId, teacherUserId)` — there is no other way to
 * name the subject, so "edit somebody else's profile" is not expressible. Returns
 * `not_found` when the account has no teacher profile row (an admin or a student
 * id reaching this path), rather than reporting a success that wrote nothing.
 */
export async function saveTeacherProfile(
  teacherUserId: string,
  candidate: unknown,
): Promise<ActionResult> {
  const parsed = teacherProfileSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Ma’lumotlarni tekshiring.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const db = getDb();
  const updated = await db
    .update(schema.teacherProfiles)
    // `verification`, `slug`, `photo` and the aggregate counters are not in
    // `parsed.data` at all — see the note at the top of this module.
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.teacherProfiles.userId, teacherUserId))
    // Rows come back only to count them: an update that matched no row must not
    // be reported as a saved profile.
    .returning();

  if (updated.length === 0) {
    return { ok: false, code: "not_found", message: "Profil topilmadi." };
  }
  return { ok: true };
}
