import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { newId } from "./auth/ids";
import { recordAdminEvent } from "./audit-service";
import {
  PUBLIC_REVIEW_AUTHOR_LABEL,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_BODY_MIN_LENGTH,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_REASON_MAX_LENGTH,
  REVIEW_REASON_MIN_LENGTH,
  canTransitionReview,
  normalizeReviewBody,
  type ReviewStatus,
} from "@/lib/reviews";

/* -------------------------------------------------------------------------- */
/* Review service — Phase 19.                                                  */
/*                                                                              */
/* THE ONLY WRITE PATH FOR A REVIEW, AND THE ONLY READER OF ITS AGGREGATES.      */
/* Server actions authenticate and validate; this module decides. No Drizzle in   */
/* JSX, and no page computes a rating.                                          */
/*                                                                              */
/* THREE INVARIANTS THIS MODULE EXISTS TO HOLD                                  */
/*                                                                              */
/* 1. IDENTITY IS NEVER AN INPUT. Every function takes `studentUserId` /          */
/*    `adminUserId` that the ACTION read from the session cookie. Nothing here     */
/*    accepts an author name, a role or an "on behalf of" field, and the schema's  */
/*    `.strict()` objects reject one if a caller invents it.                       */
/*                                                                              */
/* 2. EARNED, THEN MODERATED. A review is created `pending` against an ACCEPTED    */
/*    enrollment whose group has already started; only an admin decision makes it  */
/*    `published`; only `published` rows are read by any public query and only     */
/*    they feed an aggregate. Editing a published review pulls it back to          */
/*    `pending`, which removes its old value from the public numbers immediately — */
/*    an admin approved a specific text, not whatever replaces it.                 */
/*                                                                              */
/* 3. AGGREGATES ARE RECOMPUTED, NEVER INCREMENTED. `courses.rating_x10`,          */
/*    `courses.reviews_count` and the same pair on `teacher_profiles` are caches.  */
/*    Every mutation ends by recomputing them from the rows, inside the same       */
/*    transaction, under a row lock — so there is no drift to repair and no        */
/*    counter to decrement.                                                        */
/*                                                                              */
/* CONCURRENCY. Duplicate protection is the database's UNIQUE(student, course),    */
/* not a `SELECT` in the UI: two racing submissions serialise on it and exactly    */
/* one row exists. Aggregate writers lock the `courses` row and then the           */
/* `teacher_profiles` row, always in that order, so two reviews of two different   */
/* courses by the same teacher cannot deadlock.                                   */
/* -------------------------------------------------------------------------- */

export type ReviewErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  /** Not an accepted participant on a started course. Message is deliberately generic. */
  | "not_eligible"
  | "duplicate_review"
  | "invalid_input"
  | "invalid_transition"
  | "server_error";

export type ReviewResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: ReviewErrorCode; message: string };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type ReviewRow = typeof schema.courseReviews.$inferSelect;

/** Cached aggregate pair, stored x10 to keep sorting exact (45 = 4.5). */
export interface ReviewStats {
  ratingX10: number;
  reviewsCount: number;
}

/* ------------------------------- normalisation ----------------------------- */

/** Re-exported so callers of the service and of the pure contract agree. */
export { normalizeReviewBody };

export interface ReviewBodyProblem {
  code: "too_short" | "too_long";
  message: string;
}

export function reviewBodyProblem(body: string): ReviewBodyProblem | null {
  if (body.length < REVIEW_BODY_MIN_LENGTH) {
    return {
      code: "too_short",
      message: `Fikr kamida ${REVIEW_BODY_MIN_LENGTH} belgidan iborat bo‘lsin.`,
    };
  }
  if (body.length > REVIEW_BODY_MAX_LENGTH) {
    return {
      code: "too_long",
      message: `Fikr ${REVIEW_BODY_MAX_LENGTH} belgidan oshmasin.`,
    };
  }
  return null;
}

export function reviewRatingProblem(rating: number): string | null {
  if (!Number.isInteger(rating) || rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
    return `Baho ${REVIEW_RATING_MIN} dan ${REVIEW_RATING_MAX} gacha bo‘lgan butun son bo‘lsin.`;
  }
  return null;
}

/** Optional admin note: empty means "no note", otherwise it must say something. */
export function normalizeModerationReason(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed;
}

export function moderationReasonProblem(reason: string | null): string | null {
  if (reason === null) return null;
  if (reason.length < REVIEW_REASON_MIN_LENGTH) {
    return `Sabab kamida ${REVIEW_REASON_MIN_LENGTH} belgidan iborat bo‘lsin yoki bo‘sh qoldiring.`;
  }
  if (reason.length > REVIEW_REASON_MAX_LENGTH) {
    return `Sabab ${REVIEW_REASON_MAX_LENGTH} belgidan oshmasin.`;
  }
  return null;
}

