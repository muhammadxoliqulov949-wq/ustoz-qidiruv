import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { desc, relations, sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* USTOZ core schema — Phase 11.                                               */
/*                                                                              */
/* Integrity is enforced by the DATABASE, not by TypeScript:                   */
/*   • foreign keys with explicit ON DELETE behaviour;                          */
/*   • CHECK constraints for enum-like ranges, price/capacity bounds and the    */
/*     format ⇄ location rule (online courses cannot carry an address);         */
/*   • UNIQUE constraints for phone, slug, session token and the "one profile   */
/*     per user" rule;                                                           */
/*   • the role-integrity rule (a teacher_profile may only point at a           */
/*     role='teacher' user) is enforced with a composite FK onto (id, role),    */
/*     so the database itself makes a mismatched profile impossible.            */
/*                                                                              */
/* Nothing here stores a plaintext password or a raw session token: the user    */
/* table holds an argon2id hash, the session table holds a SHA-256 hash of the  */
/* opaque cookie value.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Account roles.
 *
 * `admin` (Phase 15) is deliberately NOT reachable from any public surface:
 * registration, onboarding and every client form validate against the narrower
 * two-value `roleSchema` in validation.ts, so no HTTP input can produce it. An
 * admin row can only be created out-of-band by the server-only operator CLI
 * (`npm run admin:promote` / `admin:create`) — see scripts/admin.ts.
 */
export const userRole = pgEnum("user_role", ["student", "teacher", "admin"]);

/**
 * Teacher trust state. Honest states only — a teacher is NEVER auto-verified.
 *
 * Phase 15 keeps exactly these three values. A REJECTED verification request
 * does NOT add a `rejected` value here: the profile returns to `unverified`,
 * and the rejection itself lives on the request row (status, feedback,
 * reviewed_at). That keeps the profile column a *current state* rather than a
 * permanent scar, so a teacher can always fix their profile and re-apply.
 */
export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
]);

export const courseFormat = pgEnum("course_format", ["online", "offline", "hybrid"]);
export const courseLevel = pgEnum("course_level", ["boshlangich", "orta", "yuqori"]);

/** Phase 11 keeps the honest two-state lifecycle from Phase 10. */
/**
 * Phase 12 lifecycle, made real in Phase 15.
 *
 *   draft      — the teacher's private work in progress.
 *   ready      — the teacher considers it finished and has submitted it to
 *                admin moderation. STILL PRIVATE.
 *   published  — in the public catalogue. Requires `published_at` (DB CHECK)
 *                and can only be set by an admin moderation decision.
 *
 * There is deliberately NO `rejected` / `changes_requested` value here: a
 * returned course goes back to `draft` and the moderation decision is recorded
 * on `course_moderation_reviews`. A permanent status for "was sent back once"
 * would describe history, and history belongs in the history table.
 */
export const courseStatus = pgEnum("course_status", ["draft", "ready", "published"]);

/** Representative lesson time-of-day — drives the Phase 3 schedule facet. */
export const courseSchedule = pgEnum("course_schedule", ["morning", "day", "evening"]);

/**
 * Enrollment states — Phase 13 implements the real decision workflow, so
 * `accepted` and `rejected` now exist and are genuinely reachable.
 *
 * Still deliberately ABSENT: paid / completed / refunded / expired /
 * waitlisted. Those workflows do not exist, so the database cannot express
 * them and no UI can imply them.
 */
export const enrollmentStatus = pgEnum("enrollment_status", [
  "submitted",
  "accepted",
  "rejected",
  "cancelled",
]);

/**
 * In-app notification kinds. One value per event that is actually emitted by
 * a server action — no marketing or speculative types.
 */
export const notificationType = pgEnum("notification_type", [
  "enrollment_submitted",
  "enrollment_accepted",
  "enrollment_rejected",
  "enrollment_cancelled",
  // Phase 14. Created ONLY from a verified provider callback, never from a
  // browser redirect or a query parameter.
  "payment_succeeded",
  // Phase 15. Emitted by an admin decision, inside the same transaction that
  // records the decision, so a notification can never describe a rolled-back
  // action. Teachers only — no admin-facing notification types exist.
  "verification_approved",
  "verification_rejected",
  "course_published",
  "course_changes_requested",
  // Phase 16. One COLLAPSED notification per conversation while the recipient
  // has it unread — a long exchange must not spam the bell (see messaging
  // service, `notifyRecipient`).
  "message_received",
  // Phase 17. Refund lifecycle. The student is told what actually happened to
  // their money at each authenticated step; the teacher is told only that a
  // paid place was refunded, and admins are told when a reversal arrived from
  // the provider that nobody in the application asked for.
  "refund_requested",
  "refund_approved",
  "refund_rejected",
  "refund_completed",
  "refund_failed",
  "refund_provider_reversal",
  /*
   * Phase 19. A review decision changes what the PUBLIC marketplace says about a
   * course and its teacher, so the student is told the outcome rather than left
   * refreshing the page to discover it. Nothing is emitted for `pending` or
   * `withdrawn`: submitting your own review needs no confirmation from the system,
   * and withdrawing is your own action.
   */
  "review_published",
  "review_rejected",
]);

/* ---------------------------------- users ---------------------------------- */

