"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "../db/client";
import { AuthError, requireRole } from "../auth/guards";
import { newId } from "../auth/ids";
import { slugifyName } from "../slug";
import {
  courseDraftUpdateSchema,
  courseGroupSchema,
  fieldErrorsFrom,
  syllabusModuleSchema,
  type ActionResult,
} from "../validation";

/* -------------------------------------------------------------------------- */
/* Server-side course management — Phase 12.                                   */
/*                                                                              */
/* SECURITY MODEL (identical in every action below)                             */
/*  1. requireRole("teacher") — anonymous users and students never get here.    */
/*  2. Zod `.strict()` parsing — unknown keys are REJECTED, so a caller cannot  */
/*     smuggle `status`, `teacherUserId`, `slug` or `ratingX10` into a write.   */
/*  3. Ownership lives in the SQL predicate (`teacher_user_id = session.id`),   */
/*     not in a remembered `if`. Another teacher's course matches zero rows, so */
/*     draft-id enumeration returns "not found" and changes nothing.            */
/*  4. Multi-row writes run in a transaction so a partial course never exists.  */
/*                                                                              */
/* STATUS IS NEVER CLIENT-SUPPLIED. The only transitions exposed are            */
/* draft → ready and ready → draft (see setCourseReadyAction). There is no      */
/* publish action: making a course public is an operator/seed concern, so a     */
/* complete draft cannot publish itself and no fake moderation is implied.      */
/* -------------------------------------------------------------------------- */

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function invalid(message: string): ActionResult {
  return { ok: false, code: "invalid_input", message };
}

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  // Never surface a raw database error to the client.
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Amal bajarilmadi." };
}

/** Refresh every surface that can show this course. */
function revalidateCourse(slug: string | null): void {
  revalidatePath("/teacher/dashboard/courses");
  revalidatePath("/courses");
  revalidatePath("/teachers");
  if (slug) revalidatePath(`/courses/${slug}`);
}

/**
 * Ownership probe. Returns the row only when the session user owns it, so the
 * caller can distinguish "missing" from "not yours" WITHOUT telling the client
 * which one it was — both map to the same `not_found` response.
 */
async function requireOwnedCourse(courseId: string, teacherUserId: string) {
  if (!ID_RE.test(courseId)) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      status: schema.courses.status,
    })
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, teacherUserId)))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------ course body ------------------------------- */

/**
 * Update the body of an owned course.
 *
 * The SLUG IS NOT TOUCHED here. A published course keeps the URL it was
 * discovered with, and a draft keeps the slug generated at creation, so links
 * never rot and a client can never claim someone else's slug.
 */
export async function updateCourseDraftAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const courseId = String(form.get("courseId") ?? "");
    const owned = await requireOwnedCourse(courseId, user.id);
    if (!owned) return { ok: false, code: "not_found", message: "Kurs topilmadi." };

    const format = String(form.get("format") ?? "");
    const cityRaw = String(form.get("city") ?? "");
    const locationRaw = String(form.get("location") ?? "");
    const parsed = courseDraftUpdateSchema.safeParse({
      title: String(form.get("title") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      level: String(form.get("level") ?? ""),
      format,
      city: format === "online" || cityRaw === "" ? null : cityRaw,
      location: format === "online" || locationRaw === "" ? null : locationRaw,
      priceUzs: Number(form.get("priceUzs") ?? 0),
      summary: String(form.get("summary") ?? ""),
      longDescription: String(form.get("longDescription") ?? ""),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Kurs ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const db = getDb();
    // Only the validated, whitelisted fields are written — the parsed object is
    // spread field by field rather than handed to the DB wholesale.
    await db
      .update(schema.courses)
      .set({
        title: parsed.data.title,
        categoryId: parsed.data.categoryId,
        level: parsed.data.level,
        format: parsed.data.format,
        city: parsed.data.city,
        location: parsed.data.location,
        priceUzs: parsed.data.priceUzs,
        summary: parsed.data.summary,
        longDescription: parsed.data.longDescription,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, user.id)));

    revalidateCourse(owned.slug);
    return { ok: true };
  } catch (error) {
    return failure("updateCourseDraftAction", error);
  }
}

/**
 * draft ⇄ ready. `ready` means "the teacher considers this finished"; it does
 * NOT make the course public, and the public queries ignore it entirely.
 */
