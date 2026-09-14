-- no-transaction
-- Phase 17 — refunds and paid enrollment cancellation.
--
-- New enum VALUES (notification_type, admin_audit_action, payment_event_type)
-- and two new enum TYPES require `-- no-transaction`: PostgreSQL refuses to run
-- ALTER TYPE ... ADD VALUE inside a transaction block.
--
-- ADDITIVE EXCEPT TWO RELAXATIONS. No column is dropped or retyped, and the only
-- changes to existing objects are
--   • `enrollment_events.actor_user_id DROP NOT NULL`, because a refund
--     confirmed by an AUTHENTICATED PROVIDER CALLBACK has no session user behind
--     it, and attributing it to the student would be a lie in the history;
--   • the `admin_audit_events.entity_type` CHECK gains 'refund', so a refund
--     decision is audited alongside teacher and course decisions.
-- A Phase 16 database upgrades in place.
--
-- WHY A THIRD DOMAIN. `enrollment_requests.status` keeps answering "does this
-- student have a place?" and `payments.status` keeps answering "did the money
-- arrive?" — neither enum is extended. A refund in flight is
-- `enrollment = accepted` + `payment = succeeded` + `refund = requested`, so the
-- seat stays OCCUPIED until the provider confirms the money went back. See the
-- schema comment block and README → "Phase 17".
--
-- WHY THERE IS NO OUTBOUND REFUND CALL. The official Payme Business Merchant API
-- exposes no merchant-side refund endpoint. The documentation states that the
-- merchant returns the money to the buyer IN THE MERCHANT CABINET, and that a
-- refund is only possible if the merchant implements CancelTransaction. This
-- application therefore implements CancelTransaction truthfully (see
-- src/server/payments/payme-adapter.ts) and lets that authenticated callback
-- finalise the refund — there is no "refund succeeded" button anywhere.
--
-- WHY `refund_requests.completed_at` IS NOT NULLABLE WHEN completed. A completed
-- refund must carry the provider's own cancellation moment, so `completed` can
-- never be written as a bare status flip by a page, a script or a future
-- contributor who did not read this file.

CREATE TYPE "public"."refund_event_type" AS ENUM('requested', 'approved', 'rejected', 'provider_refund_completed', 'provider_refund_failed', 'provider_reversal_recorded');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'awaiting_provider', 'completed', 'rejected', 'failed');--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE IF NOT EXISTS 'refund_approved';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE IF NOT EXISTS 'refund_rejected';--> statement-breakpoint
ALTER TYPE "public"."admin_audit_action" ADD VALUE IF NOT EXISTS 'refund_failed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_requested';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_approved';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_rejected';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_completed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_failed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'refund_provider_reversal';--> statement-breakpoint
ALTER TYPE "public"."payment_event_type" ADD VALUE IF NOT EXISTS 'provider_refund_confirmed' BEFORE 'payment_failed';--> statement-breakpoint
CREATE TABLE "refund_events" (
	"id" text PRIMARY KEY NOT NULL,
	"refund_request_id" text NOT NULL,
	"actor_user_id" text,
	"type" "refund_event_type" NOT NULL,
	"from_status" "refund_status",
	"to_status" "refund_status" NOT NULL,
	"provider_transaction_id" text,
	"reason_code" integer,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_events_from_differs" CHECK ("refund_events"."from_status" IS NULL OR "refund_events"."from_status" <> "refund_events"."to_status"),
	CONSTRAINT "refund_events_metadata_len" CHECK ("refund_events"."metadata" IS NULL OR length("refund_events"."metadata") <= 500)
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"enrollment_request_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"provider_transaction_id" text,
	"status" "refund_status" NOT NULL,
	"amount_tiyin" bigint NOT NULL,
	"reason" text NOT NULL,
	"admin_feedback" text,
	"reviewed_by_admin_user_id" text,
	"system_initiated" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_requests_amount_positive" CHECK ("refund_requests"."amount_tiyin" > 0),
	CONSTRAINT "refund_requests_reason_len" CHECK (length("refund_requests"."reason") BETWEEN 1 AND 1000),
	CONSTRAINT "refund_requests_reason_trimmed" CHECK ("refund_requests"."reason" = btrim("refund_requests"."reason")),
	CONSTRAINT "refund_requests_feedback_len" CHECK ("refund_requests"."admin_feedback" IS NULL OR (length("refund_requests"."admin_feedback") BETWEEN 1 AND 1000 AND "refund_requests"."admin_feedback" = btrim("refund_requests"."admin_feedback"))),
	CONSTRAINT "refund_requests_completed_evidence" CHECK ("refund_requests"."status" <> 'completed' OR "refund_requests"."completed_at" IS NOT NULL),
	CONSTRAINT "refund_requests_rejected_feedback" CHECK ("refund_requests"."status" <> 'rejected' OR "refund_requests"."admin_feedback" IS NOT NULL),
	CONSTRAINT "refund_requests_failed_feedback" CHECK ("refund_requests"."status" <> 'failed' OR "refund_requests"."admin_feedback" IS NOT NULL),
	CONSTRAINT "refund_requests_review_pair" CHECK (("refund_requests"."reviewed_by_admin_user_id" IS NULL) = ("refund_requests"."reviewed_at" IS NULL)),
	CONSTRAINT "refund_requests_decision_has_admin" CHECK ("refund_requests"."status" NOT IN ('awaiting_provider', 'rejected', 'failed') OR "refund_requests"."reviewed_by_admin_user_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "admin_audit_events" DROP CONSTRAINT "aae_entity_type_check";--> statement-breakpoint
ALTER TABLE "enrollment_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "refund_events" ADD CONSTRAINT "refund_events_refund_request_id_refund_requests_id_fk" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_events" ADD CONSTRAINT "refund_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_enrollment_request_id_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."enrollment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewed_by_admin_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_events_refund_idx" ON "refund_events" USING btree ("refund_request_id","created_at");--> statement-breakpoint
CREATE INDEX "refund_requests_student_idx" ON "refund_requests" USING btree ("student_user_id","requested_at");--> statement-breakpoint
CREATE INDEX "refund_requests_status_idx" ON "refund_requests" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "refund_requests_enrollment_idx" ON "refund_requests" USING btree ("enrollment_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_one_live_per_payment" ON "refund_requests" USING btree ("payment_id") WHERE status IN ('requested', 'awaiting_provider');--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "aae_entity_type_check" CHECK ("admin_audit_events"."entity_type" IN ('teacher', 'course', 'refund'));