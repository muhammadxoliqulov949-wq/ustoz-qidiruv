-- no-transaction
-- Phase 19 — real course reviews and the reputation aggregates they produce.
--
-- WHY THIS FILE EXISTS. Until now the "reviews" a visitor read on /courses/[slug]
-- and /teachers/[slug] were fictional fixtures compiled into the bundle
-- (src/data/reviews.ts), while the numbers beside them (courses.rating_x10,
-- courses.reviews_count, teacher_profiles.rating_x10/reviews_count) came from the
-- same fictional dataset through the seed. A rating nobody earned is worse than no
-- rating at all, so this file creates ONE place a review can come from: a row
-- written by a student who was actually accepted onto the course, and made public
-- only by an admin decision.
--
-- Runs OUTSIDE a transaction because PostgreSQL refuses to USE an enum value in the
-- same transaction that added it, and this file adds `admin_audit_action` /
-- `notification_type` values and then creates a table that references the new
-- `course_review_status` type. The runner in scripts/db.ts honours the marker on
-- the first line (same as 0001/0003/0004/0005/0006/0007).
--
-- ADDITIVE ONLY, AND SAFE ON A LIVE DATABASE.
--   • one new enum type, one new table, six new indexes;
--   • two `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pairs — re-runnable, no rewrite;
--   • ONE new UNIQUE constraint on `enrollment_requests`, which every existing row
--     already satisfies trivially (`id` is its primary key), so validation cannot
--     fail and no row is touched;
--   • the `admin_audit_events.entity_type` CHECK is dropped and re-added with one
--     more allowed word. Existing rows keep matching, so the re-ADD validates
--     cleanly. Nothing is deleted, no column is retyped, no row is updated.
--
-- NO PRODUCTION DATA IS ALTERED OR RESET BY THIS FILE. The aggregate columns it
-- makes meaningful (`courses.rating_x10`, `courses.reviews_count`,
-- `teacher_profiles.rating_x10/reviews_count`) are left exactly as they are here;
-- they are recalculated by the application whenever a review changes visibility.
-- Seeding reviews into production is a separate, explicit act that this migration
-- does not perform.

CREATE TYPE "public"."course_review_status" AS ENUM('pending', 'published', 'rejected', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE IF NOT EXISTS 'review_published';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE IF NOT EXISTS 'review_rejected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'review_published';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'review_rejected';--> statement-breakpoint
--
-- Composite FK target for `course_reviews`.
--
-- A review names an enrollment. Without this constraint "student A reviews
-- student B's enrollment" is prevented only by application code; with it, the
-- three columns (enrollment_request_id, student_user_id, course_id) must match ONE
-- real enrollment row, so the database itself refuses a review whose claimed
-- student or claimed course is not the enrollment's own. The columns are already
-- unique together (id is the primary key), so adding this costs nothing and
-- changes no row.
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_id_student_course_key" UNIQUE("id","student_user_id","course_id");--> statement-breakpoint
CREATE TABLE "course_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"enrollment_request_id" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text NOT NULL,
	"status" "course_review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_at" timestamp with time zone,
	"moderated_by_admin_user_id" text,
	"moderation_reason" text,
	-- ONE REVIEW PER STUDENT PER COURSE.
	--
	-- A full UNIQUE (not a partial one) because the row is REUSED: a withdrawn or
	-- rejected review is edited back into existence rather than replaced, so the
	-- student's history stays in one place and a second review of the same course
	-- is structurally impossible — including under two racing submissions, which
	-- is why this lives in the database and not in a `SELECT` in the UI.
	CONSTRAINT "course_reviews_one_per_student_course" UNIQUE("student_user_id","course_id"),
	CONSTRAINT "course_reviews_rating_range" CHECK ("course_reviews"."rating" BETWEEN 1 AND 5),
	-- Trimmed on the way in (the service trims) and bounded here, so a body can be
	-- neither a drive-by empty string nor a wall of text. 20 characters is the
	-- point at which a sentence can carry a real opinion.
	CONSTRAINT "course_reviews_body_trimmed" CHECK ("course_reviews"."body" = btrim("course_reviews"."body")),
	CONSTRAINT "course_reviews_body_length" CHECK (length("course_reviews"."body") BETWEEN 20 AND 1500),
	--
	-- MODERATION PROVENANCE, ALL-OR-NOTHING.
	--
	--   pending   → nobody has decided: no moderator, no moment, no reason.
	--   published → an admin decided: both are set.
	--   rejected  → an admin decided: both are set.
	--   withdrawn → THE STUDENT decided, not an admin. Deliberately NOT given a
	--               moderator: attributing a student's own withdrawal to an
	--               operator would misstate who acted.
	--
	-- A reason only ever exists on a rejection: a published review has nothing to
	-- explain, and a pending one has not been read yet.
	CONSTRAINT "course_reviews_pending_is_undecided" CHECK ("course_reviews"."status" <> 'pending' OR ("course_reviews"."moderated_at" IS NULL AND "course_reviews"."moderated_by_admin_user_id" IS NULL)),
	CONSTRAINT "course_reviews_decision_has_moderator" CHECK ("course_reviews"."status" NOT IN ('published', 'rejected') OR ("course_reviews"."moderated_at" IS NOT NULL AND "course_reviews"."moderated_by_admin_user_id" IS NOT NULL)),
	CONSTRAINT "course_reviews_withdrawn_by_student" CHECK ("course_reviews"."status" <> 'withdrawn' OR ("course_reviews"."moderated_at" IS NULL AND "course_reviews"."moderated_by_admin_user_id" IS NULL)),
	CONSTRAINT "course_reviews_reason_only_on_rejection" CHECK ("course_reviews"."status" = 'rejected' OR "course_reviews"."moderation_reason" IS NULL),
	-- Optional by design (a rejection without prose is still a valid decision),
	-- but when an admin writes one it must say something and stay short.
	CONSTRAINT "course_reviews_reason_length" CHECK ("course_reviews"."moderation_reason" IS NULL OR length(btrim("course_reviews"."moderation_reason")) BETWEEN 10 AND 300)
);
--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ON DELETE cascade: a student who deletes their account takes their reviews with
-- them, exactly like their enrollments.
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_student_user_id_student_profiles_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ON DELETE restrict: a review is EVIDENCE that a real enrollment produced it.
-- Deleting the enrollment (e.g. through a refund cancellation path that removes
-- rows) must fail rather than silently orphan the reputation it backs.
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_enrollment_request_id_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."enrollment_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- THE OWNERSHIP PROOF. All three columns must match one real enrollment row, so
-- neither the student nor the course on a review can be swapped to someone else's
-- enrollment by a crafted request.
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_enrollment_owner_fk" FOREIGN KEY ("enrollment_request_id","student_user_id","course_id") REFERENCES "public"."enrollment_requests"("id","student_user_id","course_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- The deciding admin. NO ACTION on delete on purpose, matching
-- `course_moderation_reviews.reviewed_by_admin_user_id`: deleting an operator who
-- has moderated reviews must fail rather than erase the audit trail.
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_moderated_by_admin_user_id_users_id_fk" FOREIGN KEY ("moderated_by_admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_events" DROP CONSTRAINT "aae_entity_type_check";--> statement-breakpoint
-- The public read: one course's published reviews, newest first. `created_at DESC`
-- is in the index so the ordering is an index walk, not a sort.
CREATE INDEX "course_reviews_course_public_idx" ON "course_reviews" USING btree ("course_id","created_at" DESC) WHERE status = 'published';--> statement-breakpoint
-- "Does this student already have a review here?" and the student's own review
-- panel on the course page.
CREATE INDEX "course_reviews_student_idx" ON "course_reviews" USING btree ("student_user_id","course_id");--> statement-breakpoint
-- The admin queue: oldest undecided review first.
CREATE INDEX "course_reviews_status_created_idx" ON "course_reviews" USING btree ("status","created_at");--> statement-breakpoint
-- Provenance: which operator decided which reviews.
CREATE INDEX "course_reviews_moderator_idx" ON "course_reviews" USING btree ("moderated_by_admin_user_id");--> statement-breakpoint
-- Reverse lookup from an enrollment to the review it produced.
CREATE INDEX "course_reviews_enrollment_idx" ON "course_reviews" USING btree ("enrollment_request_id");--> statement-breakpoint
-- The teacher aggregate is computed across ALL of a teacher's courses at once, so
-- it needs the join key indexed rather than a per-course loop.
CREATE INDEX "course_reviews_course_status_idx" ON "course_reviews" USING btree ("course_id","status");--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "aae_entity_type_check" CHECK ("admin_audit_events"."entity_type" IN ('teacher', 'course', 'refund', 'review'));