/** ISO date for "has the group started?" — same convention as `published_at`. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/* --------------------------- reputation aggregation ------------------------ */

/**
 * THE canonical course aggregate.
 *
 * `reviewsCount` is the number of PUBLISHED reviews; `ratingX10` is the rounded
 * mean rating × 10 over exactly those rows. Zero published reviews means
 * `{ ratingX10: 0, reviewsCount: 0 }` — never a default, never a seed value.
 */
export async function recalculateCourseReviewStats(
  tx: Tx,
  courseId: string,
): Promise<ReviewStats> {
  const rows = await tx
    .select({
      total: sql<string>`count(*)`,
      ratingX10: sql<string>`coalesce(round(avg(${schema.courseReviews.rating}) * 10), 0)`,
    })
    .from(schema.courseReviews)
    .where(
      and(
        eq(schema.courseReviews.courseId, courseId),
        eq(schema.courseReviews.status, "published"),
      ),
    );
  const row = rows[0];
  return {
    reviewsCount: Number(row?.total ?? 0),
    ratingX10: Math.round(Number(row?.ratingX10 ?? 0)),
  };
}

/**
 * THE canonical teacher aggregate.
 *
 * Computed DIRECTLY across every published review row of every course the teacher
 * owns. It deliberately does NOT average the per-course averages: that would weight
 * a course with one review the same as a course with fifty, and a teacher's
 * reputation would move when they published a small new course. One flat mean over
 * the rows is the only weighting that is not an accident of catalogue shape.
 */
export async function recalculateTeacherReviewStats(
  tx: Tx,
  teacherUserId: string,
): Promise<ReviewStats> {
  const rows = await tx
    .select({
      total: sql<string>`count(*)`,
      ratingX10: sql<string>`coalesce(round(avg(${schema.courseReviews.rating}) * 10), 0)`,
    })
    .from(schema.courseReviews)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.courseReviews.courseId))
    .where(
      and(
        eq(schema.courses.teacherUserId, teacherUserId),
        eq(schema.courseReviews.status, "published"),
      ),
    );
  const row = rows[0];
  return {
    reviewsCount: Number(row?.total ?? 0),
    ratingX10: Math.round(Number(row?.ratingX10 ?? 0)),
  };
}

/**
 * Recompute and store BOTH aggregates for the course a review belongs to.
 *
 * Called at the end of every mutation that can change what the public sees, inside
 * the caller's transaction. It locks `courses` and then `teacher_profiles` (always
 * in that order) so concurrent review writes serialise instead of racing a
 * read-modify-write.
 */
export async function syncReviewAggregates(
  tx: Tx,
  courseId: string,
): Promise<{ course: ReviewStats; teacher: ReviewStats } | null> {
  const courseRows = await tx
    .select({ id: schema.courses.id, teacherUserId: schema.courses.teacherUserId })
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .for("update")
    .limit(1);
  const course = courseRows[0];
  if (!course) return null;

  const courseStats = await recalculateCourseReviewStats(tx, courseId);
  await tx
    .update(schema.courses)
    .set({ ratingX10: courseStats.ratingX10, reviewsCount: courseStats.reviewsCount })
    .where(eq(schema.courses.id, courseId));

  // Lock the teacher row before recomputing, so two reviews landing on two
  // different courses of the same teacher cannot overwrite each other's total.
  await tx
    .select({ userId: schema.teacherProfiles.userId })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, course.teacherUserId))
    .for("update")
    .limit(1);

  const teacherStats = await recalculateTeacherReviewStats(tx, course.teacherUserId);
  await tx
    .update(schema.teacherProfiles)
    .set({ ratingX10: teacherStats.ratingX10, reviewsCount: teacherStats.reviewsCount })
    .where(eq(schema.teacherProfiles.userId, course.teacherUserId));

  return { course: courseStats, teacher: teacherStats };
}

/* -------------------------------- eligibility ------------------------------ */

export type ReviewEligibilityReason =
  | "anonymous"
  | "not_student"
  | "course_not_public"
  /** No accepted enrollment for this course at all. */
  | "no_accepted_enrollment"
  /** Accepted, but every group starts in the future. */
  | "not_started"
  | "eligible";

export interface EligibleEnrollment {
  id: string;
  groupTitle: string;
  startDate: string;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason: ReviewEligibilityReason;
  /** Accepted enrollments on an already-started group — the honest attributions. */
  enrollments: EligibleEnrollment[];
}

const NOT_ELIGIBLE: Record<
  Exclude<ReviewEligibilityReason, "eligible">,
  { eligible: false; enrollments: EligibleEnrollment[] }
