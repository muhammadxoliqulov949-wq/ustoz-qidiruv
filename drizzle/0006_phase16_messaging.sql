-- no-transaction
-- Phase 16 — private student <-> teacher messaging.
--
-- Extends `notification_type` (an enum, hence `-- no-transaction`: PostgreSQL
-- forbids ALTER TYPE ... ADD VALUE inside a transaction block) and adds the
-- three messaging tables. Purely additive: no column is dropped, retyped or
-- moved, so a Phase 15 database upgrades in place.
--
-- The participants of a conversation are NOT stored here. They are derived
-- from the enrollment row (student) and its course (teacher); see the schema
-- comment block for the reasoning.
--
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'message_received';--> statement-breakpoint
CREATE TABLE "conversation_reads" (
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_message_id" text NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_reads_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_updated_after_created" CHECK ("conversations"."updated_at" >= "conversations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_id_conversation_key" UNIQUE("id","conversation_id"),
	CONSTRAINT "messages_body_len" CHECK (length("messages"."body") BETWEEN 1 AND 2000),
	CONSTRAINT "messages_body_trimmed" CHECK ("messages"."body" = btrim("messages"."body"))
);
--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_message_fk" FOREIGN KEY ("last_read_message_id","conversation_id") REFERENCES "public"."messages"("id","conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_enrollment_request_id_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."enrollment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_reads_user_idx" ON "conversation_reads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_enrollment_key" ON "conversations" USING btree ("enrollment_request_id");--> statement-breakpoint
CREATE INDEX "conversations_activity_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_sender_created_idx" ON "messages" USING btree ("sender_user_id","created_at");