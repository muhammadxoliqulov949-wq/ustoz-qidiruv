import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { recordAdminEvent } from "./audit-service";
import type { CourseState, ModerationReviewState } from "@/lib/course-moderation";
import { courseCoverUrl } from "./file-service";

/* -------------------------------------------------------------------------- */
/* Course moderation service — Phase 15.                                       */
/*                                                                              */
/* DOMAIN STATE lives on `courses.status`; the DECISION lives on                */
/* `course_moderation_reviews`. One transaction always writes both, so a course */
/* can never be `ready` without a live review, nor `published` without an       */
/* approved one.                                                               */
/*                                                                              */
/* THE PUBLICATION RULE, ENFORCED HERE (never only in the UI):                  */
/*                                                                              */
/*   1. the caller is an admin (session role — see the action layer);           */
/*   2. the course is `ready`;                                                  */
/*   3. a live (`pending`) moderation review exists for it;                     */
/*   4. the OWNING TEACHER IS VERIFIED.                                         */
/*                                                                              */
/* Rule 4 is product policy: an unverified teacher's course stays private even  */
/* in `ready`, because the marketplace's trust claim follows the teacher. It is */
/* checked in SQL, so disabling a button changes nothing.                      */
/*                                                                              */
/* CONCURRENCY: every decision locks the review row (SELECT … FOR UPDATE) and   */
/* then re-checks that it is still `pending`. Two admins racing the same course */
/* serialise there: the first publishes, the second sees a decided review and   */
/* returns the same deterministic answer with no second audit/notification.     */
/* -------------------------------------------------------------------------- */

export type ModerationErrorCode =
  | "not_found"
  | "invalid_transition"
  | "teacher_not_verified"
  | "not_publishable"
  /** The caller's identity is not an admin account (defence in depth). */
  | "forbidden"
  | "server_error";

export type ModerationResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: ModerationErrorCode; message: string };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

type ReviewRow = typeof schema.courseModerationReviews.$inferSelect;

/* ------------------------------- projections ------------------------------- */

export interface ModerationReviewView {
  id: string;
  courseId: string;
  status: ModerationReviewState;
  submittedAt: Date;
  reviewedAt: Date | null;
  feedback: string | null;
}

function toReviewView(row: ReviewRow): ModerationReviewView {
  return {
    id: row.id,
    courseId: row.courseId,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    feedback: row.feedback,
  };
}

export interface ModerationQueueRow {
  reviewId: string;
  courseId: string;
  courseSlug: string;
  title: string;
  categoryId: string;
  format: "online" | "offline" | "hybrid";
  level: "boshlangich" | "orta" | "yuqori";
  priceUzs: number;
  status: CourseState;
  reviewStatus: ModerationReviewState;
  submittedAt: Date;
  feedback: string | null;
  teacherUserId: string;
  teacherName: string;
  teacherSlug: string;
  /** Phase 15 publication rule: an unverified owner blocks publishing. */
  teacherVerification: "unverified" | "pending" | "verified";
}

/* ---------------------------- teacher submission --------------------------- */

/**
 * Ensure a live moderation review exists for a `ready` course.
 *
 * Called from the teacher's "submit for review" action inside ITS transaction.
 * Idempotent by construction: if a `pending` review already exists, the
 * existing id is returned and nothing is written — repeated submissions cannot
 * queue duplicates (the partial unique index is the backstop).
 */
export async function ensureModerationReview(
  tx: Tx,
  input: { courseId: string; teacherUserId: string },
): Promise<{ reviewId: string; created: boolean }> {
  const existing = await tx
    .select({ id: schema.courseModerationReviews.id })
    .from(schema.courseModerationReviews)
    .where(
      and(
        eq(schema.courseModerationReviews.courseId, input.courseId),
        eq(schema.courseModerationReviews.status, "pending"),
      ),
    )
    .limit(1);
  if (existing[0]) return { reviewId: existing[0].id, created: false };

  const reviewId = newId("rev");
  await tx.insert(schema.courseModerationReviews).values({
    id: reviewId,
    courseId: input.courseId,
    submittedByTeacherUserId: input.teacherUserId,
    status: "pending",
  });
  return { reviewId, created: true };
}

/** The live review for one course, or null. Used by the teacher dashboard. */
export async function getPendingReviewForCourse(
  courseId: string,
): Promise<ModerationReviewView | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courseModerationReviews)
    .where(
      and(
        eq(schema.courseModerationReviews.courseId, courseId),
        eq(schema.courseModerationReviews.status, "pending"),
      ),
    )
    .limit(1);
  return rows[0] ? toReviewView(rows[0]) : null;
}