> = {
  anonymous: { eligible: false, enrollments: [] },
  not_student: { eligible: false, enrollments: [] },
  course_not_public: { eligible: false, enrollments: [] },
  no_accepted_enrollment: { eligible: false, enrollments: [] },
  not_started: { eligible: false, enrollments: [] },
};

/**
 * Can THIS session user write a review for THIS course right now?
 *
 * Every fact comes from the database: the role from `users.role`, participation
 * from an `accepted` `enrollment_requests` row owned by the session user, and
 * "has it started" from the group's own `start_date`. Nothing is taken from a form.
 *
 * It does NOT ask whether the student finished the course — the product tracks no
 * completion, so the only honest claim is "Tasdiqlangan qatnashuvchi".
 */
export async function getReviewEligibility(
  courseId: string,
  viewer: { id: string; role: "student" | "teacher" | "admin" } | null,
): Promise<ReviewEligibility> {
  if (viewer === null) return { ...NOT_ELIGIBLE.anonymous, reason: "anonymous" };
  if (viewer.role !== "student") return { ...NOT_ELIGIBLE.not_student, reason: "not_student" };

  const db = getDb();
  const courseRows = await db
    .select({ id: schema.courses.id, status: schema.courses.status })
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .limit(1);
  const course = courseRows[0];
  if (!course) return { ...NOT_ELIGIBLE.no_accepted_enrollment, reason: "no_accepted_enrollment" };
  if (course.status !== "published") {
    return { ...NOT_ELIGIBLE.course_not_public, reason: "course_not_public" };
  }

  // The session user's own accepted enrollments on this course. `studentUserId`
  // is part of the predicate, so another student's enrollment cannot be selected.
  const rows = await db
    .select({
      id: schema.enrollmentRequests.id,
      startDate: schema.courseGroups.startDate,
      groupTitle: schema.courseGroups.title,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .where(
      and(
        eq(schema.enrollmentRequests.studentUserId, viewer.id),
        eq(schema.enrollmentRequests.courseId, courseId),
        eq(schema.enrollmentRequests.status, "accepted"),
      ),
    )
    .orderBy(asc(schema.courseGroups.startDate));

  if (rows.length === 0) {
    return {
      ...NOT_ELIGIBLE.no_accepted_enrollment,
      reason: "no_accepted_enrollment",
    };
  }

  const today = todayIsoDate();
  const started = rows
    .filter((row) => row.startDate <= today)
    .map((row) => ({ id: row.id, groupTitle: row.groupTitle, startDate: row.startDate }));

  if (started.length === 0) {
    return { ...NOT_ELIGIBLE.not_started, reason: "not_started" };
  }

  return { eligible: true, reason: "eligible", enrollments: started };
}

/* ------------------------------ public reads ------------------------------- */

/**
 * The public projection of one review.
 *
 * Deliberately tiny: an id, the rating, the text, a date and a SAFE author label.
 * No user id, no name, no phone, no email, no enrollment id — a public surface
 * cannot leak what it never selected.
 */
export interface PublicReviewView {
  id: string;
  rating: number;
  body: string;
  /** ISO "YYYY-MM-DD", rendered by the existing Uzbek formatter. */
  date: string;
  /** Always the shared anonymous label — see lib/reviews.ts for why. */
  author: string;
}

function toPublicView(row: ReviewRow): PublicReviewView {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    date: row.createdAt.toISOString().slice(0, 10),
    author: PUBLIC_REVIEW_AUTHOR_LABEL,
  };
}

/**
 * Published written reviews for one course, newest first.
 *
 * `status = 'published'` is in the SQL predicate, so a pending, rejected or
 * withdrawn review is never selected — it is not "hidden by a filter", it is not
 * in the result set. There is no fixture fallback: an empty array means the
 * section renders its honest empty state.
 */
export async function listPublicCourseReviews(courseId: string): Promise<PublicReviewView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courseReviews)
    .where(
      and(
        eq(schema.courseReviews.courseId, courseId),
        eq(schema.courseReviews.status, "published"),
      ),
    )
    // Newest first, then a stable tiebreak so pagination-free lists never reorder.
    .orderBy(desc(schema.courseReviews.createdAt), desc(schema.courseReviews.id));
  return rows.map(toPublicView);
}

/** A teacher-page review carries the course it was written about. */
export interface PublicTeacherReviewView extends PublicReviewView {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
}

/**
 * Published reviews across ALL of a teacher's published courses, newest first.
 *
 * Ownership comes from `courses.teacher_user_id`, so this can never surface a
 * review of somebody else's course. Draft courses are excluded: a review written
 * while a course was live stays on the teacher's profile only if the course is
 * still public, which keeps the profile page and the course page consistent.
 */
