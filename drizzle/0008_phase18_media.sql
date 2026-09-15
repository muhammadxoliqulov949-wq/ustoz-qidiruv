CREATE TYPE "public"."file_purpose" AS ENUM('teacher_verification_document', 'teacher_profile_image', 'course_cover_image');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'active', 'superseded', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."verification_document_type" AS ENUM('identity_document', 'qualification_evidence');--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"course_id" text,
	"purpose" "file_purpose" NOT NULL,
	"visibility" "file_visibility" NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum_sha256" text,
	"document_type" "verification_document_type",
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"activated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_assets_provider_key_unique" UNIQUE("storage_provider","storage_key"),
	CONSTRAINT "file_assets_byte_size_positive" CHECK ("file_assets"."byte_size" > 0),
	CONSTRAINT "file_assets_checksum_hex" CHECK ("file_assets"."checksum_sha256" IS NULL OR "file_assets"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "file_assets_visibility_matches_purpose" CHECK (("file_assets"."purpose" = 'teacher_verification_document') = ("file_assets"."visibility" = 'private')),
	CONSTRAINT "file_assets_key_namespace" CHECK (("file_assets"."visibility" = 'private' AND "file_assets"."storage_key" LIKE 'private/%')
          OR ("file_assets"."visibility" = 'public' AND "file_assets"."storage_key" LIKE 'public/%')),
	CONSTRAINT "file_assets_course_scope" CHECK (("file_assets"."purpose" = 'course_cover_image') = ("file_assets"."course_id" IS NOT NULL)),
	CONSTRAINT "file_assets_document_type_scope" CHECK (("file_assets"."purpose" = 'teacher_verification_document') = ("file_assets"."document_type" IS NOT NULL)),
	CONSTRAINT "file_assets_activation_consistency" CHECK (("file_assets"."status" <> 'pending' OR "file_assets"."activated_at" IS NULL)
          AND ("file_assets"."status" NOT IN ('active', 'superseded') OR "file_assets"."activated_at" IS NOT NULL)),
	CONSTRAINT "file_assets_deleted_at_consistency" CHECK (("file_assets"."status" = 'deleted') = ("file_assets"."deleted_at" IS NOT NULL)),
	CONSTRAINT "file_assets_original_name_len" CHECK (length("file_assets"."original_file_name") BETWEEN 1 AND 255)
);
--> statement-breakpoint
CREATE TABLE "teacher_verification_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"verification_request_id" text NOT NULL,
	"file_asset_id" text NOT NULL,
	"document_type" "verification_document_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tvd_request_asset_unique" UNIQUE("verification_request_id","file_asset_id")
);
--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verification_documents" ADD CONSTRAINT "teacher_verification_documents_verification_request_id_teacher_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."teacher_verification_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verification_documents" ADD CONSTRAINT "teacher_verification_documents_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_assets_owner_idx" ON "file_assets" USING btree ("owner_user_id","purpose","status");--> statement-breakpoint
CREATE INDEX "file_assets_course_idx" ON "file_assets" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "file_assets_status_idx" ON "file_assets" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_one_active_profile_image" ON "file_assets" USING btree ("owner_user_id") WHERE purpose = 'teacher_profile_image' AND status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_one_active_course_cover" ON "file_assets" USING btree ("course_id") WHERE purpose = 'course_cover_image' AND status = 'active';--> statement-breakpoint
CREATE INDEX "tvd_request_idx" ON "teacher_verification_documents" USING btree ("verification_request_id","created_at");--> statement-breakpoint
CREATE INDEX "tvd_asset_idx" ON "teacher_verification_documents" USING btree ("file_asset_id");