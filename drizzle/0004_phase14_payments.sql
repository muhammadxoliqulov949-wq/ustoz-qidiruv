-- no-transaction
--
-- Phase 14 — payment foundation and Payme integration.
--
-- Runs OUTSIDE a transaction because `ALTER TYPE ... ADD VALUE` cannot be
-- executed inside one on this Postgres version. The migration runner in
-- scripts/db.ts honours this marker on the first line (same as 0003).
--
-- Additive only: three new tables, three new enums and one new value on
-- notification_type. No prior migration is rewritten and no existing column
-- changes type, so this applies cleanly to an existing Phase 13 database.
--
CREATE TYPE "public"."payment_event_type" AS ENUM('payment_created', 'provider_transaction_created', 'payment_succeeded', 'provider_cancelled', 'payment_failed');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('payme');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'cancelled', 'failed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'payment_succeeded';--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"type" "payment_event_type" NOT NULL,
	"provider" "payment_provider" DEFAULT 'payme' NOT NULL,
	"provider_transaction_id" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_metadata_len" CHECK ("payment_events"."metadata" IS NULL OR length("payment_events"."metadata") <= 500)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"provider" "payment_provider" DEFAULT 'payme' NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"provider_created_at" bigint NOT NULL,
	"state" integer NOT NULL,
	"reason_code" integer,
	"performed_at" bigint,
	"cancelled_at" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_provider_tx_unique" UNIQUE("provider","provider_transaction_id"),
	CONSTRAINT "payment_transactions_state_valid" CHECK ("payment_transactions"."state" IN (1, 2, -1, -2))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_request_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"provider" "payment_provider" DEFAULT 'payme' NOT NULL,
	"amount_tiyin" bigint NOT NULL,
	"currency" text DEFAULT 'UZS' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_tiyin" > 0),
	CONSTRAINT "payments_currency_supported" CHECK ("payments"."currency" = 'UZS'),
	CONSTRAINT "payments_paid_at_consistent" CHECK (("payments"."status" = 'succeeded') = ("payments"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_request_id_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."enrollment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_transactions_payment_idx" ON "payment_transactions" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_live_per_enrollment" ON "payments" USING btree ("enrollment_request_id") WHERE status IN ('pending', 'succeeded');--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_user_id");--> statement-breakpoint
CREATE INDEX "payments_enrollment_idx" ON "payments" USING btree ("enrollment_request_id");