export async function listPublicTeacherReviews(
  teacherUserId: string,
): Promise<PublicTeacherReviewView[]> {
  const db = getDb();
  const rows = await db
    .select({
      review: schema.courseReviews,
      courseId: schema.courses.id,
      courseSlug: schema.courses.slug,
      courseTitle: schema.courses.title,
    })
    .from(schema.courseReviews)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.courseReviews.courseId))
    .where(
      and(
        eq(schema.courses.teacherUserId, teacherUserId),
        eq(schema.courses.status, "published"),
        eq(schema.courseReviews.status, "published"),
      ),
    )
    .orderBy(desc(schema.courseReviews.createdAt), desc(schema.courseReviews.id));

  return rows.map((row) => ({
    ...toPublicView(row.review),
    courseId: row.courseId,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
  }));
}

/* ------------------------------ student reads ------------------------------ */

/** The student's OWN review, in full — this is the one view that is not anonymised. */
export interface OwnReviewView {
  id: string;
  courseId: string;
  enrollmentRequestId: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  moderationReason: string | null;
}

function toOwnView(row: ReviewRow): OwnReviewView {
  return {
    id: row.id,
    courseId: row.courseId,
    enrollmentRequestId: row.enrollmentRequestId,
    rating: row.rating,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    moderationReason: row.moderationReason,
  };
}

/**
 * One student's review of one course, or null. Scoped by the session user id, so
 * this cannot read another student's review.
 */
export async function getOwnReview(
  courseId: string,
  studentUserId: string,
): Promise<OwnReviewView | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.courseReviews)
    .where(
      and(
        eq(schema.courseReviews.courseId, courseId),
        eq(schema.courseReviews.studentUserId, studentUserId),
      ),
    )
    .limit(1);
  return rows[0] ? toOwnView(rows[0]) : null;
}

/**
 * Everything the course-detail reviews section needs in one call: the public list,
 * the signed-in student's own row (whatever its status) and their eligibility.
 *
 * Anonymous callers get the public list and an `anonymous` eligibility reason —
 * the page renders a sign-in note, never a fake disabled form.
 */
export interface CourseReviewContext {
  reviews: PublicReviewView[];
  eligibility: ReviewEligibility;
  own: OwnReviewView | null;
  /** Eligible AND no live review yet: the "Fikr qoldirish" case. */
  canSubmit: boolean;
}

export async function getCourseReviewContext(
  courseId: string,
  viewer: { id: string; role: "student" | "teacher" | "admin" } | null,
): Promise<CourseReviewContext> {
  // Phase 22: the three reads are independent (eligibility, the viewer's own
  // row, the published list) — issuing them together cuts the course page's
  // review latency to the slowest of the three instead of their sum.
  const [eligibility, own, reviews] = await Promise.all([
    getReviewEligibility(courseId, viewer),
    viewer !== null && viewer.role === "student"
      ? getOwnReview(courseId, viewer.id)
      : Promise.resolve(null),
    listPublicCourseReviews(courseId),
  ]);

  return {
    reviews,
    eligibility,
    own,
    // A pending or published row is live: the student edits it rather than
    // submitting a second one (the DB UNIQUE would refuse it anyway).
    canSubmit: eligibility.eligible && own === null,
  };
}

/* ------------------------------ student writes ----------------------------- */

/** Shared notification insert — always inside the deciding transaction. */
async function notify(
  tx: Tx,
  input: {
    userId: string;
    type: "review_published" | "review_rejected";
    title: string;
    body: string;
    href: string;
  },
): Promise<void> {
  await tx.insert(schema.notifications).values({
    id: newId("ntf"),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
  });
}

/**
 * The eligibility facts a WRITE needs, re-read inside the transaction.
 * Returns a refusal result instead of throwing, so the caller can answer with a
 * safe, generic message.
 */
