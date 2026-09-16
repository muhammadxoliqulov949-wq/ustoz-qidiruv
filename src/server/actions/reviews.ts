"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin, requireRole } from "../auth/guards";
import {
  createReview,
  publishReview,
  rejectReview,
  updateOwnReview,
  withdrawOwnReview,
} from "../review-service";
import {
  createCourseReviewSchema,
  publishCourseReviewSchema,
  rejectCourseReviewSchema,
  updateCourseReviewSchema,
  withdrawCourseReviewSchema,
  type ActionResult,
} from "../validation";
import { normalizeModerationReason } from "../review-service";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMITED_MESSAGE,
  consumeRateLimit,
  rateLimitKey,
} from "../rate-limit";

/* -------------------------------------------------------------------------- */
/* Review actions — Phase 19.                                                  */
/*                                                                              */
/* IDENTITY IS NEVER A PARAMETER. Every action below resolves the actor with       */
/* `requireRole("student")` or `requireAdmin()`, which read the session cookie and */
/* the `users.role` row. There is no `studentUserId`, `author`, `role` or           */
/* "on behalf of" field in any payload, and `.strict()` rejects a request that      */
/* invents one. A student therefore cannot author as somebody else, and a teacher   */
/* cannot moderate reviews of their own course — `requireAdmin` is the only door to */
/* the two moderation actions.                                                    */
/*                                                                              */
/* The action names ARE the intent: `publishReviewAction` / `rejectReviewAction`.  */
/* There is no action that takes a target status, so no caller can ask for          */
/* `status = 'published'` from the student side.                                  */
/*                                                                              */
/* Errors are safe and generic. A refusal never explains whether the enrollment     */
/* exists, who owns it or why it is ineligible, and a failure log line carries a    */
/* code — never the review body, which is a student's words.                      */
/* -------------------------------------------------------------------------- */

function failure(scope: string, error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, code: error.code, message: error.message };
  console.error(`${scope} failed`, { code: (error as { code?: string }).code ?? "unknown" });
  return { ok: false, code: "server_error", message: "Fikrni saqlab bo‘lmadi." };
}

/**
 * Everything a review decision can change:
 *   • the course page's review list and the student's own panel;
 *   • the admin queue, the overview counts and the audit log;
 *   • every surface that renders a course or teacher rating — cards, detail pages,
 *     browse sorting and the teacher directory.
 *
 * `courseSlug` is the only value the client contributes here, and it is used
 * exclusively to revalidate a path: a wrong slug makes one page stale, it cannot
 * expose or alter anything.
 */
function revalidateReviews(courseSlug: string): void {
  if (courseSlug) revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/courses");
  revalidatePath("/teachers");
  revalidatePath("/categories");
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  revalidatePath("/notifications");
}

function courseSlugFrom(form: FormData): string {
  const raw = String(form.get("courseSlug") ?? "").trim();
  // A slug is revalidated, not trusted: keep it to the shape the DB allows.
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw) ? raw : "";
}

/*
 * Phase 22: student review writes share one durable per-student budget, spent
 * BEFORE the service runs. Admin moderation is intentionally unlimited —
 * operators are trusted, few, and every decision is audit-logged.
 */
async function consumeStudentReviewBudget(studentUserId: string): Promise<boolean> {
  const decision = await consumeRateLimit(
    RATE_LIMIT_POLICIES.reviewMutation,
    rateLimitKey("review:mutation", studentUserId),
  );
  return decision.allowed;
}

function reviewRateLimited(): ActionResult {
  return { ok: false, code: "rate_limited", message: RATE_LIMITED_MESSAGE };
}

/* ------------------------------- student side ------------------------------ */