export async function setCourseReadyAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const courseId = String(form.get("courseId") ?? "");
    const next = String(form.get("ready") ?? "") === "1" ? "ready" : "draft";
    const owned = await requireOwnedCourse(courseId, user.id);
    if (!owned) return { ok: false, code: "not_found", message: "Kurs topilmadi." };
    if (owned.status === "published") {
      // Unpublishing is not part of Phase 12; refuse rather than pretend.
      return invalid("E’lon qilingan kursning holatini bu yerdan o‘zgartirib bo‘lmaydi.");
    }

    const db = getDb();
    await db
      .update(schema.courses)
      .set({ status: next, updatedAt: new Date() })
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.teacherUserId, user.id)));
    revalidateCourse(owned.slug);
    return { ok: true };
  } catch (error) {
    return failure("setCourseReadyAction", error);
  }
}

/* --------------------------------- groups --------------------------------- */

export async function addCourseGroupAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = courseGroupSchema.safeParse({
      courseId: String(form.get("courseId") ?? ""),
      title: String(form.get("title") ?? ""),
      days: form.getAll("days").map(String),
      startTime: String(form.get("startTime") ?? ""),
      endTime: String(form.get("endTime") ?? ""),
      startDate: String(form.get("startDate") ?? ""),
      capacity: Number(form.get("capacity") ?? 0),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Guruh ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    const owned = await requireOwnedCourse(parsed.data.courseId, user.id);
    if (!owned) return { ok: false, code: "not_found", message: "Kurs topilmadi." };

    const db = getDb();
    await db.insert(schema.courseGroups).values({
      id: newId("grp"),
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      days: parsed.data.days,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      startDate: parsed.data.startDate,
      // Planned capacity only. Occupancy is never posted.
      capacity: parsed.data.capacity,
    });
    revalidateCourse(owned.slug);
    return { ok: true };
  } catch (error) {
    return failure("addCourseGroupAction", error);
  }
}

/**
 * Remove a group. The delete joins through the course so ownership is enforced
 * in SQL. A group with live enrollment requests is kept: silently dropping it
 * would orphan real student requests.
 */
export async function deleteCourseGroupAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const groupId = String(form.get("groupId") ?? "");
    if (!ID_RE.test(groupId)) return invalid("Noto‘g‘ri guruh identifikatori.");

    const db = getDb();
    const rows = await db
      .select({ id: schema.courseGroups.id, slug: schema.courses.slug })
      .from(schema.courseGroups)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.courseGroups.courseId))
      .where(and(eq(schema.courseGroups.id, groupId), eq(schema.courses.teacherUserId, user.id)))
      .limit(1);
    const found = rows[0];
    if (!found) return { ok: false, code: "not_found", message: "Guruh topilmadi." };

    const used = await db
      .select({ id: schema.enrollmentRequests.id })
      .from(schema.enrollmentRequests)
      .where(
        and(
          eq(schema.enrollmentRequests.groupId, groupId),
          eq(schema.enrollmentRequests.status, "submitted"),
        ),
      )
      .limit(1);
    if (used.length > 0) {
      return invalid("Bu guruhda yuborilgan so‘rovlar bor — avval ularni ko‘rib chiqing.");
    }

    await db.delete(schema.courseGroups).where(eq(schema.courseGroups.id, groupId));
    revalidateCourse(found.slug);
    return { ok: true };
  } catch (error) {
    return failure("deleteCourseGroupAction", error);
  }
}

/* -------------------------------- syllabus -------------------------------- */

/**
 * Append a module. Position is computed SERVER-SIDE as max(position)+1 inside
 * a transaction — the client never supplies an index, so it cannot inject a
 * module in the middle of someone's syllabus or collide with an existing slot.
 */