async function assertEarned(
  tx: Tx,
  input: { courseId: string; studentUserId: string; enrollmentRequestId: string },
): Promise<{ ok: true; courseSlug: string } | { ok: false; code: ReviewErrorCode; message: string }> {
  const courseRows = await tx
    .select({ id: schema.courses.id, slug: schema.courses.slug, status: schema.courses.status })
    .from(schema.courses)
    .where(eq(schema.courses.id, input.courseId))
    .limit(1);
  const course = courseRows[0];
  if (!course || course.status !== "published") {
    return { ok: false, code: "not_found", message: "Kurs topilmadi." };
  }

  const enrollmentRows = await tx
    .select({
      id: schema.enrollmentRequests.id,
      studentUserId: schema.enrollmentRequests.studentUserId,
      courseId: schema.enrollmentRequests.courseId,
      status: schema.enrollmentRequests.status,
      startDate: schema.courseGroups.startDate,
    })
    .from(schema.enrollmentRequests)
    .innerJoin(schema.courseGroups, eq(schema.courseGroups.id, schema.enrollmentRequests.groupId))
    .where(eq(schema.enrollmentRequests.id, input.enrollmentRequestId))
    .limit(1);
  const enrollment = enrollmentRows[0];

  /*
   * ONE refusal for every ownership/state failure on purpose. Telling a caller
   * "this enrollment belongs to somebody else" versus "this enrollment was
   * rejected" versus "the group has not started" is an enumeration oracle: each
   * distinct answer confirms a guess about data they should not be able to probe.
   */
  if (
    !enrollment ||
    enrollment.studentUserId !== input.studentUserId ||
    enrollment.courseId !== input.courseId ||
    enrollment.status !== "accepted" ||
    enrollment.startDate > todayIsoDate()
  ) {
    return {
      ok: false,
      code: "not_eligible",
      message: "Bu kurs bo‘yicha fikr qoldirish huquqingiz yo‘q.",
    };
  }

  return { ok: true, courseSlug: course.slug };
}

/**
 * Create a review. Always lands as `pending` — no path in this module lets a
 * student publish their own review.
 */
export async function createReview(input: {
  /** Session identity only. Never from a form. */
  studentUserId: string;
  courseId: string;
  enrollmentRequestId: string;
  rating: number;
  body: string;
}): Promise<ReviewResult<{ id: string; status: ReviewStatus }>> {
  const body = normalizeReviewBody(input.body);
  const ratingProblem = reviewRatingProblem(input.rating);
  if (ratingProblem) return { ok: false, code: "invalid_input", message: ratingProblem };
  const bodyProblem = reviewBodyProblem(body);
  if (bodyProblem) return { ok: false, code: "invalid_input", message: bodyProblem.message };

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const earned = await assertEarned(tx, input);
      if (!earned.ok) return earned;

      // Existing row? The student must edit it, not add a second opinion. The DB
      // UNIQUE is the real guard; this check only produces a better message.
      const existing = await tx
        .select({ id: schema.courseReviews.id })
        .from(schema.courseReviews)
        .where(
          and(
            eq(schema.courseReviews.courseId, input.courseId),
            eq(schema.courseReviews.studentUserId, input.studentUserId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        return {
          ok: false as const,
          code: "duplicate_review" as const,
          message: "Bu kurs bo‘yicha fikringiz allaqachon bor. Uni tahrirlashingiz mumkin.",
        };
      }

      const id = newId("rev");
      await tx.insert(schema.courseReviews).values({
        id,
        courseId: input.courseId,
        studentUserId: input.studentUserId,
        enrollmentRequestId: input.enrollmentRequestId,
        rating: input.rating,
        body,
        status: "pending",
      });

      // A pending review changes no public number, but recomputing keeps the
      // invariant self-enforcing rather than dependent on the caller's reasoning.
      await syncReviewAggregates(tx, input.courseId);

      return { ok: true as const, data: { id, status: "pending" as ReviewStatus } };
    });
  } catch (error) {
    return writeFailure("createReview", error);
  }
}

/**
 * Edit the caller's OWN review.
 *
 * Ownership is proven by the `studentUserId` predicate on the locked row, never by
 * a value in the payload — and `course_id` / `student_user_id` are NOT in the
 * updatable set, so no request can re-point a review at another course or author.
 *
 * A review that was `published` goes BACK to `pending` and its moderation fields
 * are cleared (the DB CHECK requires both to be NULL for `pending`), so the
 * aggregate update in the same transaction removes the old value from the public
 * numbers at once.
 */
export async function updateOwnReview(input: {
  reviewId: string;
  studentUserId: string;
  rating: number;
  body: string;
}): Promise<ReviewResult<{ status: ReviewStatus }>> {
  const body = normalizeReviewBody(input.body);
  const ratingProblem = reviewRatingProblem(input.rating);
  if (ratingProblem) return { ok: false, code: "invalid_input", message: ratingProblem };
  const bodyProblem = reviewBodyProblem(body);
  if (bodyProblem) return { ok: false, code: "invalid_input", message: bodyProblem.message };

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockOwnReview(tx, input.reviewId, input.studentUserId);
      if (current === "missing") {
        return { ok: false as const, code: "not_found" as const, message: "Fikr topilmadi." };
      }
      if (current === "forbidden") {
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu fikr sizniki emas.",
        };
      }
      if (!canTransitionReview("student", current.status, "pending")) {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu holatdagi fikrni tahrirlab bo‘lmaydi.",
        };
      }

      await tx
        .update(schema.courseReviews)
        .set({
          rating: input.rating,
          body,
          status: "pending",
          moderatedAt: null,
          moderatedByAdminUserId: null,
          moderationReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.courseReviews.id, current.id));

      await syncReviewAggregates(tx, current.courseId);
      return { ok: true as const, data: { status: "pending" as ReviewStatus } };
    });
  } catch (error) {
    return writeFailure("updateOwnReview", error);
  }
}

