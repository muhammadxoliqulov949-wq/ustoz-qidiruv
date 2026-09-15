-- no-transaction
-- Phase 15 — admin control plane, teacher verification, course moderation and
-- the append-only admin audit log.
--
-- Runs OUTSIDE a transaction: PostgreSQL refuses to USE a new enum value in the
-- same transaction that added it, and this file both adds values (user_role =
-- admin, four notification types) and then creates tables and partial unique
-- indexes. The migration runner in scripts/db.ts honours this marker on the
-- first line (same as 0001/0003/0004).
--
-- ADDITIVE ONLY: three new types, three new tables, four enum extensions. No
-- prior migration is rewritten, no existing column changes type, and no
-- existing row is modified, so this applies cleanly to any Phase 11-14
-- database. Every ADD VALUE is IF NOT EXISTS so a re-run cannot fail.
--
-- The phase deliberately does NOT add a "rejected" value to verification_status
-- or course_status: a returned application returns the profile to unverified
-- and a returned course returns to draft, while the decision itself is recorded
-- on the request/review row below.
CREATE TYPE "public"."admin_audit_action" AS ENUM('teacher_verified', 'teacher_verification_rejected', 'course_published', 'course_changes_requested');--> statement-breakpoint
CREATE TYPE "public"."course_moderation_status" AS ENUM('pending', 'approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."verification_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'verification_approved';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'verification_rejected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'course_published';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'course_changes_requested';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin';--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aae_entity_type_check" CHECK ("admin_audit_events"."entity_type" IN ('teacher', 'course')),
	CONSTRAINT "aae_entity_id_check" CHECK (length(btrim("admin_audit_events"."entity_id")) > 0),
	CONSTRAINT "aae_metadata_len" CHECK ("admin_audit_events"."metadata" IS NULL OR length("admin_audit_events"."metadata") <= 300)
);
--> statement-breakpoint
CREATE TABLE "course_moderation_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"submitted_by_teacher_user_id" text NOT NULL,
	"status" "course_moderation_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_admin_user_id" text,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cmr_feedback_len" CHECK ("course_moderation_reviews"."feedback" IS NULL OR length("course_moderation_reviews"."feedback") <= 500),
	CONSTRAINT "cmr_reviewed_consistency" CHECK (("course_moderation_reviews"."status" = 'pending') = ("course_moderation_reviews"."reviewed_at" IS NULL)),
	CONSTRAINT "cmr_reviewer_required" CHECK ("course_moderation_reviews"."status" = 'pending' OR "course_moderation_reviews"."reviewed_by_admin_user_id" IS NOT NULL),
	CONSTRAINT "cmr_changes_need_feedback" CHECK ("course_moderation_reviews"."status" <> 'changes_requested'
          OR ("course_moderation_reviews"."feedback" IS NOT NULL AND length(btrim("course_moderation_reviews"."feedback")) >= 10))
);
--> statement-breakpoint
CREATE TABLE "teacher_verification_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_user_id" text NOT NULL,
	"status" "verification_request_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_admin_user_id" text,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tvr_feedback_len" CHECK ("teacher_verification_requests"."feedback" IS NULL OR length("teacher_verification_requests"."feedback") <= 500),
	CONSTRAINT "tvr_reviewed_consistency" CHECK (("teacher_verification_requests"."status" = 'pending') = ("teacher_verification_requests"."reviewed_at" IS NULL)),
	CONSTRAINT "tvr_reviewer_required" CHECK ("teacher_verification_requests"."status" = 'pending' OR "teacher_verification_requests"."reviewed_by_admin_user_id" IS NOT NULL),
	CONSTRAINT "tvr_rejection_needs_feedback" CHECK ("teacher_verification_requests"."status" <> 'rejected'
          OR ("teacher_verification_requests"."feedback" IS NOT NULL AND length(btrim("teacher_verification_requests"."feedback")) >= 10))
);
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_moderation_reviews" ADD CONSTRAINT "course_moderation_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_moderation_reviews" ADD CONSTRAINT "course_moderation_reviews_submitted_by_teacher_user_id_teacher_profiles_user_id_fk" FOREIGN KEY ("submitted_by_teacher_user_id") REFERENCES "public"."teacher_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_moderation_reviews" ADD CONSTRAINT "course_moderation_reviews_reviewed_by_admin_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verification_requests" ADD CONSTRAINT "teacher_verification_requests_teacher_user_id_teacher_profiles_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."teacher_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verification_requests" ADD CONSTRAINT "teacher_verification_requests_reviewed_by_admin_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aae_created_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "aae_admin_idx" ON "admin_audit_events" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "aae_entity_idx" ON "admin_audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "cmr_course_idx" ON "course_moderation_reviews" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE INDEX "cmr_status_idx" ON "course_moderation_reviews" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cmr_one_pending_per_course" ON "course_moderation_reviews" USING btree ("course_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "tvr_teacher_idx" ON "teacher_verification_requests" USING btree ("teacher_user_id","created_at");--> statement-breakpoint
CREATE INDEX "tvr_status_idx" ON "teacher_verification_requests" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tvr_one_pending_per_teacher" ON "teacher_verification_requests" USING btree ("teacher_user_id") WHERE status = 'pending';