# Phase 19 — real reviews + reputation: audit and decisions

## A. Audit of the existing system (before any code was written)

| Area | Finding | Consequence for Phase 19 |
| --- | --- | --- |
| Written reviews | `src/data/reviews.ts` — 17 fictional testimonials compiled into the bundle, read by `course-reviews.tsx` **and** `teacher-reviews.tsx` | Deleted. One table (`course_reviews`) becomes the only source. |
| Aggregate numbers | `courses.rating_x10` / `reviews_count` and the same pair on `teacher_profiles`, seeded from `Math.round(course.rating * 10)` / `course.reviews` | Kept as **cached aggregates**, but the seed no longer imports the fictional numbers. Both start at `0` and are recomputed from rows. |
| Public boundary | `src/server/public-repo.ts` is the only place the public marketplace touches the DB | Review reads are exposed there, delegating to the service — no second door. |
| Enrollment | `enrollment_requests(status)` with `submitted/accepted/rejected/cancelled`; occupancy derived from `accepted` | "Earned a review" = an `accepted` row owned by the session user. |
| Groups | `course_groups.start_date` is an ISO text column | "Already started" = `start_date <= today`, same ISO convention as `published_at`. |
| Moderation pattern | `course_moderation_reviews` + `admin_audit_events` + in-transaction role re-check + `SELECT … FOR UPDATE` | Reused verbatim: same lock, same audit call, same "re-check the admin inside the tx" defence. |
| Audit log | `admin_audit_events.entity_type` CHECK allowed `teacher/course/refund` | Widened to include `review`; two new `admin_audit_action` values. |
| Notifications | Inserted inside the deciding transaction | `review_published` / `review_rejected` added; nothing is emitted for `pending`/`withdrawn`. |
| Identity | Session cookie → `users.role`; `requireRole` / `requireAdmin`; Zod `.strict()` everywhere | No review payload carries an author, a role or a status. |
| Completion tracking | **Does not exist anywhere** | The product cannot claim "completed the course". The only honest label is `Tasdiqlangan qatnashuvchi`. |

## B. Decisions

1. **One row per (student, course), reused.** A full `UNIQUE(student_user_id, course_id)`
   rather than a partial index over "live" statuses. A withdrawn or rejected review
   is edited back into existence, so the student's history stays in one place, the
   duplicate guard is unconditional, and two racing submissions cannot both land.

2. **Ownership is a composite FK, not a `SELECT`.** `course_reviews` references
   `enrollment_requests(id, student_user_id, course_id)` with all three of its own
   ownership columns, so "student A reviews student B's enrollment" and "review moved
   onto another course" are insert/update failures, not application-code mistakes.
   The target UNIQUE on `enrollment_requests` is free: `id` is already its primary key.

3. **`withdrawn` carries no moderator.** It is the student's own act. Attributing it
   to an operator would misstate who acted, so the CHECK requires
   `moderated_at IS NULL AND moderated_by_admin_user_id IS NULL` for it — exactly as
   for `pending`.

4. **Editing a published review re-queues it.** An admin approved a *specific text*.
   The edit sets `pending`, clears the moderation fields (the CHECK demands it) and
   recomputes the aggregates in the same transaction, so the old value leaves the
   public numbers immediately rather than surviving until the next decision.

5. **Rejection reason is optional.** A decision without prose is still a decision;
   when one is written it must clear 10 characters and stay under 300. This is the
   one place Phase 19 departs from `cmr_changes_need_feedback`, deliberately, because
   a rejected review is not a returned application — the student is not owed an essay.

6. **The teacher aggregate is a flat mean over rows.**
   `round(avg(rating) * 10)` across every published row of every course the teacher
   owns. Averaging per-course averages would weight a course with one review the same
   as a course with fifty, and a teacher's reputation would move when they published
   a small new course. The suite pins this: four rows `2,4,4,5` give `38`, not the
   `32` that averaging the two course means would produce.

7. **Aggregates are recomputed, never incremented.** No counter is bumped or
   decremented anywhere. `syncReviewAggregates()` recomputes both caches from the rows
   inside every mutating transaction, under a `courses` → `teacher_profiles` lock
   order (fixed, so two reviews of two courses by one teacher cannot deadlock).
   `reconcileAllReviewStats()` exists so an operator or a test can prove the caches
   match — the suite hand-corrupts one and watches it get repaired.

8. **Public projection is tiny by construction.** `PublicReviewView` is
   `{ id, rating, body, date, author }`. There is no user id, name, phone, email or
   enrollment id to leak, because the query never selects them.

9. **The public author label is a constant, not a derived name.** `student_profiles`
   has a `name`, but no "display name" a student chose to publish. Deriving initials
   or a first name would be a decision about their identity they never made, so the
   list renders `Tasdiqlangan o'quvchi`. The admin queue *does* show the real name —
   an operator judging a sentence needs to know who wrote it — and still never sees
   the phone number, because the projection does not select `users.phone` at all.

10. **One refusal for every eligibility failure.** Whether the enrollment is missing,
    belongs to somebody else, was rejected, or sits on a group that has not started,
    the write path answers `not_eligible` with the same message. Distinct answers
    would be an enumeration oracle over data the caller should not be able to probe.

11. **A teacher cannot moderate.** No teacher surface imports the actions, and
    `publishReview` / `rejectReview` re-check `users.role = 'admin'` inside the
    transaction — the same defence `moderation-service` uses — so even a caller that
    supplied a teacher's id cannot have that teacher recorded as the moderator.

12. **Failure logs carry a code, never the body.** A review body is a student's words
    and may contain personal detail, so `writeFailure` logs `{ code }` only and maps
    `23505/23514/23503` to honest user-facing messages.

13. **The dev seed earns its fixtures.** Local review rows are attached to `accepted`
    enrollments on groups that have already started, so the real eligibility rules
    would accept them too, and every aggregate is recomputed afterwards by the same
    helpers production uses. `db:seed` refuses `NODE_ENV=production`; the migration
    seeds nothing.

## C. Explicitly not built

- **No completion tracking.** No `completed` status, no "finished the course" claim,
  no LMS signal. The eligibility bar is accepted participation and nothing more.
- **No teacher reply, no helpfulness votes, no editing by admins.** An admin publishes
  or rejects; the text is always the student's.
- **No deletion.** A rejected or withdrawn review keeps its row, so the audit trail of
  what was once public survives and the student can resubmit.
- **No production migration, seed or reset was run.** The migration file exists and is
  committed; applying it to production is a separate, manual, reviewed act.