export async function addSyllabusModuleAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const parsed = syllabusModuleSchema.safeParse({
      courseId: String(form.get("courseId") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      lessons: Number(form.get("lessons") ?? 0),
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: "invalid_input",
        message: "Modul ma’lumotlarini tekshiring.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }
    const owned = await requireOwnedCourse(parsed.data.courseId, user.id);
    if (!owned) return { ok: false, code: "not_found", message: "Kurs topilmadi." };

    const db = getDb();
    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ position: schema.syllabusModules.position })
        .from(schema.syllabusModules)
        .where(eq(schema.syllabusModules.courseId, parsed.data.courseId))
        .orderBy(asc(schema.syllabusModules.position));
      const next = rows.length === 0 ? 1 : (rows[rows.length - 1]?.position ?? 0) + 1;
      await tx.insert(schema.syllabusModules).values({
        id: newId("mod"),
        courseId: parsed.data.courseId,
        position: next,
        title: parsed.data.title,
        description: parsed.data.description,
        lessons: parsed.data.lessons,
      });
    });

    revalidateCourse(owned.slug);
    return { ok: true };
  } catch (error) {
    return failure("addSyllabusModuleAction", error);
  }
}

/**
 * Move a module one slot up or down.
 *
 * The client sends only a module ID and a direction — never an array of
 * positions. The server reads the CURRENT order, finds the neighbour and swaps
 * the two positions inside one transaction, so concurrent edits cannot
 * interleave into a duplicated or gapped ordering.
 */
export async function moveSyllabusModuleAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const moduleId = String(form.get("moduleId") ?? "");
    const direction = String(form.get("direction") ?? "");
    if (!ID_RE.test(moduleId)) return invalid("Noto‘g‘ri modul identifikatori.");
    if (direction !== "up" && direction !== "down") return invalid("Noto‘g‘ri yo‘nalish.");

    const db = getDb();
    const rows = await db
      .select({
        id: schema.syllabusModules.id,
        courseId: schema.syllabusModules.courseId,
        slug: schema.courses.slug,
      })
      .from(schema.syllabusModules)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.syllabusModules.courseId))
      .where(and(eq(schema.syllabusModules.id, moduleId), eq(schema.courses.teacherUserId, user.id)))
      .limit(1);
    const found = rows[0];
    if (!found) return { ok: false, code: "not_found", message: "Modul topilmadi." };

    await db.transaction(async (tx) => {
      const ordered = await tx
        .select({ id: schema.syllabusModules.id, position: schema.syllabusModules.position })
        .from(schema.syllabusModules)
        .where(eq(schema.syllabusModules.courseId, found.courseId))
        .orderBy(asc(schema.syllabusModules.position));

      const index = ordered.findIndex((row) => row.id === moduleId);
      const swapWith = direction === "up" ? index - 1 : index + 1;
      const current = ordered[index];
      const neighbour = ordered[swapWith];
      // Already at the edge — nothing to do, and not an error.
      if (!current || !neighbour) return;

      // Park on a free slot ABOVE the current maximum first: `position` is
      // UNIQUE per course, so a direct swap would collide mid-transaction, and
      // a CHECK requires position >= 1, so the parking slot cannot be negative.
      const parking = (ordered[ordered.length - 1]?.position ?? 0) + 1;
      await tx
        .update(schema.syllabusModules)
        .set({ position: parking })
        .where(eq(schema.syllabusModules.id, current.id));
      await tx
        .update(schema.syllabusModules)
        .set({ position: current.position })
        .where(eq(schema.syllabusModules.id, neighbour.id));
      await tx
        .update(schema.syllabusModules)
        .set({ position: neighbour.position })
        .where(eq(schema.syllabusModules.id, current.id));
    });

    revalidateCourse(found.slug);
    return { ok: true };
  } catch (error) {
    return failure("moveSyllabusModuleAction", error);
  }
}

/** Remove a module and close the gap so positions stay 1..n. */
export async function deleteSyllabusModuleAction(form: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("teacher");
    const moduleId = String(form.get("moduleId") ?? "");
    if (!ID_RE.test(moduleId)) return invalid("Noto‘g‘ri modul identifikatori.");

    const db = getDb();
    const rows = await db
      .select({
        id: schema.syllabusModules.id,
        courseId: schema.syllabusModules.courseId,
        position: schema.syllabusModules.position,
        slug: schema.courses.slug,
      })
      .from(schema.syllabusModules)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.syllabusModules.courseId))
      .where(and(eq(schema.syllabusModules.id, moduleId), eq(schema.courses.teacherUserId, user.id)))
      .limit(1);
    const found = rows[0];
    if (!found) return { ok: false, code: "not_found", message: "Modul topilmadi." };

    await db.transaction(async (tx) => {
      await tx.delete(schema.syllabusModules).where(eq(schema.syllabusModules.id, moduleId));
      await tx
        .update(schema.syllabusModules)
        .set({ position: sql`${schema.syllabusModules.position} - 1` })
        .where(
          and(
            eq(schema.syllabusModules.courseId, found.courseId),
            sql`${schema.syllabusModules.position} > ${found.position}`,
          ),
        );
    });

    revalidateCourse(found.slug);
    return { ok: true };
  } catch (error) {
    return failure("deleteSyllabusModuleAction", error);
  }
}

