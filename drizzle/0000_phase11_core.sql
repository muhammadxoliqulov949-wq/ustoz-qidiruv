CREATE TYPE "public"."course_format" AS ENUM('online', 'offline', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."course_level" AS ENUM('boshlangich', 'orta', 'yuqori');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'ready');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('submitted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified');--> statement-breakpoint
CREATE TABLE "course_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"days" text[] DEFAULT '{}'::text[] NOT NULL,
	"start_time" text NOT NULL,
	"capacity" integer NOT NULL,
	"start_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_groups_id_course_key" UNIQUE("id","course_id"),
	CONSTRAINT "course_groups_capacity_check" CHECK ("course_groups"."capacity" BETWEEN 1 AND 500),
	CONSTRAINT "course_groups_time_format" CHECK ("course_groups"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "course_groups_date_format" CHECK ("course_groups"."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
	CONSTRAINT "course_groups_days_check" CHECK (coalesce(array_length("course_groups"."days", 1), 0) >= 1)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"teacher_user_id" text NOT NULL,
	"title" text NOT NULL,
	"category_id" text NOT NULL,
	"level" "course_level" NOT NULL,
	"format" "course_format" NOT NULL,
	"city" text,
	"location" text,
	"price_uzs" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"long_description" text DEFAULT '' NOT NULL,
	"audience" text[] DEFAULT '{}'::text[] NOT NULL,
	"learning_outcomes" text[] DEFAULT '{}'::text[] NOT NULL,
	"teaching_languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_key" UNIQUE("slug"),
	CONSTRAINT "courses_slug_format" CHECK ("courses"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "courses_price_check" CHECK ("courses"."price_uzs" >= 0 AND "courses"."price_uzs" <= 100000000),
	CONSTRAINT "courses_title_check" CHECK (length(btrim("courses"."title")) BETWEEN 8 AND 120),
	CONSTRAINT "courses_online_no_location" CHECK (("courses"."format" = 'online' AND "courses"."city" IS NULL AND "courses"."location" IS NULL)
          OR ("courses"."format" <> 'online' AND "courses"."city" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "enrollment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"group_id" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "enrollment_status" DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_requests_unique_live" UNIQUE("student_user_id","group_id","status"),
	CONSTRAINT "enrollment_requests_note_len" CHECK (length("enrollment_requests"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"preferred_format" text,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_role_check" CHECK ("student_profiles"."role" = 'student'),
	CONSTRAINT "student_profiles_format_check" CHECK ("student_profiles"."preferred_format" IS NULL OR "student_profiles"."preferred_format" IN ('online','offline','both')),
	CONSTRAINT "student_profiles_name_check" CHECK (length(btrim("student_profiles"."name")) BETWEEN 2 AND 70)
);
--> statement-breakpoint
CREATE TABLE "syllabus_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"lessons" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "syllabus_modules_course_position_key" UNIQUE("course_id","position"),
	CONSTRAINT "syllabus_modules_position_check" CHECK ("syllabus_modules"."position" >= 0),
	CONSTRAINT "syllabus_modules_lessons_check" CHECK ("syllabus_modules"."lessons" BETWEEN 0 AND 500)
);
--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'teacher' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"district" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"formats" text[] DEFAULT '{}'::text[] NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"experience_years" integer,
	"bio" text,
	"approach" text,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_profiles_slug_key" UNIQUE("slug"),
	CONSTRAINT "teacher_profiles_role_check" CHECK ("teacher_profiles"."role" = 'teacher'),
	CONSTRAINT "teacher_profiles_slug_format" CHECK ("teacher_profiles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "teacher_profiles_name_check" CHECK (length(btrim("teacher_profiles"."name")) BETWEEN 2 AND 70),
	CONSTRAINT "teacher_profiles_experience_check" CHECK ("teacher_profiles"."experience_years" IS NULL OR ("teacher_profiles"."experience_years" >= 0 AND "teacher_profiles"."experience_years" <= 60))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_key" UNIQUE("phone"),
	CONSTRAINT "users_id_role_key" UNIQUE("id","role"),
	CONSTRAINT "users_phone_format" CHECK ("users"."phone" ~ '^\+998[0-9]{9}$'),
	CONSTRAINT "users_password_hash_not_plain" CHECK ("users"."password_hash" LIKE '$argon2%')
);
--> statement-breakpoint
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_user_id_teacher_profiles_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."teacher_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_student_user_id_student_profiles_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_requests" ADD CONSTRAINT "enrollment_requests_group_course_fk" FOREIGN KEY ("group_id","course_id") REFERENCES "public"."course_groups"("id","course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_role_fk" FOREIGN KEY ("user_id","role") REFERENCES "public"."users"("id","role") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_modules" ADD CONSTRAINT "syllabus_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_role_fk" FOREIGN KEY ("user_id","role") REFERENCES "public"."users"("id","role") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_groups_course_idx" ON "course_groups" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courses_teacher_idx" ON "courses" USING btree ("teacher_user_id");--> statement-breakpoint
CREATE INDEX "enrollment_requests_student_idx" ON "enrollment_requests" USING btree ("student_user_id");--> statement-breakpoint
CREATE INDEX "enrollment_requests_course_idx" ON "enrollment_requests" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "syllabus_modules_course_idx" ON "syllabus_modules" USING btree ("course_id");