/* --------------------------- teacher-facing reads -------------------------- */

export interface TeacherCourseModerationState {
  courseId: string;
  status: CourseState;
  pendingReview: ModerationReviewView | null;
  /** The most recent DECISION, whatever it was — this is what teaches them. */
  latestDecision: ModerationReviewView | null;
}

/**
 * Moderation state for every course the teacher owns, keyed by course id.
 *
 * One query for the whole dashboard rather than per-course lookups, and the
 * teacher's own id is part of the SQL predicate, so this cannot read another
 * teacher's reviews.
 */
export async function getTeacherModerationStates(
  teacherUserId: string,
): Promise<Map<string, TeacherCourseModerationState>> {
  const db = getDb();
  const courseRows = await db
    .select({ id: schema.courses.id, status: schema.courses.status })
    .from(schema.courses)
    .where(eq(schema.courses.teacherUserId, teacherUserId));
  if (courseRows.length === 0) return new Map();

  const reviewRows = await db
    .select()
    .from(schema.courseModerationReviews)
    .where(eq(schema.courseModerationReviews.submittedByTeacherUserId, teacherUserId))
    .orderBy(desc(schema.courseModerationReviews.createdAt));

  const byCourse = new Map<string, TeacherCourseModerationState>();
  for (const course of courseRows) {
    byCourse.set(course.id, {
      courseId: course.id,
      status: course.status,
      pendingReview: null,
      latestDecision: null,
    });
  }
  for (const review of reviewRows) {
    const entry = byCourse.get(review.courseId);
    if (!entry) continue;
    if (review.status === "pending") {
      if (!entry.pendingReview) entry.pendingReview = toReviewView(review);
    } else if (!entry.latestDecision) {
      // Rows arrive newest first, so the first decided row is the latest.
      entry.latestDecision = toReviewView(review);
    }
  }
  return byCourse;
}

/* -------------------------------- admin reads ------------------------------ */

/** The moderation queue: oldest submission first, like the verification queue. */
export async function listModerationQueue(
  options: { status?: ModerationReviewState | "all" } = {},
): Promise<ModerationQueueRow[]> {
  const db = getDb();
  const status = options.status ?? "pending";

  return db
    .select({
      reviewId: schema.courseModerationReviews.id,
      courseId: schema.courses.id,
      courseSlug: schema.courses.slug,
      title: schema.courses.title,
      categoryId: schema.courses.categoryId,
      format: schema.courses.format,
      level: schema.courses.level,
      priceUzs: schema.courses.priceUzs,
      status: schema.courses.status,
      reviewStatus: schema.courseModerationReviews.status,
      submittedAt: schema.courseModerationReviews.submittedAt,
      feedback: schema.courseModerationReviews.feedback,
      teacherUserId: schema.courses.teacherUserId,
      teacherName: schema.teacherProfiles.name,
      teacherSlug: schema.teacherProfiles.slug,
      teacherVerification: schema.teacherProfiles.verification,
    })
    .from(schema.courseModerationReviews)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.courseModerationReviews.courseId))
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(
      status === "all" ? undefined : eq(schema.courseModerationReviews.status, status),
    )
    .orderBy(asc(schema.courseModerationReviews.submittedAt));
}

/**
 * Factual overview counts. Each number is a COUNT of real rows — there is no
 * estimate, no growth metric and no revenue figure anywhere in the admin area.
 */
export async function getModerationCounts(): Promise<{
  pendingReviews: number;
  publishedCourses: number;
}> {
  const db = getDb();
  const [pendingRows, publishedRows] = await Promise.all([
    db
      .select({ total: count(schema.courseModerationReviews.id) })
      .from(schema.courseModerationReviews)
      .where(eq(schema.courseModerationReviews.status, "pending")),
    db
      .select({ total: count(schema.courses.id) })
      .from(schema.courses)
      .where(eq(schema.courses.status, "published")),
  ]);
  return {
    pendingReviews: Number(pendingRows[0]?.total ?? 0),
    publishedCourses: Number(publishedRows[0]?.total ?? 0),
  };
}

/**
 * Managed cover, or the legacy path. Storage trouble must never take the
 * moderation queue down: the seeded image is already a valid value.
 */
async function resolveCoverQuietly(courseId: string, legacy: string | null): Promise<string | null> {
  try {
    return (await courseCoverUrl(courseId)) ?? legacy;
  } catch {
    return legacy;
  }
}

