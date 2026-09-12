import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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

export const userRole = pgEnum("user_role", ["student", "teacher"]);

/** Honest states only — a teacher is NEVER auto-verified. */
export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
]);

export const courseFormat = pgEnum("course_format", ["online", "offline", "hybrid"]);
export const courseLevel = pgEnum("course_level", ["boshlangich", "orta", "yuqori"]);

/** Phase 11 keeps the honest two-state lifecycle from Phase 10. */
export const courseStatus = pgEnum("course_status", ["draft", "ready"]);

/**
 * Conservative enrollment states. approved/rejected/paid/confirmed are
 * deliberately ABSENT — those workflows do not exist yet, so the database
 * cannot express them.
 */
export const enrollmentStatus = pgEnum("enrollment_status", ["submitted", "cancelled"]);

/* ---------------------------------- users ---------------------------------- */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    role: userRole("role").notNull(),
    /** Canonical E.164-ish "+998XXXXXXXXX" — the account identifier. */
    phone: text("phone").notNull(),
    /** argon2id hash. Never a plaintext password, never reversible. */
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("users_phone_key").on(table.phone),
    // Target for the composite role FKs used by the profile tables.
    unique("users_id_role_key").on(table.id, table.role),
    check("users_phone_format", sql`${table.phone} ~ '^\\+998[0-9]{9}$'`),
    check("users_password_hash_not_plain", sql`${table.passwordHash} LIKE '$argon2%'`),
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
    /** Defaults to UNVERIFIED. Nothing in Phase 11 can set 'verified'. */
    verification: verificationStatus("verification").notNull().default("unverified"),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("courses_slug_key").on(table.slug),
    index("courses_teacher_idx").on(table.teacherUserId),
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
    /** Planned seats. NOTE: there is deliberately no occupied-seat column. */
    capacity: integer("capacity").notNull(),
    startDate: text("start_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite target so an enrollment can prove (course, group) consistency.
    unique("course_groups_id_course_key").on(table.id, table.courseId),
    index("course_groups_course_idx").on(table.courseId),
    check("course_groups_capacity_check", sql`${table.capacity} BETWEEN 1 AND 500`),
    check("course_groups_time_format", sql`${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
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
    // One live request per student per group; cancelling frees it up logically
    // (status is part of the key so a cancelled row does not block a resubmit).
    unique("enrollment_requests_unique_live").on(
      table.studentUserId,
      table.groupId,
      table.status,
    ),
    check("enrollment_requests_note_len", sql`length(${table.note}) <= 500`),
  ],
);

/* -------------------------------- relations -------------------------------- */

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
}));

export const courseGroupsRelations = relations(courseGroups, ({ one }) => ({
  course: one(courses, { fields: [courseGroups.courseId], references: [courses.id] }),
}));

export const enrollmentRequestsRelations = relations(enrollmentRequests, ({ one }) => ({
  student: one(studentProfiles, {
    fields: [enrollmentRequests.studentUserId],
    references: [studentProfiles.userId],
  }),
  course: one(courses, { fields: [enrollmentRequests.courseId], references: [courses.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type StudentProfileRow = typeof studentProfiles.$inferSelect;
export type TeacherProfileRow = typeof teacherProfiles.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type CourseGroupRow = typeof courseGroups.$inferSelect;
export type EnrollmentRequestRow = typeof enrollmentRequests.$inferSelect;
