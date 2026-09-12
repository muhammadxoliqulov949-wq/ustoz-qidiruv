"use server";

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db/client";
import { AuthError, requireRole } from "../auth/guards";
import { newId } from "../auth/ids";
import { slugifyName } from "../slug";
import {
  courseDraftCreateSchema,
  fieldErrorsFrom,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Server-side course drafts — Phase 11.                                       */
/*                                                                              */
/* OWNERSHIP COMES FROM THE SESSION. `teacherUserId` is written from            */
/* `requireRole("teacher").id`; there is no teacherId input, so a teacher       */
/* cannot create or mutate a course under someone else's identity even by       */
/* forging the payload (and `.strict()` rejects the attempt outright).          */
/* Updates carry the owner in the WHERE clause, so cross-teacher writes affect  */
/* zero rows rather than relying on a remembered `if`.                          */
/*                                                                              */
/* Status stays honest: rows are created as 'draft' and the only other value    */
/* is 'ready'. There is no publish path — the public marketplace does not read  */
/* this table in Phase 11.                                                      */
/*                                                                              */
/* The Phase 10 localStorage drafts are NOT auto-migrated (see README): local   */
/* drafts remain local until an explicit user-initiated import exists.          */
/* -------------------------------------------------------------------------- */

async function uniqueCourseSlug(base: string): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const rows = await db
      .select({ slug: schema.courses.slug })
      .from(schema.courses)
      .where(eq(schema.courses.slug, candidate))
      .limit(1);
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createCourseDraftAction(
  form: FormData,
): Promise<ActionResult<{ courseId: string }>> {
  try {
    const user = await requireRole("teacher");
    const format = String(form.get("format") ?? "");
    const cityRaw = String(form.get("city") ?? "");
    const locationRaw = String(form.get("location") ?? "");
    const parsed = courseDraftCreateSchema.safeParse({
      title: String(form.get("title") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      level: String(form.get("level") ?? ""),
      format,
      city: format === "online" || cityRaw === "" ? null : cityRaw,
      location: format === "online" || locationRaw === "" ? null : locationRaw,
      priceUzs: Number(form.get("priceUzs") ?? 0),
      summary: String(form.get("summary") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Kurs ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const courseId = newId("crs");
    const slug = await uniqueCourseSlug(slugifyName(parsed.data.title));
    const db = getDb();

    await db.insert(schema.courses).values({
      id: courseId,
      slug,
      // Identity from the session — never from the client.
      teacherUserId: user.id,
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      level: parsed.data.level,
      format: parsed.data.format,
      city: parsed.data.city,
      location: parsed.data.location,
      priceUzs: parsed.data.priceUzs,
      summary: parsed.data.summary,
      status: "draft",
    });

    return { ok: true, data: { courseId } };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error("createCourseDraftAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Kurs qoralamasi saqlanmadi." };
  }
}

export async function updateCourseTitleAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const courseId = String(form.get("courseId") ?? "");
    const title = String(form.get("title") ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(courseId)) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri kurs identifikatori." };
    }
    if (title.length < 8 || title.length > 120) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Kurs nomi 8–120 belgi bo‘lsin.",
        fieldErrors: { title: "Kurs nomi 8–120 belgi bo‘lsin." },
      };
    }

    const db = getDb();
    // Ownership is part of the predicate: another teacher's course matches
    // nothing, so a cross-teacher write silently affects zero rows. We probe
    // first purely to return an honest "not found" instead of a false success.
    const owned = await db
      .select({ id: schema.courses.id })
      .from(schema.courses)
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, user.id)))
      .limit(1);
    if (owned.length === 0) {
      return { ok: false, code: "not_found", message: "Kurs topilmadi." };
    }
    await db
      .update(schema.courses)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, user.id)));
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error("updateCourseTitleAction failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Saqlanmadi." };
  }
}
