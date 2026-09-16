CREATE TABLE "rate_limit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_limit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_events_key_len" CHECK (length("rate_limit_events"."key") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_key_created_idx" ON "rate_limit_events" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");