/* ---------------------------------- copy ---------------------------------- */

/**
 * Copy an owned course into a NEW DRAFT.
 *
 * Guarantees:
 *  - ownership of the source is verified in SQL before anything is read;
 *  - the original row is never mutated;
 *  - the copy is always `draft`, never inherits `published`/`publishedAt`, and
 *    gets a freshly generated unique slug;
 *  - marketplace aggregates (rating, reviews, students) are NOT copied — they
 *    were earned by the original and would be fabricated on a new course;
 *  - groups copy their PLANNED capacity and schedule but no enrollment state;
 *  - the whole copy runs in one transaction, so a half-copied course cannot
 *    survive a failure.
 */
export async function copyCourseToDraftAction(
  form: FormData,
): Promise<ActionResult<{ courseId: string }>> {
  try {
    const user = await requireRole("teacher");
    const sourceId = String(form.get("courseId") ?? "");
    if (!ID_RE.test(sourceId)) return invalid("Noto‘g‘ri kurs identifikatori.");

    const db = getDb();
    const sourceRows = await db
      .select()
      .from(schema.courses)
      .where(and(eq(schema.courses.id, sourceId), eq(schema.courses.teacherUserId, user.id)))
      .limit(1);
    const source = sourceRows[0];
    if (!source) return { ok: false, code: "not_found", message: "Kurs topilmadi." };

    const newCourseId = newId("crs");
    const slug = await uniqueCourseSlug(slugifyName(`${source.title} nusxa`));

    await db.transaction(async (tx) => {
      await tx.insert(schema.courses).values({
        id: newCourseId,
        slug,
        // Owner from the SESSION, not from the source row.
        teacherUserId: user.id,
        title: `${source.title} (nusxa)`,
        categoryId: source.categoryId,
        level: source.level,
        format: source.format,
        city: source.city,
        location: source.location,
        priceUzs: source.priceUzs,
        summary: source.summary,
        longDescription: source.longDescription,
        audience: source.audience,
        learningOutcomes: source.learningOutcomes,
        teachingLanguages: source.teachingLanguages,
        schedule: source.schedule,
        // A copy always starts private, with no earned reputation and no
        // publication date.
        status: "draft",
      });

      const groups = await tx
        .select()
        .from(schema.courseGroups)
        .where(eq(schema.courseGroups.courseId, sourceId));
      for (const group of groups) {
        await tx.insert(schema.courseGroups).values({
          id: newId("grp"),
          courseId: newCourseId,
          title: group.title,
          days: group.days,
          startTime: group.startTime,
          endTime: group.endTime,
          startDate: group.startDate,
          format: group.format,
          location: group.location,
          // Planned capacity carries over; occupancy does not exist on a copy.
          capacity: group.capacity,
        });
      }

      const modules = await tx
        .select()
        .from(schema.syllabusModules)
        .where(eq(schema.syllabusModules.courseId, sourceId))
        .orderBy(asc(schema.syllabusModules.position));
      for (const item of modules) {
        await tx.insert(schema.syllabusModules).values({
          id: newId("mod"),
          courseId: newCourseId,
          position: item.position,
          title: item.title,
          description: item.description,
          lessons: item.lessons,
        });
      }
    });

    revalidatePath("/teacher/dashboard/courses");
    return { ok: true, data: { courseId: newCourseId } };
  } catch (error) {
    return failure("copyCourseToDraftAction", error);
  }
}

/** Server-generated, collision-free course slug. Clients never supply one. */
async function uniqueCourseSlug(base: string): Promise<string> {
  const db = getDb();
  const root = base === "" ? "kurs" : base;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const rows = await db
      .select({ slug: schema.courses.slug })
      .from(schema.courses)
      .where(eq(schema.courses.slug, candidate))
      .limit(1);
    if (rows.length === 0) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
