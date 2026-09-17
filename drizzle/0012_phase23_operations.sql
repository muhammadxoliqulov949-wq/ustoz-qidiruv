-- no-transaction
-- Phase 23 — product completion and operations.
--
-- Runs outside a transaction because PostgreSQL enum extensions are not safe to
-- use before the transaction that added them commits. Every change is additive;
-- no business rows are rewritten or deleted.
--
CREATE TYPE "public"."account_status" AS ENUM('active', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_category" AS ENUM('account', 'teacher_course', 'payment', 'inappropriate_content', 'technical');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'paused';--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'archived';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'verification_submitted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'moderation_required';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'support_submitted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'support_status_changed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'payment_failed';--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text,
	"category" "support_ticket_category" NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_admin_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "support_tickets_message_len" CHECK (length(btrim("support_tickets"."message")) BETWEEN 10 AND 4000),
	CONSTRAINT "support_tickets_related_type_check" CHECK ("support_tickets"."related_entity_type" IS NULL OR "support_tickets"."related_entity_type" IN ('account','teacher','course','payment','enrollment','review','refund','message')),
	CONSTRAINT "support_tickets_related_pair_check" CHECK (("support_tickets"."related_entity_type" IS NULL) = ("support_tickets"."related_entity_id" IS NULL)),
	CONSTRAINT "support_tickets_related_id_len" CHECK ("support_tickets"."related_entity_id" IS NULL OR length("support_tickets"."related_entity_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_admin_user_id_users_id_fk" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_tickets_status_created_idx" ON "support_tickets" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_reporter_created_idx" ON "support_tickets" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_related_idx" ON "support_tickets" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "support_tickets_assignee_idx" ON "support_tickets" USING btree ("assigned_admin_user_id","status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deactivation_consistency" CHECK (("users"."account_status" = 'deactivated') = ("users"."deactivated_at" IS NOT NULL));