/** Create a review. Lands as `pending` — no student path publishes. */
export async function createReviewAction(form: FormData): Promise<ActionResult> {
  try {
    const student = await requireRole("student");
    const parsed = createCourseReviewSchema.safeParse({
      courseId: String(form.get("courseId") ?? ""),
      enrollmentRequestId: String(form.get("enrollmentRequestId") ?? ""),
      rating: String(form.get("rating") ?? ""),
      body: String(form.get("body") ?? ""),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Fikrni yuborib bo‘lmadi.";
      return {
        ok: false,
        code: "invalid_input",
        message,
        fieldErrors: { [parsed.error.issues[0]?.path[0] ?? "body"]: message },
      };
    }

    if (!(await consumeStudentReviewBudget(student.id))) return reviewRateLimited();

    const result = await createReview({
      // The author is the session. Nothing in the payload can change it.
      studentUserId: student.id,
      courseId: parsed.data.courseId,
      enrollmentRequestId: parsed.data.enrollmentRequestId,
      rating: parsed.data.rating,
      body: parsed.data.body,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateReviews(courseSlugFrom(form));
    return { ok: true };
  } catch (error) {
    return failure("createReviewAction", error);
  }
}

/**
 * Edit the caller's own review.
 *
 * Only `reviewId`, `rating` and `body` are accepted. Ownership is proven against
 * the locked row, and an edit of a PUBLISHED review returns it to `pending`, which
 * removes its old value from the public aggregates in the same transaction.
 */
export async function updateReviewAction(form: FormData): Promise<ActionResult> {
  try {
    const student = await requireRole("student");
    const parsed = updateCourseReviewSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
      rating: String(form.get("rating") ?? ""),
      body: String(form.get("body") ?? ""),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Fikrni saqlab bo‘lmadi.";
      return {
        ok: false,
        code: "invalid_input",
        message,
        fieldErrors: { [parsed.error.issues[0]?.path[0] ?? "body"]: message },
      };
    }

    if (!(await consumeStudentReviewBudget(student.id))) return reviewRateLimited();

    const result = await updateOwnReview({
      reviewId: parsed.data.reviewId,
      studentUserId: student.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateReviews(courseSlugFrom(form));
    return { ok: true };
  } catch (error) {
    return failure("updateReviewAction", error);
  }
}

/** Take the caller's own review down. Not a deletion — it can be resubmitted. */
export async function withdrawReviewAction(form: FormData): Promise<ActionResult> {
  try {
    const student = await requireRole("student");
    const parsed = withdrawCourseReviewSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri fikr identifikatori." };
    }

    if (!(await consumeStudentReviewBudget(student.id))) return reviewRateLimited();

    const result = await withdrawOwnReview({
      reviewId: parsed.data.reviewId,
      studentUserId: student.id,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateReviews(courseSlugFrom(form));
    return { ok: true };
  } catch (error) {
    return failure("withdrawReviewAction", error);
  }
}

/* -------------------------------- admin side ------------------------------- */

/** Publish — the only path that makes a review public. */
export async function publishReviewAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = publishCourseReviewSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, code: "invalid_input", message: "Noto‘g‘ri fikr identifikatori." };
    }

    const result = await publishReview(parsed.data.reviewId, admin.id);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateReviews(courseSlugFrom(form));
    return { ok: true };
  } catch (error) {
    return failure("publishReviewAction", error);
  }
}

/** Reject (or un-publish). The reason is optional; a written one must say something. */
export async function rejectReviewAction(form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = rejectCourseReviewSchema.safeParse({
      reviewId: String(form.get("reviewId") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Sababni tekshiring.";
      return {
        ok: false,
        code: "invalid_input",
        message,
        fieldErrors: { reason: message },
      };
    }

    const result = await rejectReview(
      parsed.data.reviewId,
      admin.id,
      normalizeModerationReason(parsed.data.reason),
    );
    if (!result.ok) return { ok: false, code: result.code, message: result.message };

    revalidateReviews(courseSlugFrom(form));
    return { ok: true };
  } catch (error) {
    return failure("rejectReviewAction", error);
  }
}
