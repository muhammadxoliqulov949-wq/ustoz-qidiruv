-- Admin operator identity: email + password.
--
-- WHY. Operator accounts were bootstrap-only by phone (`admin:create`), so an
-- admin had to hold an Uzbek mobile number to sign in. This adds a second,
-- separate identifier kind for operators WITHOUT touching marketplace auth:
-- students and teachers still log in with "+998XXXXXXXXX" + password, and their
-- rows are not modified by this file.
--
-- ADDITIVE, and safe on a live database:
--   * one new nullable column (`users.email`), no rewrite of existing rows;
--   * `phone` loses NOT NULL so an operator account can exist with an email
--     only. No row is updated, and the existing `users_phone_format` CHECK is
--     NULL-safe by SQL semantics (NULL ~ pattern is NULL, and a CHECK only
--     rejects FALSE), so it keeps protecting every phone that exists;
--   * four new constraints, each satisfied by every pre-existing row (they all
--     have a phone and a NULL email), so ADD CONSTRAINT validates cleanly
--     without NOT VALID and without a table scan failure.
--
-- WHAT THE CONSTRAINTS MEAN.
--   users_email_key            one account per address (NULLs stay distinct, so
--                              marketplace rows are unaffected).
--   users_email_admin_only     an email can ONLY exist on role='admin'. A
--                              student/teacher row can never be given an email
--                              identifier, so the email login path can never
--                              authenticate a marketplace account.
--   users_email_normalized     stored addresses are trimmed lowercase, which is
--                              what makes the unique index case-insensitive
--                              without the citext extension.
--   users_email_format         one @, no whitespace, a dot in the domain.
--   users_has_one_identifier   no account exists that cannot be addressed.
--
-- An email operator still has NO student_profiles / teacher_profiles row: the
-- composite FK on users(id, role) plus each profile's own role CHECK keep an
-- admin out of the marketplace, exactly as before.
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_has_one_identifier" CHECK ("users"."phone" IS NOT NULL OR "users"."email" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_admin_only" CHECK ("users"."email" IS NULL OR "users"."role" = 'admin');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("users"."email" IS NULL OR ("users"."email" = lower(btrim("users"."email")) AND length("users"."email") BETWEEN 6 AND 254));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_format" CHECK ("users"."email" IS NULL OR "users"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');