export interface CourseReviewDetail {
  review: ModerationReviewView | null;
  course: {
    id: string;
    slug: string;
    title: string;
    categoryId: string;
    level: "boshlangich" | "orta" | "yuqori";
    format: "online" | "offline" | "hybrid";
    city: string | null;
    location: string | null;
    priceUzs: number;
    pricePeriod: string;
    summary: string;
    longDescription: string;
    audience: string[];
    learningOutcomes: string[];
    teachingLanguages: string[];
    schedule: string;
    status: CourseState;
    publishedAt: string | null;
    createdAt: Date;
    /** LEGACY seed/static cover path (fallback). */
    image: string | null;
    /** PHASE 18: managed cover when one exists, else the legacy path. */
    coverUrl: string | null;
  };
  teacher: {
    userId: string;
    name: string;
    slug: string;
    verification: "unverified" | "pending" | "verified";
    isPublic: boolean;
    specialization: string | null;
    experienceYears: number | null;
  };
  groups: {
    id: string;
    title: string;
    days: string[];
    startTime: string;
    endTime: string | null;
    capacity: number;
    startDate: string;
    format: "online" | "offline" | "hybrid";
    location: string | null;
  }[];
  syllabus: { id: string; position: number; title: string; description: string; lessons: number }[];
  /** Full decision history for this course, newest first. */
  history: ModerationReviewView[];
  /** The most recent approved review, if the course was ever published. */
  approvedReview: ModerationReviewView | null;
  /** Whether the publication rule is currently satisfied (rule 4 of 4). */
  publishable: boolean;
  publishBlockedReason: string | null;
}

/**
 * Everything an admin needs to moderate ONE course — and nothing else.
 *
 * Reuses the existing course authoring shape (groups + ordered syllabus) rather
 * than inventing a second course-detail model. Deliberately absent: enrollment
 * rows, student identity, payment records and provider data. Moderating a
 * listing does not require any of them.
 */
export async function getCourseReviewDetail(
  courseId: string,
): Promise<CourseReviewDetail | null> {
  const db = getDb();
  const rows = await db
    .select({
      course: schema.courses,
      teacher: schema.teacherProfiles,
    })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(eq(schema.courses.id, courseId))
    .limit(1);
  const found = rows[0];
  if (!found) return null;

  const [groupRows, moduleRows, reviewRows] = await Promise.all([
    db
      .select()
      .from(schema.courseGroups)
      .where(eq(schema.courseGroups.courseId, courseId))
      .orderBy(asc(schema.courseGroups.startDate)),
    db
      .select()
      .from(schema.syllabusModules)
      .where(eq(schema.syllabusModules.courseId, courseId))
      .orderBy(asc(schema.syllabusModules.position)),
    db
      .select()
      .from(schema.courseModerationReviews)
      .where(eq(schema.courseModerationReviews.courseId, courseId))
      .orderBy(desc(schema.courseModerationReviews.createdAt)),
  ]);

  const history = reviewRows.map(toReviewView);
  const liveReview = history.find((review) => review.status === "pending") ?? null;
  const approvedReview = history.find((review) => review.status === "approved") ?? null;

  const course = found.course;
  const teacher = found.teacher;

  const blockedReason = (() => {
    if (course.status === "published") return "Bu kurs allaqachon e’lon qilingan.";
    if (course.status !== "ready") {
      return "Faqat “ko‘rib chiqish uchun yuborilgan” kursni e’lon qilish mumkin.";
    }
    if (!liveReview) return "Faol moderatsiya arizasi topilmadi.";
    if (teacher.verification !== "verified") {
      return "Ustoz tasdiqlanmagan — kurs e’lon qilinmaydi.";
    }
    return null;
  })();

  return {
    review: liveReview,
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      categoryId: course.categoryId,
      level: course.level,
      format: course.format,
      city: course.city,
      location: course.location,
      priceUzs: course.priceUzs,
      pricePeriod: course.pricePeriod,
      summary: course.summary,
      longDescription: course.longDescription,
      audience: course.audience,
      learningOutcomes: course.learningOutcomes,
      teachingLanguages: course.teachingLanguages,
      schedule: course.schedule,
      status: course.status,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      image: course.image,
      /*
       * PHASE 18: the moderator reviews the SAME image the marketplace will show.
       * Managed cover wins; the seeded path remains the fallback. A failure to
       * resolve storage must not break the queue, so this degrades to the legacy
       * value instead of throwing.
       */
      coverUrl: await resolveCoverQuietly(course.id, course.image),
    },
    teacher: {
      userId: teacher.userId,
      name: teacher.name,
      slug: teacher.slug,
      verification: teacher.verification,
      isPublic: teacher.isPublic,
      specialization: teacher.specialization,
      experienceYears: teacher.experienceYears,
    },
    groups: groupRows.map((group) => ({
      id: group.id,
      title: group.title,
      days: group.days,
      startTime: group.startTime,
      endTime: group.endTime,
      capacity: group.capacity,
      startDate: group.startDate,
      format: group.format,
      location: group.location,
    })),
    syllabus: moduleRows.map((module) => ({
      id: module.id,
      position: module.position,
      title: module.title,
      description: module.description,
      lessons: module.lessons,
    })),
    history,
    approvedReview,
    publishable: blockedReason === null,
    publishBlockedReason: blockedReason,
  };
}

