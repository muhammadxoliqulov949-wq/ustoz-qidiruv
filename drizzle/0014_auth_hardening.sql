-- Phase 23.5 Security Hardening: Enforce single active verification token per user
--
-- Remove duplicate tokens keeping the latest one before adding the unique constraint
DELETE FROM "email_verification_tokens" a
USING "email_verification_tokens" b
WHERE a.user_id = b.user_id AND a.created_at < b.created_at;--> statement-breakpoint

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "evt_user_id_unique" UNIQUE ("user_id");
