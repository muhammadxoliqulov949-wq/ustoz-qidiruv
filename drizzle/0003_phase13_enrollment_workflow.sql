-- no-transaction
-- Phase 13 — enrollment decision workflow, in-app notifications and the
-- append-only enrollment event history.
--
-- Runs outside a transaction: PostgreSQL refuses to USE an enum value in the
-- same transaction that added it, and the partial unique index below
-- references the new 'accepted' value.
--
-- Note the replaced duplicate guard: the Phase 11 UNIQUE(student, group,
-- status) was correct for two statuses but would have let one student hold
-- both a 'submitted' and an 'accepted' row for the same group. The partial
-- unique index expresses the real rule: at most one LIVE request per group.
CREATE TYPE "public"."notification_type" AS ENUM('enrollment_submitted', 'enrollment_accepted', 'enrollment_rejected', 'enrollment_cancelled');--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE IF NOT EXISTS 'accepted' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE IF NOT EXISTS 'rejected' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "enrollment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_request_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"from_status" "enrollment_status",
	"to_status" "enrollment_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_events_from_differs" CHECK ("enrollment_events"."from_status" IS NULL OR "enrollment_events"."from_status" <> "enrollment_events"."to_status")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_len" CHECK (length("notifications"."title") BETWEEN 1 AND 160),
	CONSTRAINT "notifications_body_len" CHECK (length("notifications"."body") <= 500)
);
--> statement-breakpoint
ALTER TABLE "enrollment_requests" DROP CONSTRAINT "enrollment_requests_unique_live";--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_enrollment_request_id_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."enrollment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_events_request_idx" ON "enrollment_events" USING btree ("enrollment_request_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "enrollment_requests_group_status_idx" ON "enrollment_requests" USING btree ("group_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_requests_one_live_per_group" ON "enrollment_requests" USING btree ("student_user_id","group_id") WHERE status IN ('submitted', 'accepted');--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_decision_reason_len" CHECK ("enrollment_requests"."decision_reason" IS NULL OR length("enrollment_requests"."decision_reason") <= 300);