/**
 * Withdraw the caller's OWN review.
 *
 * It is not a deletion: the row stays, so the student can resubmit and the audit
 * trail of what was once public survives. Its value leaves the public aggregates
 * in the same transaction.
 */
export async function withdrawOwnReview(input: {
  reviewId: string;
  studentUserId: string;
}): Promise<ReviewResult<{ status: ReviewStatus }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockOwnReview(tx, input.reviewId, input.studentUserId);
      if (current === "missing") {
        return { ok: false as const, code: "not_found" as const, message: "Fikr topilmadi." };
      }
      if (current === "forbidden") {
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu fikr sizniki emas.",
        };
      }
      if (!canTransitionReview("student", current.status, "withdrawn")) {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu holatdagi fikrni qaytarib olib bo‘lmaydi.",
        };
      }

      await tx
        .update(schema.courseReviews)
        .set({
          status: "withdrawn",
          moderatedAt: null,
          moderatedByAdminUserId: null,
          moderationReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.courseReviews.id, current.id));

      await syncReviewAggregates(tx, current.courseId);
      return { ok: true as const, data: { status: "withdrawn" as ReviewStatus } };
    });
  } catch (error) {
    return writeFailure("withdrawOwnReview", error);
  }
}

/**
 * Lock one review row and prove the caller owns it.
 *
 * The row is locked FIRST because it is the resource two of the student's own tabs
 * would race on; the `courses`/`teacher_profiles` locks inside
 * `syncReviewAggregates` are always taken afterwards, in a fixed order.
 */
async function lockOwnReview(
  tx: Tx,
  reviewId: string,
  studentUserId: string,
): Promise<ReviewRow | "missing" | "forbidden"> {
  await tx.execute(sql`SELECT id FROM course_reviews WHERE id = ${reviewId} FOR UPDATE`);
  const rows = await tx
    .select()
    .from(schema.courseReviews)
    .where(eq(schema.courseReviews.id, reviewId))
    .limit(1);
  const row = rows[0];
  if (!row) return "missing";
  return row.studentUserId === studentUserId ? row : "forbidden";
}

/* ------------------------------- admin writes ------------------------------ */

/**
 * Re-check the moderator's role INSIDE the transaction.
 *
 * `moderated_by_admin_user_id` is a plain FK to `users`, so without this a caller
 * that passed a teacher's id would record that teacher as the moderator — and a
 * teacher moderating reviews of their own course is exactly the abuse this phase
 * exists to prevent. The action layer requires an admin session already; this
 * makes the stored trail true regardless of the caller.
 */
async function assertAdmin(tx: Tx, adminUserId: string): Promise<boolean> {
  const rows = await tx
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, adminUserId))
    .limit(1);
  return rows[0]?.role === "admin";
}

async function lockReview(tx: Tx, reviewId: string): Promise<ReviewRow | null> {
  await tx.execute(sql`SELECT id FROM course_reviews WHERE id = ${reviewId} FOR UPDATE`);
  const rows = await tx
    .select()
    .from(schema.courseReviews)
    .where(eq(schema.courseReviews.id, reviewId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Publish a review: the only path that makes one public.
 *
 * Re-publishing an already published review is idempotent (a second admin clicking
 * the same button in a stale tab gets a success and no second audit row), while a
 * conflicting state is refused by the transition table.
 */
export async function publishReview(
  reviewId: string,
  adminUserId: string,
): Promise<ReviewResult<{ idempotent: boolean }>> {
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      if (!(await assertAdmin(tx, adminUserId))) {
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu amal faqat administrator uchun.",
        };
      }

      const current = await lockReview(tx, reviewId);
      if (!current) {
        return { ok: false as const, code: "not_found" as const, message: "Fikr topilmadi." };
      }
      if (current.status === "published") {
        return { ok: true as const, data: { idempotent: true } };
      }
      if (!canTransitionReview("admin", current.status, "published")) {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu holatdagi fikrni e’lon qilib bo‘lmaydi.",
        };
      }

      const now = new Date();
      await tx
        .update(schema.courseReviews)
        .set({
          status: "published",
          moderatedAt: now,
          moderatedByAdminUserId: adminUserId,
          moderationReason: null,
          updatedAt: now,
        })
        .where(eq(schema.courseReviews.id, current.id));

      const course = await tx
        .select({ slug: schema.courses.slug, title: schema.courses.title })
        .from(schema.courses)
        .where(eq(schema.courses.id, current.courseId))
        .limit(1);

      await recordAdminEvent(tx, {
        adminUserId,
        action: "review_published",
        entityType: "review",
        entityId: current.id,
        // Safe subset only: a course slug and a status word. No body, no student.
        metadata: `course=${course[0]?.slug ?? current.courseId} status=published`,
      });

      await notify(tx, {
        userId: current.studentUserId,
        type: "review_published",
        title: "Fikringiz e’lon qilindi",
        body: `${course[0]?.title ?? "Kurs"} bo‘yicha fikringiz sahifada ko‘rinmoqda.`,
        href: `/courses/${course[0]?.slug ?? ""}`,
      });

      // The aggregate change and the status flip commit together or not at all.
      await syncReviewAggregates(tx, current.courseId);

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    return writeFailure("publishReview", error);
  }
}