/* ------------------------------ admin decisions ---------------------------- */

type DecideOutcome = "applied" | "already_decided" | "conflicting_decision";

interface DecideResult {
  outcome: DecideOutcome;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  teacherUserId: string;
}

/**
 * Shared transactional shape for both moderation decisions: lock the review,
 * re-read it, apply the course transition, then write exactly one audit row and
 * one notification.
 *
 * Policy values (`nextReviewStatus`, `nextCourseStatus`) are supplied by the
 * two callers, so this function contains mechanics rather than product rules.
 */
async function decideModeration(
  tx: Tx,
  input: {
    reviewId: string;
    adminUserId: string;
    nextReviewStatus: Exclude<ModerationReviewState, "pending">;
    nextCourseStatus: CourseState;
    feedback: string | null;
    /** Extra guard evaluated under the lock, before any write. */
    guard?: (context: {
      courseStatus: CourseState;
      teacherVerification: string;
    }) => ModerationResult | null;
  },
): Promise<DecideResult | ModerationResult<never> | null> {
  /*
   * 0. Re-check the REVIEWER'S ROLE inside the transaction (see the matching
   *    check in verification-service): `reviewed_by_admin_user_id` is a plain FK
   *    to `users`, so without this a caller passing a teacher's id would record
   *    that teacher as the moderator. The action layer requires an admin session
   *    already; this makes the audit trail true regardless of the caller.
   */
  const adminRows = await tx
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, input.adminUserId))
    .limit(1);
  if (adminRows[0]?.role !== "admin") {
    return {
      ok: false as const,
      code: "forbidden" as const,
      message: "Bu amal faqat administrator uchun.",
    };
  }

  // 1. Lock the review row — the serialisation point for competing admins.
  await tx.execute(
    sql`SELECT id FROM course_moderation_reviews WHERE id = ${input.reviewId} FOR UPDATE`,
  );

  const reviewRows = await tx
    .select()
    .from(schema.courseModerationReviews)
    .where(eq(schema.courseModerationReviews.id, input.reviewId))
    .limit(1);
  const review = reviewRows[0];
  if (!review) return null;

  const courseRows = await tx
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      status: schema.courses.status,
      teacherUserId: schema.courses.teacherUserId,
      verification: schema.teacherProfiles.verification,
    })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(eq(schema.courses.id, review.courseId))
    .limit(1);
  const course = courseRows[0];
  if (!course) return null;

  const base = {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    teacherUserId: course.teacherUserId,
  };

  /*
   * 2. Already decided? The SAME decision replays idempotently; a DIFFERENT one
   *    is refused so a stale tab cannot overwrite a decision already made.
   */
  if (review.status !== "pending") {
    return {
      ...base,
      outcome:
        review.status === input.nextReviewStatus ? "already_decided" : "conflicting_decision",
    };
  }

  // 3. Policy guard (publication rules), evaluated under the lock.
  if (input.guard) {
    const refusal = input.guard({
      courseStatus: course.status,
      teacherVerification: course.verification,
    });
    if (refusal) return refusal as ModerationResult<never>;
  }

  const now = new Date();

  // 4. Course transition. `published_at` is set here and never cleared.
  await tx
    .update(schema.courses)
    .set({
      status: input.nextCourseStatus,
      ...(input.nextCourseStatus === "published" ? { publishedAt: todayIsoDate() } : {}),
      updatedAt: now,
    })
    .where(eq(schema.courses.id, course.id));

  // 5. Record the decision on the review.
  await tx
    .update(schema.courseModerationReviews)
    .set({
      status: input.nextReviewStatus,
      reviewedAt: now,
      reviewedByAdminUserId: input.adminUserId,
      feedback: input.feedback,
      updatedAt: now,
    })
    .where(eq(schema.courseModerationReviews.id, input.reviewId));

  return { ...base, outcome: "applied" };
}

