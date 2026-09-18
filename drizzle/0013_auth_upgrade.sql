-- Phase 23.5 Authentication Upgrade
--
-- 1. Drop users_email_admin_only constraint so students and teachers can register with email
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_admin_only";--> statement-breakpoint

-- 2. Allow password_hash to be nullable for OAuth-only users
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_password_hash_not_plain";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_not_plain" CHECK ("password_hash" IS NULL OR "password_hash" LIKE '$argon2%');--> statement-breakpoint

-- 3. Add email_verified_at to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;--> statement-breakpoint

-- 4. Create auth_accounts table for OAuth provider identities
CREATE TABLE IF NOT EXISTS "auth_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "provider_email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_accounts_provider_account_unique" UNIQUE("provider", "provider_account_id")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "auth_accounts_user_id_idx" ON "auth_accounts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_accounts_provider_email_idx" ON "auth_accounts" ("provider", "provider_email");--> statement-breakpoint

-- 5. Create email_verification_tokens table for email/password verification lifecycle
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "email" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evt_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "evt_user_id_idx" ON "email_verification_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evt_expires_at_idx" ON "email_verification_tokens" ("expires_at");