/**
 * Reject (or un-publish) a review.
 *
 * The reason is OPTIONAL: a decision is valid without prose. When a rejected review
 * was previously public, its value leaves the aggregates in the same transaction,
 * so the public number can never outlive the text behind it.
 */
export async function rejectReview(
  reviewId: string,
  adminUserId: string,
  reason: string | null,
): Promise<ReviewResult<{ idempotent: boolean }>> {
  const normalized = normalizeModerationReason(reason);
  const reasonProblem = moderationReasonProblem(normalized);
  if (reasonProblem) return { ok: false, code: "invalid_input", message: reasonProblem };

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      if (!(await assertAdmin(tx, adminUserId))) {
        return {
          ok: false as const,
          code: "forbidden" as const,
          message: "Bu amal faqat administrator uchun.",
        };
      }

      const current = await lockReview(tx, reviewId);
      if (!current) {
        return { ok: false as const, code: "not_found" as const, message: "Fikr topilmadi." };
      }
      if (current.status === "rejected") {
        return { ok: true as const, data: { idempotent: true } };
      }
      if (!canTransitionReview("admin", current.status, "rejected")) {
        return {
          ok: false as const,
          code: "invalid_transition" as const,
          message: "Bu holatdagi fikrni rad qilib bo‘lmaydi.",
        };
      }

      const now = new Date();
      await tx
        .update(schema.courseReviews)
        .set({
          status: "rejected",
          moderatedAt: now,
          moderatedByAdminUserId: adminUserId,
          moderationReason: normalized,
          updatedAt: now,
        })
        .where(eq(schema.courseReviews.id, current.id));

      const course = await tx
        .select({ slug: schema.courses.slug, title: schema.courses.title })
        .from(schema.courses)
        .where(eq(schema.courses.id, current.courseId))
        .limit(1);

      await recordAdminEvent(tx, {
        adminUserId,
        action: "review_rejected",
        entityType: "review",
        entityId: current.id,
        metadata: `course=${course[0]?.slug ?? current.courseId} status=rejected`,
      });

      await notify(tx, {
        userId: current.studentUserId,
        type: "review_rejected",
        title: "Fikringiz e’lon qilinmadi",
        body: normalized
          ? `${course[0]?.title ?? "Kurs"}: ${normalized}`
          : `${course[0]?.title ?? "Kurs"} bo‘yicha fikringiz e’lon qilinmadi.`,
        href: `/courses/${course[0]?.slug ?? ""}`,
      });

      await syncReviewAggregates(tx, current.courseId);

      return { ok: true as const, data: { idempotent: false } };
    });
  } catch (error) {
    return writeFailure("rejectReview", error);
  }
}

/* -------------------------------- admin reads ------------------------------ */

/**
 * One moderation queue row.
 *
 * The student is identified by NAME ONLY. Their phone number lives on `users` and
 * is not selected here at all — not redacted, not masked, never queried — because
 * an operator deciding whether a sentence is abuse does not need to be able to
 * call the person who wrote it.
 */
export interface AdminReviewQueueRow {
  id: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  moderatedAt: Date | null;
  moderationReason: string | null;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  studentUserId: string;
  studentName: string;
}

export async function listAdminReviewQueue(
  options: { status?: ReviewStatus | "all"; limit?: number } = {},
): Promise<AdminReviewQueueRow[]> {
  const db = getDb();
  const status = options.status ?? "pending";
  const rows = await db
    .select({
      review: schema.courseReviews,
      courseSlug: schema.courses.slug,
      courseTitle: schema.courses.title,
      studentName: schema.studentProfiles.name,
    })
    .from(schema.courseReviews)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.courseReviews.courseId))
    .innerJoin(
      schema.studentProfiles,
      eq(schema.studentProfiles.userId, schema.courseReviews.studentUserId),
    )
    .where(status === "all" ? undefined : eq(schema.courseReviews.status, status))
    // The queue is worked oldest-first, exactly like the other admin queues.
    .orderBy(asc(schema.courseReviews.createdAt), asc(schema.courseReviews.id))
    .limit(options.limit ?? 200);

  return rows.map((row) => ({
    id: row.review.id,
    rating: row.review.rating,
    body: row.review.body,
    status: row.review.status,
    createdAt: row.review.createdAt,
    updatedAt: row.review.updatedAt,
    moderatedAt: row.review.moderatedAt,
    moderationReason: row.review.moderationReason,
    courseId: row.review.courseId,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
    studentUserId: row.review.studentUserId,
    studentName: row.studentName,
  }));
}

