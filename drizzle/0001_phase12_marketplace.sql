-- no-transaction
-- Phase 12 — marketplace parity columns, the `published` lifecycle value and
-- the indexes backing public listing reads.
--
-- Runs outside a transaction: PostgreSQL refuses to use an enum value in the
-- same transaction that added it, and courses_published_requires_date
-- references the new 'published' value.
CREATE TYPE "public"."course_schedule" AS ENUM('morning', 'day', 'evening');--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'published';--> statement-breakpoint
ALTER TABLE "course_groups" ADD COLUMN "format" "course_format" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "course_groups" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "schedule" "course_schedule" DEFAULT 'evening' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "rating_x10" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "reviews_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "students_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "published_at" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price_period" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "photo" text;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "specialization" text;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "rating_x10" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "reviews_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "students_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "courses_public_idx" ON "courses" USING btree ("status","category_id");--> statement-breakpoint
CREATE INDEX "courses_published_at_idx" ON "courses" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "teacher_profiles_public_idx" ON "teacher_profiles" USING btree ("is_public");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_rating_check" CHECK ("courses"."rating_x10" BETWEEN 0 AND 50);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_reviews_check" CHECK ("courses"."reviews_count" >= 0);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_students_check" CHECK ("courses"."students_count" >= 0);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_published_at_format" CHECK ("courses"."published_at" IS NULL OR "courses"."published_at" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_published_requires_date" CHECK ("courses"."status" <> 'published' OR "courses"."published_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_rating_check" CHECK ("teacher_profiles"."rating_x10" BETWEEN 0 AND 50);--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_reviews_check" CHECK ("teacher_profiles"."reviews_count" >= 0);--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_students_check" CHECK ("teacher_profiles"."students_count" >= 0);