/**
 * Accounts — and the two IDENTIFIER KINDS that can never mix.
 *
 * A marketplace account (student/teacher) is identified by its phone number;
 * an operator account (`role = 'admin'`) may instead be identified by an email
 * address. Both are enforced here, by the database, not by application code:
 *
 *   • `users_email_admin_only`  — an email can only exist on an admin row, so
 *     no student or teacher can ever be given (or log in with) an email
 *     identifier, and no registration payload can smuggle one in;
 *   • `users_has_one_identifier` — every account has at least one way to be
 *     addressed; there is no such thing as an identifier-less user;
 *   • `users_email_normalized`  — stored emails are trimmed lowercase, which
 *     is what makes the UNIQUE index case-insensitive without citext;
 *   • `users_phone_format`      — NULL-safe by SQL semantics (`NULL ~ pattern`
 *     is NULL, and a CHECK only rejects FALSE), so an email-only operator row
 *     satisfies it without the constraint being rewritten.
 *
 * An email operator account has NO phone and NO profile row, so it cannot own
 * courses, enrollments or a public marketplace identity (see the composite role
 * FKs below and scripts/admin.ts).
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    role: userRole("role").notNull(),
    /**
     * Canonical E.164-ish "+998XXXXXXXXX" — the marketplace account
     * identifier. NULL only for an email-identified operator account.
     */
    phone: text("phone"),
    /**
     * Operator (admin) login identifier: normalized lowercase, unique, and
     * structurally unavailable to any non-admin role. NULL for every
     * student/teacher account.
     */
    email: text("email"),
    /** argon2id hash. Never a plaintext password, never reversible. */
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NULLs are distinct in PostgreSQL, so every marketplace account keeps a
    // NULL email and only real addresses collide.
    unique("users_phone_key").on(table.phone),
    unique("users_email_key").on(table.email),
    // Target for the composite role FKs used by the profile tables.
    unique("users_id_role_key").on(table.id, table.role),
    check("users_phone_format", sql`${table.phone} ~ '^\\+998[0-9]{9}$'`),
    check("users_password_hash_not_plain", sql`${table.passwordHash} LIKE '$argon2%'`),
    check(
      "users_has_one_identifier",
      sql`${table.phone} IS NOT NULL OR ${table.email} IS NOT NULL`,
    ),
    check("users_email_admin_only", sql`${table.email} IS NULL OR ${table.role} = 'admin'`),
    check(
      "users_email_normalized",
      sql`${table.email} IS NULL OR (${table.email} = lower(btrim(${table.email})) AND length(${table.email}) BETWEEN 6 AND 254)`,
    ),
    check(
      "users_email_format",
      sql`${table.email} IS NULL OR ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
  ],
);

/* -------------------------------- sessions --------------------------------- */

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    /** SHA-256 of the opaque cookie value — the raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

/* ----------------------------- student profiles ---------------------------- */

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: text("user_id").primaryKey(),
    /** Duplicated for the composite role FK below; kept in sync by that FK. */
    role: userRole("role").notNull().default("student"),
    name: text("name").notNull(),
    city: text("city"),
    /** "online" | "offline" | "both" */
    preferredFormat: text("preferred_format"),
    /** ISO-639-1 upper tags, e.g. {UZ,EN}. */
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    /** Category slugs the learner follows. */
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite FK onto users(id, role): the DB itself refuses a student
    // profile attached to a teacher-role user.
    foreignKey({
      name: "student_profiles_user_role_fk",
      columns: [table.userId, table.role],
      foreignColumns: [users.id, users.role],
    }).onDelete("cascade"),
    check("student_profiles_role_check", sql`${table.role} = 'student'`),
    check(
      "student_profiles_format_check",
      sql`${table.preferredFormat} IS NULL OR ${table.preferredFormat} IN ('online','offline','both')`,
    ),
    check("student_profiles_name_check", sql`length(btrim(${table.name})) BETWEEN 2 AND 70`),
  ],
);

/* ----------------------------- teacher profiles ---------------------------- */

export const teacherProfiles = pgTable(
  "teacher_profiles",
  {
    userId: text("user_id").primaryKey(),
    role: userRole("role").notNull().default("teacher"),
    /** Public profile slug (/teachers/[slug]) — unique across the platform. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    district: text("district"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    levels: text("levels").array().notNull().default(sql`'{}'::text[]`),
    formats: text("formats").array().notNull().default(sql`'{}'::text[]`),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    experienceYears: integer("experience_years"),
    bio: text("bio"),
    approach: text("approach"),
    /** Defaults to UNVERIFIED. No product path sets 'verified'. */
    verification: verificationStatus("verification").notNull().default("unverified"),
    /* ------------- Phase 12 public-profile parity columns ------------- */
    photo: text("photo"),
    /** Short public label, e.g. "IELTS va umumiy ingliz tili". */
    specialization: text("specialization"),
    ratingX10: integer("rating_x10").notNull().default(0),
    reviewsCount: integer("reviews_count").notNull().default(0),
    studentsCount: integer("students_count").notNull().default(0),
    /** Only a profile that is public appears in /teachers. Teacher accounts
     *  created through registration are NOT public until they have a
     *  published course — see repo.listPublicTeachers(). */
    isPublic: boolean("is_public").notNull().default(false),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "teacher_profiles_user_role_fk",
      columns: [table.userId, table.role],
      foreignColumns: [users.id, users.role],
    }).onDelete("cascade"),
    unique("teacher_profiles_slug_key").on(table.slug),
    check("teacher_profiles_role_check", sql`${table.role} = 'teacher'`),
    check("teacher_profiles_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("teacher_profiles_name_check", sql`length(btrim(${table.name})) BETWEEN 2 AND 70`),
    check(
      "teacher_profiles_experience_check",
      sql`${table.experienceYears} IS NULL OR (${table.experienceYears} >= 0 AND ${table.experienceYears} <= 60)`,
    ),
    check("teacher_profiles_rating_check", sql`${table.ratingX10} BETWEEN 0 AND 50`),
    check("teacher_profiles_reviews_check", sql`${table.reviewsCount} >= 0`),
    check("teacher_profiles_students_check", sql`${table.studentsCount} >= 0`),
    index("teacher_profiles_public_idx").on(table.isPublic),
  ],
);

/* --------------------------------- courses --------------------------------- */

export const courses = pgTable(
  "courses",
  {
    id: text("id").primaryKey(),
    /** Public slug (/courses/[slug]); unique. */
    slug: text("slug").notNull(),
    teacherUserId: text("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    categoryId: text("category_id").notNull(),
    level: courseLevel("level").notNull(),
    format: courseFormat("format").notNull(),
    city: text("city"),
    location: text("location"),
    /** 0 = free. Monthly price in UZS (the only unit the product supports). */
    priceUzs: integer("price_uzs").notNull().default(0),
    summary: text("summary").notNull(),
    longDescription: text("long_description").notNull().default(""),
    audience: text("audience").array().notNull().default(sql`'{}'::text[]`),
    learningOutcomes: text("learning_outcomes").array().notNull().default(sql`'{}'::text[]`),
    teachingLanguages: text("teaching_languages").array().notNull().default(sql`'{}'::text[]`),
    status: courseStatus("status").notNull().default("draft"),
    /* ---------------------------------------------------------------------
     * Phase 12 marketplace parity columns. Each one exists because the
     * APPROVED public UI already renders it; none is speculative.
     * ------------------------------------------------------------------ */
    schedule: courseSchedule("schedule").notNull().default("evening"),
    /** Marketplace aggregate, 0..5 stored x10 as an integer to avoid float
     *  drift in sorting (45 = 4.5). Displayed as one decimal. */
    ratingX10: integer("rating_x10").notNull().default(0),
    reviewsCount: integer("reviews_count").notNull().default(0),
    studentsCount: integer("students_count").notNull().default(0),
    /** ISO "YYYY-MM-DD" — the deterministic "Eng yangi" sort key. Set when a
     *  course is first published; null while it is only a draft. */
    publishedAt: text("published_at"),
    /** Lowercase search synonyms; part of the SQL search haystack. */
    keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
    image: text("image"),
    pricePeriod: text("price_period").notNull().default("month"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("courses_slug_key").on(table.slug),
    index("courses_teacher_idx").on(table.teacherUserId),
    // Public listing reads always filter on status; the partial index keeps
    // that path cheap without indexing the (larger) draft space.
    index("courses_public_idx").on(table.status, table.categoryId),
    index("courses_published_at_idx").on(table.publishedAt),
    check("courses_rating_check", sql`${table.ratingX10} BETWEEN 0 AND 50`),
    check("courses_reviews_check", sql`${table.reviewsCount} >= 0`),
    check("courses_students_check", sql`${table.studentsCount} >= 0`),
    check(
      "courses_published_at_format",
      sql`${table.publishedAt} IS NULL OR ${table.publishedAt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    // A published course must carry the date the listing went public.
    check(
      "courses_published_requires_date",
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
    check("courses_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("courses_price_check", sql`${table.priceUzs} >= 0 AND ${table.priceUzs} <= 100000000`),
    check("courses_title_check", sql`length(btrim(${table.title})) BETWEEN 8 AND 120`),
    // Online courses are structurally incapable of holding a physical address.
    check(
      "courses_online_no_location",
      sql`(${table.format} = 'online' AND ${table.city} IS NULL AND ${table.location} IS NULL)
          OR (${table.format} <> 'online' AND ${table.city} IS NOT NULL)`,
    ),
  ],
);

/* ------------------------------ course groups ------------------------------ */

export const courseGroups = pgTable(
  "course_groups",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Uzbek day abbreviations, e.g. {Du,Chor,Jum}. */
    days: text("days").array().notNull().default(sql`'{}'::text[]`),
    /** "HH:MM". */
    startTime: text("start_time").notNull(),
    /** Optional: the canonical dataset only records a start time, so this is
     *  nullable rather than back-filled with an invented duration. Teacher
     *  authoring collects it, so new groups have it. */
    endTime: text("end_time"),
    /** A group may run in a different mode than its course (hybrid courses
     *  have both online and offline groups) — the detail page shows this. */
    format: courseFormat("format").notNull().default("online"),
    location: text("location"),
    /** Planned seats. NOTE: there is deliberately no occupied-seat column. */
    capacity: integer("capacity").notNull(),
    startDate: text("start_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite target so an enrollment can prove (course, group) consistency.
    unique("course_groups_id_course_key").on(table.id, table.courseId),    index("course_groups_course_idx").on(table.courseId),
    check("course_groups_capacity_check", sql`${table.capacity} BETWEEN 1 AND 500`),
    check("course_groups_time_format", sql`${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check(
      "course_groups_end_time_format",
      sql`${table.endTime} IS NULL OR (${table.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.endTime} > ${table.startTime})`,
    ),
    check("course_groups_date_format", sql`${table.startDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
    check("course_groups_days_check", sql`coalesce(array_length(${table.days}, 1), 0) >= 1`),
  ],
);

/* ---------------------------- syllabus modules ----------------------------- */

export const syllabusModules = pgTable(
  "syllabus_modules",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** 0-based explicit ordering — module order is data, not insertion luck. */
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    lessons: integer("lessons").notNull().default(0),
  },
  (table) => [
    unique("syllabus_modules_course_position_key").on(table.courseId, table.position),
    index("syllabus_modules_course_idx").on(table.courseId),
    check("syllabus_modules_position_check", sql`${table.position} >= 0`),
    check("syllabus_modules_lessons_check", sql`${table.lessons} BETWEEN 0 AND 500`),
  ],
);

/* --------------------------- enrollment requests --------------------------- */

export const enrollmentRequests = pgTable(
  "enrollment_requests",
  {
    id: text("id").primaryKey(),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    groupId: text("group_id").notNull(),
    /** Free-text note from the student (plain text; escaped at render). */
    note: text("note").notNull().default(""),
    status: enrollmentStatus("status").notNull().default("submitted"),
    /** Optional short teacher message attached to a rejection. Plain text,
     *  length-bounded, escaped at render. Never required. */
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The composite FK makes "group belongs to a different course" IMPOSSIBLE
    // at the database level, not merely unlikely in application code.
    foreignKey({
      name: "enrollment_requests_group_course_fk",
      columns: [table.groupId, table.courseId],
      foreignColumns: [courseGroups.id, courseGroups.courseId],
    }).onDelete("cascade"),
    index("enrollment_requests_student_idx").on(table.studentUserId),
    index("enrollment_requests_course_idx").on(table.courseId),
    // Capacity is derived by counting ACCEPTED rows per group, so that query
    // gets its own index.
    index("enrollment_requests_group_status_idx").on(table.groupId, table.status),
    /*
     * Phase 19: composite FK target for `course_reviews`.
     *
     * `id` is already the primary key, so these three columns are unique by
     * definition — the constraint costs nothing and rewrites nothing. What it buys
     * is a target a review can point at with ALL THREE of its ownership columns at
     * once, which is how the database itself (not a `SELECT` in the service)
     * refuses a review claiming someone else's enrollment.
     */
    unique("enrollment_requests_id_student_course_key").on(
      table.id,
      table.studentUserId,
      table.courseId,
    ),
    // ONE LIVE REQUEST PER STUDENT PER GROUP.
    //
    // Phase 11 keyed this on (student, group, status), which was fine with two
    // statuses but breaks with four: a student could hold `submitted` AND
    // `accepted` rows for the same group at once. A PARTIAL unique index over
    // the live statuses expresses the real rule, and because it is an index it
    // also holds against two concurrent submissions.
    uniqueIndex("enrollment_requests_one_live_per_group")
      .on(table.studentUserId, table.groupId)
      .where(sql`status IN ('submitted', 'accepted')`),
    check("enrollment_requests_note_len", sql`length(${table.note}) <= 500`),
    check(
      "enrollment_requests_decision_reason_len",
      sql`${table.decisionReason} IS NULL OR length(${table.decisionReason}) <= 300`,
    ),
  ],
);

/* ---------------------------- enrollment events ---------------------------- */

/**
 * Append-only history of enrollment status transitions — Phase 13.
 *
 * This is NOT an admin audit system and is never exposed publicly. It exists
 * so an enrollment's path (who moved it, from what, to what, when) survives,
 * which keeps the status columns honest and makes future debugging possible
 * without inventing extra timestamp columns on the request row itself.
 */
export const enrollmentEvents = pgTable(
  "enrollment_events",
  {
    id: text("id").primaryKey(),
    enrollmentRequestId: text("enrollment_request_id")
      .notNull()
      .references(() => enrollmentRequests.id, { onDelete: "cascade" }),
    /**
     * Who performed the transition.
     *
     * NULL means no session user did: Phase 17 cancels an enrollment when an
     * AUTHENTICATED provider callback confirms that the money was returned, and
     * attributing that to the student would misrepresent the history. The
     * matching `refund_events` row carries the provider evidence.
     */
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** NULL for the creation event — there is no previous status. */
    fromStatus: enrollmentStatus("from_status"),
    toStatus: enrollmentStatus("to_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("enrollment_events_request_idx").on(table.enrollmentRequestId, table.createdAt),
    // A transition must actually change something.
    check(
      "enrollment_events_from_differs",
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} <> ${table.toStatus}`,
    ),
  ],
);

/* ------------------------- Phase 19 · reviews ------------------------------ */

/*
 * REVIEWS AND REPUTATION — Phase 19.
 *
 * This table replaces a compiled-in fixture list (`src/data/reviews.ts`, deleted in
 * this phase) as the ONLY source of a written review. Three properties matter, and
 * all three are enforced HERE rather than in a component:
 *
 *   1. A review is EARNED. It names an enrollment, and the composite FK below makes
 *      a review whose student/course pair is not that enrollment's own impossible
 *      to insert. Whether the enrollment is `accepted` and the group has started is
 *      checked in the service, inside the write transaction — the database cannot
 *      see "today", but it can see everything else.
 *   2. A review is MODERATED. Only `published` rows are read by any public query,
 *      and `published` is reachable only through the admin action, which re-checks
 *      the caller's role inside the same transaction.
 *   3. A review is SINGULAR. One row per (student, course), reused rather than
 *      replaced, so editing a published review can pull it back to `pending` and
 *      remove its old value from the public aggregates without ever leaving two
 *      rows arguing about the same opinion.
 *
 * `courses.rating_x10` / `courses.reviews_count` and the same pair on
 * `teacher_profiles` are CACHED AGGREGATES of these rows — they are recomputed by
 * `review-service` inside every transaction that changes visibility, so browse,
 * sort and filter can keep reading a plain column. They are not a second opinion.
 */

/**
 * Lifecycle of one written review.
 *
 *   pending   — submitted, not public, waiting for an admin decision.
 *   published — public, and the ONLY status that feeds any aggregate.
 *   rejected  — an admin declined it; the student may edit and resubmit.
 *   withdrawn — THE STUDENT took it back. Not an admin decision, so it carries no
 *               moderator.
 */
export const courseReviewStatus = pgEnum("course_review_status", [
  "pending",
  "published",
  "rejected",
  "withdrawn",
]);

export const courseReviews = pgTable(
  "course_reviews",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Author. FK to `student_profiles`, so a teacher or admin cannot be one. */
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    /** The accepted enrollment that earned this review. */
    enrollmentRequestId: text("enrollment_request_id")
      .notNull()
      .references(() => enrollmentRequests.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    /** Plain text. Trimmed and length-bounded; escaped at render, never HTML. */
    body: text("body").notNull(),
    status: courseReviewStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set only by an admin decision. NULL for pending AND for withdrawn. */
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    /** The deciding admin. NO ACTION on delete: the trail outlives the operator. */
    moderatedByAdminUserId: text("moderated_by_admin_user_id").references(() => users.id),
    /** Optional plain-text explanation shown to the student on a rejection. */
    moderationReason: text("moderation_reason"),
  },
  (table) => [
    // ONE review per student per course — the row is reused, never duplicated.
    unique("course_reviews_one_per_student_course").on(table.studentUserId, table.courseId),
    /*
     * THE OWNERSHIP PROOF. Every one of the review's three ownership columns must
     * match ONE real enrollment row, so a crafted request cannot attach student A's
     * review to student B's enrollment, or move a review onto a different course.
     */
    foreignKey({
      name: "course_reviews_enrollment_owner_fk",
      columns: [table.enrollmentRequestId, table.studentUserId, table.courseId],
      foreignColumns: [
        enrollmentRequests.id,
        enrollmentRequests.studentUserId,
        enrollmentRequests.courseId,
      ],
    }).onDelete("restrict"),
    check("course_reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
    check("course_reviews_body_trimmed", sql`${table.body} = btrim(${table.body})`),
    check("course_reviews_body_length", sql`length(${table.body}) BETWEEN 20 AND 1500`),
    // A pending review has been decided by nobody.
    check(
      "course_reviews_pending_is_undecided",
      sql`${table.status} <> 'pending' OR (${table.moderatedAt} IS NULL AND ${table.moderatedByAdminUserId} IS NULL)`,
    ),
    // An admin decision carries both its actor and its moment.
    check(
      "course_reviews_decision_has_moderator",
      sql`${table.status} NOT IN ('published', 'rejected') OR (${table.moderatedAt} IS NOT NULL AND ${table.moderatedByAdminUserId} IS NOT NULL)`,
    ),
    // A withdrawal is the student's own act — it is never attributed to an admin.
    check(
      "course_reviews_withdrawn_by_student",
      sql`${table.status} <> 'withdrawn' OR (${table.moderatedAt} IS NULL AND ${table.moderatedByAdminUserId} IS NULL)`,
    ),
    check(
      "course_reviews_reason_only_on_rejection",
      sql`${table.status} = 'rejected' OR ${table.moderationReason} IS NULL`,
    ),
    check(
      "course_reviews_reason_length",
      sql`${table.moderationReason} IS NULL OR length(btrim(${table.moderationReason})) BETWEEN 10 AND 300`,
    ),
    // The public read: one course's published reviews, newest first.
    index("course_reviews_course_public_idx")
      .on(table.courseId, desc(table.createdAt))
      .where(sql`status = 'published'`),
    index("course_reviews_student_idx").on(table.studentUserId, table.courseId),
    // The admin queue: oldest undecided review first.
    index("course_reviews_status_created_idx").on(table.status, table.createdAt),
    index("course_reviews_moderator_idx").on(table.moderatedByAdminUserId),
    index("course_reviews_enrollment_idx").on(table.enrollmentRequestId),
    // The teacher aggregate joins courses once and filters published rows.
    index("course_reviews_course_status_idx").on(table.courseId, table.status),
  ],
);

/* ------------------------------- notifications ----------------------------- */

/**
 * In-app notifications — Phase 13. No email, SMS or push exists, so nothing
 * here implies external delivery.
 *
 * Every row belongs to exactly one recipient and every query is scoped to the
 * session user; `user_id` is never accepted from a client.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    /** Recipient. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** In-app destination for this notification, e.g. a request detail route. */
    href: text("href"),
    /** NULL until the recipient reads it. */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The list query is "my notifications, newest first".
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    // The unread badge counts unread rows for one user.
    index("notifications_user_unread_idx")
      .on(table.userId)
      .where(sql`read_at IS NULL`),
    check("notifications_title_len", sql`length(${table.title}) BETWEEN 1 AND 160`),
    check("notifications_body_len", sql`length(${table.body}) <= 500`),
  ],
);

/* --------------------------------- payments -------------------------------- */

/*
 * PAYMENT IS A SEPARATE DOMAIN FROM ENROLLMENT (Phase 14).
 *
 * `enrollment_status` is deliberately NOT extended with `paid`. A student may
 * hold an ACCEPTED place whose payment is still PENDING, and seat capacity is
 * owned by the enrollment status alone. Merging the two would make both
 * ambiguous.
 */

/** Which provider a payment is routed through. Payme is the only one built. */
export const paymentProvider = pgEnum("payment_provider", ["payme"]);

/**
 * Our own, provider-agnostic payment lifecycle. Payme's transaction states
 * (1, 2, -1, -2) live on `payment_transactions`, not here.
 *
 * There is no `refunded` status because refunds are not implemented.
 */
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "cancelled",
  "failed",
]);

/** Types of immutable payment history entries. */
export const paymentEventType = pgEnum("payment_event_type", [
  "payment_created",
  "provider_transaction_created",
  "payment_succeeded",
  "provider_cancelled",
  /**
   * Phase 17. The payment's own history now distinguishes the two cancellations
   * the protocol defines: a cancellation BEFORE performing (state -1) is just a
   * `provider_cancelled` — no money ever moved; a cancellation AFTER performing
   * (state -2) means money arrived and went back, so it is recorded as a refund
   * confirmation. The payment's `status` stays `succeeded`: the money DID
   * arrive, and the refund is its own domain (`refund_requests`).
   */
  "provider_refund_confirmed",
  "payment_failed",
]);

/**
 * A payment OBLIGATION for one accepted enrollment.
 *
 * `amount_tiyin` is an immutable PRICE SNAPSHOT taken when the payment is
 * created. A later edit to the course price must never change what an existing
 * payment is for, so nothing recomputes this column.
 *
 * It is `bigint` on purpose: course prices are int32 so'm capped at 100_000_000,
 * which is 10^10 tiyin — well beyond int32.
 */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    /** The accepted enrollment this obligation belongs to. */
    enrollmentRequestId: text("enrollment_request_id")
      .notNull()
      .references(() => enrollmentRequests.id, { onDelete: "cascade" }),
    /** Denormalised payer, so payment queries never need a join to authorize. */
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull().default("payme"),
    /** Immutable snapshot, in tiyin. Never derived from client input. */
    amountTiyin: bigint("amount_tiyin", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("UZS"),
    status: paymentStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    /*
     * At most ONE LIVE payment obligation per enrollment. Partial, so a
     * cancelled or failed attempt does not prevent trying again. This is what
     * makes two simultaneous "pay" clicks produce one obligation rather than
     * two charges -- enforced by the database, not by browser timing.
     */
    uniqueIndex("payments_one_live_per_enrollment")
      .on(table.enrollmentRequestId)
      .where(sql`status IN ('pending', 'succeeded')`),
    index("payments_student_idx").on(table.studentUserId),
    index("payments_enrollment_idx").on(table.enrollmentRequestId),
    // A payment for nothing is meaningless; free courses must not create rows.
    check("payments_amount_positive", sql`${table.amountTiyin} > 0`),
    check("payments_currency_supported", sql`${table.currency} = 'UZS'`),
    // Timestamps must agree with the status they describe.
    check(
      "payments_paid_at_consistent",
      sql`(${table.status} = 'succeeded') = (${table.paidAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * One row per PROVIDER transaction (Payme calls it a "financial transaction").
 *
 * Kept separate from `payments` so Payme's state machine does not leak into
 * the payment domain. Payme may create several transactions against the same
 * obligation over time (e.g. one cancelled by timeout, then another).
 */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull().default("payme"),
    /** The provider's own transaction id. UNIQUE — this is the idempotency key. */
    providerTransactionId: text("provider_transaction_id").notNull(),
    /** Provider-side creation time, in provider units (Payme: unix ms). */
    providerCreatedAt: bigint("provider_created_at", { mode: "bigint" }).notNull(),
    /**
     * The provider's transaction state, stored verbatim.
     * Payme: 1 created, 2 performed, -1 cancelled, -2 cancelled after perform.
     */
    state: integer("state").notNull(),
    /** Provider cancellation reason code, when one was supplied. */
    reasonCode: integer("reason_code"),
    /** When we performed it, in provider units. */
    performedAt: bigint("performed_at", { mode: "bigint" }),
    /** When we cancelled it, in provider units. */
    cancelledAt: bigint("cancelled_at", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * THE IDEMPOTENCY GUARANTEE. Payme retries CreateTransaction with the same
     * id after a lost response; this index makes a duplicate physically
     * impossible rather than merely unlikely.
     */
    unique("payment_transactions_provider_tx_unique").on(
      table.provider,
      table.providerTransactionId,
    ),
    index("payment_transactions_payment_idx").on(table.paymentId),
    // Only the four states the protocol defines.
    check("payment_transactions_state_valid", sql`${table.state} IN (1, 2, -1, -2)`),
  ],
);

/**
 * Immutable payment history. Not an accounting ledger and never public.
 *
 * `metadata` holds only safe, non-sensitive values (never credentials, never
 * card data -- this product never sees a card at all).
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    type: paymentEventType("type").notNull(),
    provider: paymentProvider("provider").notNull().default("payme"),
    providerTransactionId: text("provider_transaction_id"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_events_payment_idx").on(table.paymentId, table.createdAt),
    check("payment_events_metadata_len", sql`${table.metadata} IS NULL OR length(${table.metadata}) <= 500`),
  ],
);

/* ------------------------- Phase 15 · moderation --------------------------- */

/*
 * ADMIN CONTROL PLANE — Phase 15.
 *
 * Three tables, each with ONE job:
 *
 *   teacher_verification_requests — the teacher's application history, with
 *     exactly one live `pending` row per teacher (partial unique index).
 *   course_moderation_reviews     — the same shape for course publication,
 *     one live `pending` row per course.
 *   admin_audit_events            — an append-only record of every admin
 *     decision. Nothing updates or deletes it.
 *
 * The DOMAIN STATE stays where it already lived (teacher_profiles.verification,
 * courses.status); these tables record the *decision* around it. That is what
 * keeps `draft ⇄ ready → published` and `unverified → pending → verified` from
 * growing a second, contradictory source of truth.
 */

/** Lifecycle of one verification application. */
export const verificationRequestStatus = pgEnum("verification_request_status", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * A teacher's request to be verified.
 *
 * `feedback` is REQUIRED for a rejection (DB CHECK): sending a teacher back
 * with no explanation would make the workflow punitive rather than useful.
 * `reviewed_at` and `reviewed_by_admin_user_id` are all-or-nothing with the
 * decision, so a "decided" row can never lack a reviewer.
 */
export const teacherVerificationRequests = pgTable(
  "teacher_verification_requests",
  {
    id: text("id").primaryKey(),
    teacherUserId: text("teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    status: verificationRequestStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /**
     * The deciding admin. NO ACTION on delete on purpose: deleting an admin who
     * has made decisions must fail rather than silently orphan the audit trail.
     */
    reviewedByAdminUserId: text("reviewed_by_admin_user_id").references(() => users.id),
    /** Plain-text reviewer note shown to the teacher. Never HTML. */
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // History is read per teacher, newest first.
    index("tvr_teacher_idx").on(table.teacherUserId, table.createdAt),
    // The admin queue is "pending, oldest submission first".
    index("tvr_status_idx").on(table.status, table.submittedAt),
    // At most ONE live application per teacher — enforced by the database, so
    // a double submit (even racing) cannot queue two applications.
    uniqueIndex("tvr_one_pending_per_teacher")
      .on(table.teacherUserId)
      .where(sql`status = 'pending'`),
    check("tvr_feedback_len", sql`${table.feedback} IS NULL OR length(${table.feedback}) <= 500`),
    check(
      "tvr_reviewed_consistency",
      sql`(${table.status} = 'pending') = (${table.reviewedAt} IS NULL)`,
    ),
    check(
      "tvr_reviewer_required",
      sql`${table.status} = 'pending' OR ${table.reviewedByAdminUserId} IS NOT NULL`,
    ),
    check(
      "tvr_rejection_needs_feedback",
      sql`${table.status} <> 'rejected'
          OR (${table.feedback} IS NOT NULL AND length(btrim(${table.feedback})) >= 10)`,
    ),
  ],
);

/** Lifecycle of one course moderation review. */
export const courseModerationStatus = pgEnum("course_moderation_status", [
  "pending",
  "approved",
  "changes_requested",
]);

/**
 * One moderation review of a `ready` course.
 *
 * `changes_requested` is the honest name for "not published, here is why":
 * the course returns to `draft`, remains private, and the teacher can edit and
 * resubmit. There is no `rejected` value because a course is never permanently
 * refused — that would be a moderation dead end the product cannot service.
 */
export const courseModerationReviews = pgTable(
  "course_moderation_reviews",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** The owner at submission time — provenance for the review itself. */
    submittedByTeacherUserId: text("submitted_by_teacher_user_id")
      .notNull()
      .references(() => teacherProfiles.userId, { onDelete: "cascade" }),
    status: courseModerationStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByAdminUserId: text("reviewed_by_admin_user_id").references(() => users.id),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("cmr_course_idx").on(table.courseId, table.createdAt),
    index("cmr_status_idx").on(table.status, table.submittedAt),
    // One live review per course: resubmitting after a decision creates a NEW
    // row, which is exactly the history we want.
    uniqueIndex("cmr_one_pending_per_course")
      .on(table.courseId)
      .where(sql`status = 'pending'`),
    check("cmr_feedback_len", sql`${table.feedback} IS NULL OR length(${table.feedback}) <= 500`),
    check(
      "cmr_reviewed_consistency",
      sql`(${table.status} = 'pending') = (${table.reviewedAt} IS NULL)`,
    ),
    check(
      "cmr_reviewer_required",
      sql`${table.status} = 'pending' OR ${table.reviewedByAdminUserId} IS NOT NULL`,
    ),
    check(
      "cmr_changes_need_feedback",
      sql`${table.status} <> 'changes_requested'
          OR (${table.feedback} IS NOT NULL AND length(btrim(${table.feedback})) >= 10)`,
    ),
  ],
);

/**
 * Append-only admin action log.
 *
 * `entity_id` carries NO foreign key on purpose: the log must survive whatever
 * happens to the row it describes, and a cascade delete would quietly erase the
 * record of an admin action. `metadata` is a short, safe, human-readable
 * summary (an identifier or a status word) — never a payload dump, never a
 * secret, never student data.
 */
export const adminAuditAction = pgEnum("admin_audit_action", [
  "teacher_verified",
  "teacher_verification_rejected",
  "course_published",
  "course_changes_requested",
  /*
   * Phase 17. A refund decision is an administrative action with a financial
   * consequence, so it MUST leave a trace. There is deliberately NO
   * `refund_completed` action: completing a refund is not something an admin
   * does from a page — it is confirmed by an authenticated provider callback,
   * and that evidence lives in `refund_events`, not in the audit log.
   */
  "refund_approved",
  "refund_rejected",
  "refund_failed",
  /*
   * Phase 19. Publishing a review is an administrative act with a public
   * consequence: it moves a course's and a teacher's reputation. Recording it here
   * is what makes "who made this rating what it is" answerable later.
   */
  "review_published",
  "review_rejected",
]);

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => users.id),
    action: adminAuditAction("action").notNull(),
    /** Which kind of entity the action was performed on. */
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    /** Safe subset only: ids, slugs and status words. ≤ 300 chars. */
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("aae_created_idx").on(table.createdAt),
    index("aae_admin_idx").on(table.adminUserId, table.createdAt),
    index("aae_entity_idx").on(table.entityType, table.entityId),
    // Phase 19 adds `review`: moderating a review changes public reputation, so it
    // is audited exactly like a verification, a publication or a refund decision.
    check(
      "aae_entity_type_check",
      sql`${table.entityType} IN ('teacher', 'course', 'refund', 'review')`,
    ),
    check("aae_entity_id_check", sql`length(btrim(${table.entityId})) > 0`),
    check("aae_metadata_len", sql`${table.metadata} IS NULL OR length(${table.metadata}) <= 300`),
  ],
);

/* ------------------------------ private messages ---------------------------- */

/*
 * PRIVATE STUDENT ↔ TEACHER MESSAGING (Phase 16).
 *
 * THREE DECISIONS WORTH READING BEFORE TOUCHING THIS SCHEMA
 *
 * 1. PARTICIPANTS ARE NOT STORED. A conversation carries ONLY the enrollment
 *    request it belongs to; the student is `enrollment_requests.student_user_id`
 *    and the teacher is `courses.teacher_user_id`. There is no `student_user_id`
 *    / `teacher_user_id` column to drift out of sync with the enrollment, and no
 *    payload (from a form, a URL or a JSON body) can name a participant. A
 *    "one conversation per enrollment" unique index is therefore also a
 *    "participants can never disagree with the enrollment" guarantee.
 *
 * 2. THERE IS NO MESSAGE-EDIT OR MESSAGE-DELETE COLUMN, and no service function
 *    that updates or removes a message row. A sent message is immutable, which
 *    is what makes the read marker safe to reason about.
 *
 * 3. READ STATE IS A MARKER, NOT A COUNTER. `conversation_reads` stores the id
 *    and timestamp of the newest message a participant has actually seen.
 *    Unread is DERIVED by comparing (created_at, id) tuples, so it is
 *    impossible to drift, cannot be incremented twice by a retry, and survives
 *    a refresh or a second device. A composite foreign key ties the marker to a
 *    message OF THE SAME CONVERSATION, so even a buggy caller cannot mark a
 *    message from somebody else's thread as read.
 */

/**
 * One private thread per accepted enrollment request.
 *
 * Rows are created LAZILY: the first time either eligible participant opens
 * messaging for that enrollment. The unique index is what makes two
 * simultaneous opens collapse into one conversation.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    /**
     * The enrollment this thread belongs to. UNIQUE — one conversation per
     * enrollment, enforced by the database, not by a service convention.
     */
    enrollmentRequestId: text("enrollment_request_id")
      .notNull()
      .references(() => enrollmentRequests.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Latest message time. Drives "latest activity first" in both lists. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // THE rule of §2 of the phase spec, expressed as a constraint.
    uniqueIndex("conversations_enrollment_key").on(table.enrollmentRequestId),
    index("conversations_activity_idx").on(table.updatedAt),
    check("conversations_updated_after_created", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

/**
 * An immutable message. Plain text only: no HTML, no attachments, no media.
 *
 * `body` is bounded and stored trimmed; the UI renders it as text through
 * React, so markup is displayed, never executed.
 */
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The thread query AND the cursor pagination both walk this order.
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    // Sender-side index for the per-minute send guard.
    index("messages_sender_created_idx").on(table.senderUserId, table.createdAt),
    // Makes `conversation_reads` able to reference a message + its thread.
    // Declared as a table CONSTRAINT (not an index) so it exists by the time
    // PostgreSQL validates the composite foreign key in the same migration —
    // drizzle-kit emits separate CREATE INDEX statements after all ALTER TABLE
    // ... ADD CONSTRAINT statements.
    unique("messages_id_conversation_key").on(table.id, table.conversationId),
    check("messages_body_len", sql`length(${table.body}) BETWEEN 1 AND 2000`),
    // Outer whitespace is trimmed before insert; this makes that a fact.
    check("messages_body_trimmed", sql`${table.body} = btrim(${table.body})`),
  ],
);

/**
 * Per-participant read marker. One row per (conversation, participant).
 *
 * There is no participants table on purpose (see the note above): membership is
 * derived, so the only thing worth persisting per channel is the read position.
 * `lastReadAt` duplicates the marker message's `created_at` so unread counts can
 * compare tuples without a join, and the composite FK keeps the copied
 * timestamp honest (the row can only point at a message in this conversation).
 */
export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The newest message this participant has actually seen. */
    lastReadMessageId: text("last_read_message_id").notNull(),
    /** That message's `created_at`, copied for tuple comparison. */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One marker per participant per conversation.
    primaryKey({ columns: [table.conversationId, table.userId] }),
    // "Do I have unread messages?" — and the nav count — start from the user.
    index("conversation_reads_user_idx").on(table.userId),
    // A marker may only point at a message OF THIS CONVERSATION.
    foreignKey({
      name: "conversation_reads_message_fk",
      columns: [table.lastReadMessageId, table.conversationId],
      foreignColumns: [messages.id, messages.conversationId],
    }).onDelete("cascade"),
  ],
);

/* --------------------------- Phase 17 · refunds ---------------------------- */

/*
 * REFUNDS — Phase 17.
 *
 * A refund is a THIRD domain, deliberately not folded into either neighbour:
 *
 *   • enrollment answers "does this student have a place?"   → accepted
 *   • payment   answers "did the money actually arrive?"      → succeeded
 *   • refund    answers "has that money been given back, and on whose
 *                authority?"                                 → requested …
 *
 * A place whose refund is in flight is therefore `enrollment = accepted` +
 * `payment = succeeded` + `refund = requested|awaiting_provider`, and the seat
 * stays occupied through both of those stages. Only a PROVIDER-CONFIRMED
 * refund (an authenticated Payme `CancelTransaction` that cancels an already
 * performed transaction, protocol state `-2`) moves the enrollment to
 * `cancelled` and frees the seat.
 *
 * WHAT THIS TABLE DOES NOT STORE
 * No card data, no merchant credentials, no provider tokens: only the Payme
 * transaction id, its documented numeric cancellation reason and short
 * human-readable metadata. The amount is a copy of the payment's immutable
 * snapshot, never something a browser or an admin typed.
 */

export const refundStatus = pgEnum("refund_status", [
  /** The student asked; nothing has been decided. */
  "requested",
  /**
   * An admin approved the policy decision and the money still has to be
   * returned by the merchant in the Payme merchant cabinet. The provider
   * offers no outbound refund API, so this is the state where the merchant
   * operator acts OUTSIDE the application.
   */
  "awaiting_provider",
  /** Authenticated provider evidence confirms the money went back. */
  "completed",
  /** An admin declined the request; the enrollment and the seat are untouched. */
  "rejected",
  /** The provider operation genuinely failed (recorded by the merchant operator). */
  "failed",
]);

/** Immutable refund history. Append-only: nothing in this table is ever updated. */
export const refundEventType = pgEnum("refund_event_type", [
  "requested",
  "approved",
  "rejected",
  /** `awaiting_provider` → `completed`, from an authenticated provider callback. */
  "provider_refund_completed",
  /** `awaiting_provider` → `failed`, recorded from a genuine provider failure. */
  "provider_refund_failed",
  /**
   * A provider confirmation arrived that NO application user asked for: the
   * transaction was cancelled after being performed while there was no live
   * request. Financial truth is recorded either way — the row this event
   * belongs to is created `system_initiated`.
   */
  "provider_reversal_recorded",
]);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: text("id").primaryKey(),
    /** The succeeded payment being refunded. */
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    enrollmentRequestId: text("enrollment_request_id")
      .notNull()
      .references(() => enrollmentRequests.id, { onDelete: "cascade" }),
    studentUserId: text("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The provider transaction whose cancellation confirms this refund. */
    providerTransactionId: text("provider_transaction_id"),
    status: refundStatus("status").notNull(),
    /**
     * FULL refunds only: a copy of the payment's immutable amount snapshot,
     * written from the database — never from a request body.
     */
    amountTiyin: bigint("amount_tiyin", { mode: "bigint" }).notNull(),
    reason: text("reason").notNull(),
    /** Required for `rejected` and `failed`; optional otherwise. */
    adminFeedback: text("admin_feedback"),
    reviewedByAdminUserId: text("reviewed_by_admin_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /**
     * TRUE when the row exists because the provider reversed a performed
     * payment nobody in the application asked to refund. Such a row is born
     * `completed` and has no reviewer.
     */
    systemInitiated: boolean("system_initiated").notNull().default(false),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refund_requests_student_idx").on(table.studentUserId, table.requestedAt),
    index("refund_requests_status_idx").on(table.status, table.requestedAt),
    index("refund_requests_enrollment_idx").on(table.enrollmentRequestId),
    /*
     * ONE LIVE REFUND PER PAYMENT. Partial, so a rejected or failed attempt
     * does not block a later, legitimate request — while two simultaneous
     * submissions can only ever produce one live row.
     */
    uniqueIndex("refund_requests_one_live_per_payment")
      .on(table.paymentId)
      .where(sql`status IN ('requested', 'awaiting_provider')`),
    check("refund_requests_amount_positive", sql`${table.amountTiyin} > 0`),
    check(
      "refund_requests_reason_len",
      sql`length(${table.reason}) BETWEEN 1 AND 1000`,
    ),
    check("refund_requests_reason_trimmed", sql`${table.reason} = btrim(${table.reason})`),
    check(
      "refund_requests_feedback_len",
      sql`${table.adminFeedback} IS NULL OR (length(${table.adminFeedback}) BETWEEN 1 AND 1000 AND ${table.adminFeedback} = btrim(${table.adminFeedback}))`,
    ),
    /*
     * PROVIDER EVIDENCE. A completed refund must carry the moment it was
     * confirmed; `completed` can therefore never be written as a bare status
     * flip by a page, an action or a script.
     */
    check(
      "refund_requests_completed_evidence",
      sql`${table.status} <> 'completed' OR ${table.completedAt} IS NOT NULL`,
    ),
    check(
      "refund_requests_rejected_feedback",
      sql`${table.status} <> 'rejected' OR ${table.adminFeedback} IS NOT NULL`,
    ),
    check(
      "refund_requests_failed_feedback",
      sql`${table.status} <> 'failed' OR ${table.adminFeedback} IS NOT NULL`,
    ),
    /** Reviewer and review time are written together or not at all. */
    check(
      "refund_requests_review_pair",
      sql`(${table.reviewedByAdminUserId} IS NULL) = (${table.reviewedAt} IS NULL)`,
    ),
    /*
     * An APPROVAL, a REJECTION or a FAILURE always has an admin behind it. A
     * `completed` row does not: an unsolicited provider reversal is confirmed
     * by the provider, not by a person.
     */
    check(
      "refund_requests_decision_has_admin",
      sql`${table.status} NOT IN ('awaiting_provider', 'rejected', 'failed') OR ${table.reviewedByAdminUserId} IS NOT NULL`,
    ),
  ],
);

export const refundEvents = pgTable(
  "refund_events",
  {
    id: text("id").primaryKey(),
    refundRequestId: text("refund_request_id")
      .notNull()
      .references(() => refundRequests.id, { onDelete: "cascade" }),
    /**
     * Who caused the step. NULL means the PROVIDER did — an authenticated
     * Payme confirmation is not a session user, and attributing it to one
     * would be a lie in the audit history.
     */
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    type: refundEventType("type").notNull(),
    fromStatus: refundStatus("from_status"),
    toStatus: refundStatus("to_status").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    /** Payme's documented cancellation reason code, as safe provider metadata. */
    reasonCode: integer("reason_code"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refund_events_refund_idx").on(table.refundRequestId, table.createdAt),
    check(
      "refund_events_from_differs",
      sql`${table.fromStatus} IS NULL OR ${table.fromStatus} <> ${table.toStatus}`,
    ),
    check(
      "refund_events_metadata_len",
      sql`${table.metadata} IS NULL OR length(${table.metadata}) <= 500`,
    ),
  ],
);

/* ------------------------------ Phase 18: media --------------------------- */

/**
 * Storage visibility. TWO classes, and only two.
 *
 *   public  — teacher profile images and course covers. Served from the public
 *             storage namespace / CDN, cacheable, no signature.
 *   private — teacher verification evidence. Reachable ONLY through a
 *             short-lived signed URL minted for a specific authorized viewer.
 *
 * A client never supplies this: it is derived from the asset's PURPOSE in
 * `src/lib/media.ts`, and the CHECK below re-derives it in the database.
 */
export const fileVisibility = pgEnum("file_visibility", ["public", "private"]);

/** What an asset is FOR. Purpose — not a client flag — decides visibility. */
export const filePurpose = pgEnum("file_purpose", [
  "teacher_verification_document",
  "teacher_profile_image",
  "course_cover_image",
]);

/**
 * Asset lifecycle.
 *
 *   pending    — row exists, the object has NOT been verified yet. Never
 *                served, never referenced by a public projection.
 *   active     — the object was confirmed by the storage provider and this row
 *                is the current one for its purpose.
 *   superseded — replaced by a newer asset. Kept so history (and cleanup) knows
 *                exactly which object to remove.
 *   deleted    — no longer referenced; the object is (or will be) removed by the
 *                cleanup command. A failed upload lands here immediately.
 */
export const fileStatus = pgEnum("file_status", ["pending", "active", "superseded", "deleted"]);

/** Minimal evidence taxonomy. Trust review, not state KYC. */
export const verificationDocumentType = pgEnum("verification_document_type", [
  "identity_document",
  "qualification_evidence",
]);

/**
 * One stored object. The SINGLE source of truth for what exists in storage.
 *
 * SECURITY PROPERTIES THAT ARE ENFORCED HERE, not in a service:
 *   • `visibility` must agree with `purpose` (a verification document cannot be
 *     public, and a public asset cannot be marked private);
 *   • `storage_key` must live under the namespace of its visibility, so a
 *     private object can never be addressed as a public one;
 *   • `course_id` is set IF AND ONLY IF the purpose is a course cover;
 *   • at most ONE active profile image per teacher and ONE active cover per
 *     course, which is what makes replacement safe under concurrency;
 *   • a `deleted` row must carry `deletedAt`, and `pending` rows must never look
 *     activated.
 */
export const fileAssets = pgTable(
  "file_assets",
  {
    id: text("id").primaryKey(),
    /** The uploader. Every asset has an owner, including course covers. */
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Set for course covers only — see `file_assets_course_scope`. */
    courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
    purpose: filePurpose("purpose").notNull(),
    visibility: fileVisibility("visibility").notNull(),
    /** Which provider wrote the object (`s3`, `local`, `memory`). */
    storageProvider: text("storage_provider").notNull(),
    /**
     * SERVER-GENERATED key: `<visibility>/<purpose-namespace>/<owner-scope>/<id>.<ext>`.
     * The uploaded filename is stored separately for display and is never part
     * of the path, so no user input can influence where an object lands.
     */
    storageKey: text("storage_key").notNull(),
    /** Display-only original name, sanitized when rendered. */
    originalFileName: text("original_file_name").notNull(),
    /** Detected from CONTENT (magic bytes), not from the browser. */
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    /** Integrity/duplicate aid. Optional: the provider's metadata is authority. */
    checksumSha256: text("checksum_sha256"),
    /** Verification documents only — required for them, forbidden otherwise. */
    documentType: verificationDocumentType("document_type"),
    status: fileStatus("status").notNull().default("pending"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("file_assets_provider_key_unique").on(table.storageProvider, table.storageKey),
    index("file_assets_owner_idx").on(table.ownerUserId, table.purpose, table.status),
    index("file_assets_course_idx").on(table.courseId, table.status),
    // The cleanup command scans by status, oldest first.
    index("file_assets_status_idx").on(table.status, table.createdAt),
    /*
     * ONE CURRENT ASSET PER SLOT. Partial unique indexes, so replacing an image
     * is atomic even if two requests race: the database refuses a second active
     * row rather than leaving a course with two covers.
     */
    uniqueIndex("file_assets_one_active_profile_image")
      .on(table.ownerUserId)
      .where(sql`purpose = 'teacher_profile_image' AND status = 'active'`),
    uniqueIndex("file_assets_one_active_course_cover")
      .on(table.courseId)
      .where(sql`purpose = 'course_cover_image' AND status = 'active'`),
    check("file_assets_byte_size_positive", sql`${table.byteSize} > 0`),
    check(
      "file_assets_checksum_hex",
      sql`${table.checksumSha256} IS NULL OR ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    /* Visibility is a function of purpose. Nothing else may decide it. */
    check(
      "file_assets_visibility_matches_purpose",
      sql`(${table.purpose} = 'teacher_verification_document') = (${table.visibility} = 'private')`,
    ),
    /* A private object can never be addressed through the public namespace. */
    check(
      "file_assets_key_namespace",
      sql`(${table.visibility} = 'private' AND ${table.storageKey} LIKE 'private/%')
          OR (${table.visibility} = 'public' AND ${table.storageKey} LIKE 'public/%')`,
    ),
    check(
      "file_assets_course_scope",
      sql`(${table.purpose} = 'course_cover_image') = (${table.courseId} IS NOT NULL)`,
    ),
    check(
      "file_assets_document_type_scope",
      sql`(${table.purpose} = 'teacher_verification_document') = (${table.documentType} IS NOT NULL)`,
    ),
    check(
      "file_assets_activation_consistency",
      sql`(${table.status} <> 'pending' OR ${table.activatedAt} IS NULL)
          AND (${table.status} NOT IN ('active', 'superseded') OR ${table.activatedAt} IS NOT NULL)`,
    ),
    check(
      "file_assets_deleted_at_consistency",
      sql`(${table.status} = 'deleted') = (${table.deletedAt} IS NOT NULL)`,
    ),
    check(
      "file_assets_original_name_len",
      sql`length(${table.originalFileName}) BETWEEN 1 AND 255`,
    ),
  ],
);

/**
 * FROZEN EVIDENCE: which assets a SUBMITTED verification request was reviewed
 * with.
 *
 * The relationship is only created at submission, inside the same transaction
 * that flips the profile to `pending`, so a reviewer always sees exactly what
 * the teacher submitted. `ON DELETE RESTRICT` on the asset is the mechanism that
 * makes that evidence undeletable while a request references it — a reviewer's
 * record cannot be quietly emptied afterwards.
 */
export const teacherVerificationDocuments = pgTable(
  "teacher_verification_documents",
  {
    id: text("id").primaryKey(),
    verificationRequestId: text("verification_request_id")
      .notNull()
      .references(() => teacherVerificationRequests.id, { onDelete: "cascade" }),
    fileAssetId: text("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "restrict" }),
    documentType: verificationDocumentType("document_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("tvd_request_asset_unique").on(table.verificationRequestId, table.fileAssetId),
    index("tvd_request_idx").on(table.verificationRequestId, table.createdAt),
    index("tvd_asset_idx").on(table.fileAssetId),
  ],
);

/* -------------------------------- relations -------------------------------- */

export const fileAssetsRelations = relations(fileAssets, ({ one, many }) => ({
  owner: one(users, { fields: [fileAssets.ownerUserId], references: [users.id] }),
  course: one(courses, { fields: [fileAssets.courseId], references: [courses.id] }),
  verificationDocuments: many(teacherVerificationDocuments),
}));

export const teacherVerificationDocumentsRelations = relations(
  teacherVerificationDocuments,
  ({ one }) => ({
    request: one(teacherVerificationRequests, {
      fields: [teacherVerificationDocuments.verificationRequestId],
      references: [teacherVerificationRequests.id],
    }),
    asset: one(fileAssets, {
      fields: [teacherVerificationDocuments.fileAssetId],
      references: [fileAssets.id],
    }),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  teacherProfile: one(teacherProfiles, {
    fields: [users.id],
    references: [teacherProfiles.userId],
  }),
  sessions: many(sessions),
}));

export const teacherProfilesRelations = relations(teacherProfiles, ({ one, many }) => ({
  user: one(users, { fields: [teacherProfiles.userId], references: [users.id] }),
  courses: many(courses),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one, many }) => ({
  user: one(users, { fields: [studentProfiles.userId], references: [users.id] }),
  enrollmentRequests: many(enrollmentRequests),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(teacherProfiles, {
    fields: [courses.teacherUserId],
    references: [teacherProfiles.userId],
  }),
  groups: many(courseGroups),
  syllabus: many(syllabusModules),
  reviews: many(courseReviews),
}));

export const courseGroupsRelations = relations(courseGroups, ({ one }) => ({
  course: one(courses, { fields: [courseGroups.courseId], references: [courses.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  enrollmentRequest: one(enrollmentRequests, {
    fields: [conversations.enrollmentRequestId],
    references: [enrollmentRequests.id],
  }),
  messages: many(messages),
  reads: many(conversationReads),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderUserId], references: [users.id] }),
}));

export const conversationReadsRelations = relations(conversationReads, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationReads.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [conversationReads.lastReadMessageId],
    references: [messages.id],
  }),
}));

export const enrollmentRequestsRelations = relations(enrollmentRequests, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [enrollmentRequests.studentUserId],
    references: [studentProfiles.userId],
  }),
  course: one(courses, { fields: [enrollmentRequests.courseId], references: [courses.id] }),
}));

export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  course: one(courses, { fields: [courseReviews.courseId], references: [courses.id] }),
  student: one(studentProfiles, {
    fields: [courseReviews.studentUserId],
    references: [studentProfiles.userId],
  }),
  enrollmentRequest: one(enrollmentRequests, {
    fields: [courseReviews.enrollmentRequestId],
    references: [enrollmentRequests.id],
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type StudentProfileRow = typeof studentProfiles.$inferSelect;
export type TeacherProfileRow = typeof teacherProfiles.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type CourseGroupRow = typeof courseGroups.$inferSelect;
export type EnrollmentRequestRow = typeof enrollmentRequests.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type PaymentTransactionRow = typeof paymentTransactions.$inferSelect;
export type PaymentEventRow = typeof paymentEvents.$inferSelect;
export type TeacherVerificationRequestRow = typeof teacherVerificationRequests.$inferSelect;
export type CourseModerationReviewRow = typeof courseModerationReviews.$inferSelect;
export type AdminAuditEventRow = typeof adminAuditEvents.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ConversationReadRow = typeof conversationReads.$inferSelect;
export type CourseReviewRow = typeof courseReviews.$inferSelect;