export async function getReviewQueueCounts(): Promise<Record<ReviewStatus | "all", number>> {
  const db = getDb();
  const rows = await db
    .select({ status: schema.courseReviews.status, total: count(schema.courseReviews.id) })
    .from(schema.courseReviews)
    .groupBy(schema.courseReviews.status);
  const byStatus = new Map(rows.map((row) => [row.status, Number(row.total)]));
  const all = rows.reduce((sum, row) => sum + Number(row.total), 0);
  return {
    pending: byStatus.get("pending") ?? 0,
    published: byStatus.get("published") ?? 0,
    rejected: byStatus.get("rejected") ?? 0,
    withdrawn: byStatus.get("withdrawn") ?? 0,
    all,
  };
}

/* --------------------------------- failures -------------------------------- */

/**
 * One failure shape for every write.
 *
 * A UNIQUE violation is translated into the honest duplicate message; anything
 * else is logged WITHOUT the payload (a review body is a student's words and may
 * contain personal detail, so it never reaches a log line) and reported as a
 * generic server error.
 */
function writeFailure(scope: string, error: unknown): ReviewResult<never> {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") {
    return {
      ok: false,
      code: "duplicate_review",
      message: "Bu kurs bo‘yicha fikringiz allaqachon bor. Uni tahrirlashingiz mumkin.",
    };
  }
  if (code === "23514") {
    return {
      ok: false,
      code: "invalid_input",
      message: "Fikr matni yoki bahosi talabga mos kelmadi.",
    };
  }
  if (code === "23503") {
    return { ok: false, code: "not_found", message: "Kurs yoki yozilish topilmadi." };
  }
  console.error(`${scope} failed`, { code: code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Fikrni saqlab bo‘lmadi." };
}

/* ------------------------------ integrity checks --------------------------- */

/**
 * Recompute every stored aggregate from the review rows.
 *
 * Not used by any request path — the aggregates are maintained transactionally by
 * the writers above. This exists so an operator (or a test) can PROVE the caches
 * match the rows, and so a hand-edited database can be brought back in line
 * without a migration.
 */
export async function reconcileAllReviewStats(): Promise<{
  courses: number;
  teachers: number;
  corrected: { courses: number; teachers: number };
}> {
  const db = getDb();
  const corrected = { courses: 0, teachers: 0 };

  const courseIds = await db.select({ id: schema.courses.id }).from(schema.courses);
  await db.transaction(async (tx) => {
    for (const { id } of courseIds) {
      const before = await tx
        .select({ ratingX10: schema.courses.ratingX10, reviewsCount: schema.courses.reviewsCount })
        .from(schema.courses)
        .where(eq(schema.courses.id, id))
        .limit(1);
      const stats = await recalculateCourseReviewStats(tx, id);
      if (
        before[0]?.ratingX10 !== stats.ratingX10 ||
        before[0]?.reviewsCount !== stats.reviewsCount
      ) {
        corrected.courses += 1;
      }
      await tx
        .update(schema.courses)
        .set({ ratingX10: stats.ratingX10, reviewsCount: stats.reviewsCount })
        .where(eq(schema.courses.id, id));
    }
  });

  const teacherIds = await db
    .select({ userId: schema.teacherProfiles.userId })
    .from(schema.teacherProfiles);
  await db.transaction(async (tx) => {
    for (const { userId } of teacherIds) {
      const before = await tx
        .select({
          ratingX10: schema.teacherProfiles.ratingX10,
          reviewsCount: schema.teacherProfiles.reviewsCount,
        })
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, userId))
        .limit(1);
      const stats = await recalculateTeacherReviewStats(tx, userId);
      if (
        before[0]?.ratingX10 !== stats.ratingX10 ||
        before[0]?.reviewsCount !== stats.reviewsCount
      ) {
        corrected.teachers += 1;
      }
      await tx
        .update(schema.teacherProfiles)
        .set({ ratingX10: stats.ratingX10, reviewsCount: stats.reviewsCount })
        .where(eq(schema.teacherProfiles.userId, userId));
    }
  });

  return {
    courses: courseIds.length,
    teachers: teacherIds.length,
    corrected,
  };
}