/** `published_at` is an ISO date string — the DB CHECK enforces the format. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Publish a submitted course.
 *
 * All four publication rules are re-checked HERE, inside the transaction that
 * holds the review lock — not in the component that rendered the button.
 */
export async function publishCourse(
  reviewId: string,
  adminUserId: string,
): Promise<ModerationResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const result = await decideModeration(tx, {
        reviewId,
        adminUserId,
        nextReviewStatus: "approved",
        nextCourseStatus: "published",
        feedback: null,
        guard: ({ courseStatus, teacherVerification }) => {
          if (courseStatus !== "ready") {
            // Includes `published`: a decided review is short-circuited above,
            // so reaching here with a live listing is an inconsistent state.
            // Refusing is correct — re-publishing would overwrite published_at.
            return {
              ok: false as const,
              code: "invalid_transition" as const,
              message:
                courseStatus === "published"
                  ? "Bu kurs allaqachon e’lon qilingan."
                  : "Kurs “ko‘rib chiqish uchun yuborilgan” holatida emas.",
            };
          }
          /*
           * THE PRODUCT RULE: an unverified teacher's course stays private.
           * Enforced in SQL-backed server code, so a disabled button is not the
           * control — this is.
           */
          if (teacherVerification !== "verified") {
            return {
              ok: false as const,
              code: "teacher_not_verified" as const,
              message: "Ustoz tasdiqlanmagan — kursni e’lon qilib bo‘lmaydi.",
            };
          }
          return null;
        },
      });

      if (result === null) {
        return { ok: false as const, code: "not_found" as const, message: "Kurs topilmadi." };
      }
      if ("ok" in result) return result;

      if (result.outcome === "conflicting_decision") {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu kurs bo‘yicha allaqachon boshqa qaror qabul qilingan.",
        };
      }
      if (result.outcome === "already_decided") {
        return { ok: true as const, data: { idempotent: true } };
      }

      await recordAdminEvent(tx, {
        adminUserId,
        action: "course_published",
        entityType: "course",
        entityId: result.courseId,
        metadata: `status=published slug=${result.courseSlug}`,
      });

      await tx.insert(schema.notifications).values({
        id: newId("ntf"),
        userId: result.teacherUserId,
        type: "course_published",
        title: "Kursingiz e’lon qilindi",
        body: `“${result.courseTitle}” endi ommaviy katalogda ko‘rinadi.`,
        href: `/courses/${result.courseSlug}`,
      });

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    console.error("publishCourse failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "E’lon qilib bo‘lmadi." };
  }
}

/**
 * Return a submitted course to the teacher with feedback.
 *
 * The course goes back to `draft` (private), the review records
 * `changes_requested`, and the teacher is told what to fix. Nothing is deleted,
 * and resubmitting is always possible — a moderation workflow that can dead-end
 * a course is worse than no workflow.
 */
export async function requestCourseChanges(
  reviewId: string,
  adminUserId: string,
  feedback: string,
): Promise<ModerationResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const result = await decideModeration(tx, {
        reviewId,
        adminUserId,
        nextReviewStatus: "changes_requested",
        nextCourseStatus: "draft",
        feedback,
        guard: ({ courseStatus }) => {
          // A live listing is never silently knocked back to draft from the
          // moderation queue: only a `ready` submission can be returned.
          if (courseStatus !== "ready") {
            return {
              ok: false as const,
              code: "invalid_transition" as const,
              message: "Faqat ko‘rib chiqish uchun yuborilgan kursni qaytarish mumkin.",
            };
          }
          return null;
        },
      });

      if (result === null) {
        return { ok: false as const, code: "not_found" as const, message: "Kurs topilmadi." };
      }
      if ("ok" in result) return result;

      if (result.outcome === "conflicting_decision") {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu kurs bo‘yicha allaqachon boshqa qaror qabul qilingan.",
        };
      }
      if (result.outcome === "already_decided") {
        return { ok: true as const, data: { idempotent: true } };
      }

      await recordAdminEvent(tx, {
        adminUserId,
        action: "course_changes_requested",
        entityType: "course",
        entityId: result.courseId,
        metadata: `status=draft slug=${result.courseSlug}`,
      });

      await tx.insert(schema.notifications).values({
        id: newId("ntf"),
        userId: result.teacherUserId,
        type: "course_changes_requested",
        title: "Kurs bo‘yicha o‘zgartirish so‘raldi",
        body: feedback,
        href: `/teacher/dashboard/courses/${result.courseId}/edit`,
      });

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    console.error("requestCourseChanges failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return { ok: false, code: "server_error", message: "Qaytarib bo‘lmadi." };
  }
}
