import { z } from "zod";
import { VERIFICATION_DOCUMENT_TYPES } from "@/lib/media";
import { TEACHER_PROFILE_LIMITS } from "@/lib/teacher-profile";
import { categories } from "@/data/categories";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import {
  extractUzPhoneDigits,
  UZ_MOBILE_PREFIXES,
  onboardingCities,
  onboardingLanguages,
  onboardingCategories,
} from "@/lib/onboarding";
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
} from "@/lib/teacher-verification";
import {
  MODERATION_FEEDBACK_MAX_LENGTH,
  MODERATION_FEEDBACK_MIN_LENGTH,
} from "@/lib/course-moderation";
import { MESSAGE_BODY_MAX_LENGTH } from "@/lib/messaging";
import {
  REFUND_FEEDBACK_MAX_LENGTH,
  REFUND_FEEDBACK_MIN_LENGTH,
  REFUND_REASON_MAX_LENGTH,
  REFUND_REASON_MIN_LENGTH,
} from "@/lib/refund";
import {
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_BODY_MIN_LENGTH,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_REASON_MAX_LENGTH,
  REVIEW_REASON_MIN_LENGTH,
  normalizeReviewBody,
} from "@/lib/reviews";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_MESSAGE_MIN_LENGTH,
  SUPPORT_RELATED_TYPES,
  SUPPORT_STATUSES,
} from "@/lib/support";

/* -------------------------------------------------------------------------- */
/* Server-side input schemas — Phase 11.                                       */
/*                                                                              */
/* Every mutation parses its input through one of these. Rules:                 */
/*   • `.strict()` everywhere → over-posting / mass assignment is rejected      */
/*     rather than silently ignored (an extra `role` or `userId` field in the   */
/*     payload is a hard validation error);                                     */
/*   • whitelists come from the SAME canonical taxonomies the UI uses, so the   */
/*     server can never accept a city/language/category the product doesn't     */
/*     have;                                                                     */
/*   • the phone rule mirrors lib/onboarding but normalises to the strict       */
/*     "+998XXXXXXXXX" form the database CHECK constraint enforces.             */
/*                                                                              */
/* Client-side validation from Phase 6 is preserved for UX, but it is never     */
/* trusted: these schemas run on the server for every write.                    */
/* -------------------------------------------------------------------------- */

const CITY_SET = new Set(onboardingCities);
const LANG_SET = new Set(onboardingLanguages);
const CATEGORY_SET = new Set(onboardingCategories.map((category) => category.slug));
/* Teacher SUBJECTS are stored as category slugs, but `courses.category_id`
 * stores the category ID. They are different vocabularies, so course schemas
 * validate against the id set — validating a course against slugs would
 * reject every legitimate value. */
const CATEGORY_ID_SET = new Set(categories.map((category) => category.id));

/** Any accepted human input → canonical "+998XXXXXXXXX", or a validation error. */
export const phoneSchema = z
  .string()
  .max(30)
  .transform((raw) => extractUzPhoneDigits(raw))
  .refine((digits) => digits.length === 9, {
    message: "Raqam to‘liq emas — +998 XX XXX XX XX ko‘rinishida kiriting.",
  })
  .refine((digits) => UZ_MOBILE_PREFIXES.includes(digits.slice(0, 2)), {
    message: "Bu operator kodi qo‘llab-quvvatlanmaydi. Mobil raqam kiriting.",
  })
  .transform((digits) => `+998${digits}`);

export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo‘lsin.")
  .max(72, "Parol 72 ta belgidan oshmasin.");

export const roleSchema = z.enum(["student", "teacher"]);

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Ismni to‘liq kiriting.")
  .max(70, "Ism 70 ta belgidan oshmasin.");

const citySchema = z
  .string()
  .refine((value) => CITY_SET.has(value), "Noma’lum shahar.")
  .nullable();

const languagesSchema = z
  .array(z.string().refine((tag) => LANG_SET.has(tag), "Noma’lum til."))
  .max(6);

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Noto‘g‘ri identifikator.");

/* --------------------------------- auth ------------------------------------ */

export const registerSchema = z
  .object({
    role: roleSchema,
    name: nameSchema,
    phone: phoneSchema,
    password: passwordSchema,
    next: z.string().max(400).nullable().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    phone: phoneSchema,
    password: z.string().min(1).max(72),
    next: z.string().max(400).nullable().optional(),
  })
  .strict();

/*
 * OPERATOR LOGIN — email + password.
 *
 * A separate schema (and a separate server action) rather than an "identifier"
 * field that accepts either shape: the phone login above stays byte-for-byte
 * the marketplace path it has always been, and this one can only ever describe
 * an operator. `.strict()` matters twice over — it rejects an unknown field, so
 * neither login payload can smuggle `role`, `userId` or `email` into the other.
 *
 * `registerSchema` above is deliberately untouched: public registration is
 * phone-only and `roleSchema` accepts student|teacher, so no request can create
 * an admin or attach an email to a marketplace account. The database agrees
 * (`users_email_admin_only`).
 */
export const emailSchema = z
  .string()
  .max(320, "Email manzili juda uzun.")
  .transform((raw) => normalizeEmail(raw))
  .refine((value) => isValidEmail(value), "Email manzili noto‘g‘ri.");

export const adminLoginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72),
    next: z.string().max(400).nullable().optional(),
  })
  .strict();

/* ------------------------------- onboarding -------------------------------- */

export const studentProfileSchema = z
  .object({
    name: nameSchema,
    city: citySchema,
    preferredFormat: z.enum(["online", "offline", "both"]).nullable(),
    languages: languagesSchema,
    interests: z
      .array(z.string().refine((slug) => CATEGORY_SET.has(slug), "Noma’lum yo‘nalish."))
      .max(12),
    onboardingCompleted: z.boolean(),
  })
  .strict();

export const teacherProfileSchema = z
  .object({
    name: nameSchema,
    /*
     * `specialization` is the public “Yo‘nalish” label AND a verification
     * requirement, so it is part of the teacher-editable profile: an empty value
     * is stored as NULL rather than as an empty string, which is what the
     * verification predicate expects for "not stated".
     */
    specialization: z
      .string()
      .trim()
      .max(
        TEACHER_PROFILE_LIMITS.SPECIALIZATION_MAX,
        `Yo‘nalish ${TEACHER_PROFILE_LIMITS.SPECIALIZATION_MAX} belgidan oshmasin.`,
      )
      .nullable()
      .transform((value) => (value === null || value.trim() === "" ? null : value.trim())),
    city: citySchema,
    district: z.string().trim().max(TEACHER_PROFILE_LIMITS.DISTRICT_MAX),
    categories: z
      .array(z.string().refine((slug) => CATEGORY_SET.has(slug), "Noma’lum yo‘nalish."))
      .max(TEACHER_PROFILE_LIMITS.CATEGORIES_MAX),
    levels: z
      .array(z.enum(["boshlangich", "orta", "yuqori"]))
      .max(TEACHER_PROFILE_LIMITS.LEVELS_MAX),
    formats: z.array(z.enum(["online", "offline"])).max(TEACHER_PROFILE_LIMITS.FORMATS_MAX),
    languages: languagesSchema,
    experienceYears: z
      .number()
      .int()
      .min(TEACHER_PROFILE_LIMITS.EXPERIENCE_MIN)
      .max(TEACHER_PROFILE_LIMITS.EXPERIENCE_MAX)
      .nullable(),
    bio: z.string().trim().max(TEACHER_PROFILE_LIMITS.BIO_MAX),
    approach: z.string().trim().max(TEACHER_PROFILE_LIMITS.APPROACH_MAX),
    onboardingCompleted: z.boolean(),
  })
  .strict();

/* ------------------------------- enrollment -------------------------------- */

export const enrollmentRequestSchema = z
  .object({
    courseId: idSchema,
    groupId: idSchema,
    note: z.string().trim().max(500),
  })
  .strict();

export const cancelEnrollmentSchema = z.object({ requestId: idSchema }).strict();

/* --------------------------- enrollment decisions --------------------------- */

/*
 * Phase 13 decision inputs. These express INTENT, not state: the action is
 * "accept this request", never "set status = accepted". There is deliberately
 * no `status`, `teacherId` or `studentId` field, and `.strict()` rejects the
 * payload outright if a caller invents one.
 */

export const acceptEnrollmentSchema = z.object({ requestId: idSchema }).strict();

export const rejectEnrollmentSchema = z
  .object({
    requestId: idSchema,
    /** Optional short note shown to the student. Bounded and plain text. */
    reason: z.string().trim().max(300).nullable(),
  })
  .strict();

export const notificationReadSchema = z.object({ notificationId: idSchema }).strict();

/* ------------------------- Phase 15 · admin actions ------------------------- */

/*
 * INTENT-SHAPED, NEVER STATE-SHAPED.
 *
 * Every schema below names the DECISION the caller is making. There is no
 * `status`, no `role`, no `verification`, no `decision` and no `adminUserId`
 * field anywhere — and `.strict()` rejects the whole payload if a caller
 * invents one. So `updateStatus({status:"verified"})` and
 * `updateCourse({status:"published"})` are not merely forbidden: they are
 * unparseable. The reviewer and the resulting state are derived server-side
 * from the session and from the row being decided.
 */

/** Teacher submits their own profile for verification. No fields: the subject
 *  is the session user, and any posted field is an over-post attempt. */
export const submitTeacherVerificationSchema = z.object({}).strict();

/** Admin approves a pending verification application. */
export const verifyTeacherSchema = z.object({ requestId: idSchema }).strict();

/** Admin returns a verification application with REQUIRED feedback. */
export const rejectTeacherVerificationSchema = z
  .object({
    requestId: idSchema,
    feedback: z
      .string()
      .trim()
      .min(FEEDBACK_MIN_LENGTH, "Sabab kamida 10 belgidan iborat bo‘lsin.")
      .max(FEEDBACK_MAX_LENGTH, "Sabab 500 belgidan oshmasin."),
  })
  .strict();

/** Admin publishes a submitted course. Identified by its live REVIEW id, so a
 *  caller cannot publish a course that has no pending moderation record. */
export const publishCourseSchema = z.object({ reviewId: idSchema }).strict();

/** Admin returns a submitted course to `draft` with REQUIRED feedback. */
export const requestCourseChangesSchema = z
  .object({
    reviewId: idSchema,
    feedback: z
      .string()
      .trim()
      .min(MODERATION_FEEDBACK_MIN_LENGTH, "Sabab kamida 10 belgidan iborat bo‘lsin.")
      .max(MODERATION_FEEDBACK_MAX_LENGTH, "Sabab 500 belgidan oshmasin."),
  })
  .strict();

/** Teacher submits an owned course for moderation ("ready"). */
export const submitCourseForReviewSchema = z.object({ courseId: idSchema }).strict();

/** Teacher lifecycle intent. The target status is deliberately not accepted. */
export const courseLifecycleSchema = z
  .object({
    courseId: idSchema,
    action: z.enum(["pause", "resume", "archive"]),
  })
  .strict();

/* ----------------------------- Phase 23 support ---------------------------- */

export const supportTicketSchema = z
  .object({
    category: z.enum(SUPPORT_CATEGORIES),
    message: z
      .string()
      .trim()
      .min(SUPPORT_MESSAGE_MIN_LENGTH, `Murojaat kamida ${SUPPORT_MESSAGE_MIN_LENGTH} belgi bo‘lsin.`)
      .max(SUPPORT_MESSAGE_MAX_LENGTH, `Murojaat ${SUPPORT_MESSAGE_MAX_LENGTH} belgidan oshmasin.`),
    relatedEntityType: z.enum(SUPPORT_RELATED_TYPES).nullable(),
    relatedEntityId: idSchema.nullable(),
  })
  .strict()
  .refine(
    (value) => (value.relatedEntityType === null) === (value.relatedEntityId === null),
    { message: "Bog‘liq yozuv turi va identifikatorini birga kiriting yoki ikkalasini ham bo‘sh qoldiring." },
  );

export const supportTicketTransitionSchema = z
  .object({
    ticketId: idSchema,
    status: z.enum(SUPPORT_STATUSES),
  })
  .strict();

/* ----------------------------- account security --------------------------- */

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1).max(72),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Yangi parollar bir xil emas.",
  });

export const deactivateAccountSchema = z
  .object({
    password: z.string().min(1).max(72),
    confirmation: z.literal("DEACTIVATE"),
  })
  .strict();

/* --------------------------------- payments --------------------------------- */

/*
 * Phase 14. The ONLY thing a browser may send to start a payment is which
 * enrollment it is for.
 *
 * There is deliberately no `amount`, `price`, `currency`, `studentId`,
 * `status` or `returnUrl` field: the amount is derived server-side from the
 * accepted enrollment's course price, and `.strict()` rejects the whole
 * payload if a caller invents one of those.
 */
export const startPaymentSchema = z
  .object({ enrollmentRequestId: idSchema })
  .strict();

/** Reading a payment's own detail page. */
export const paymentIdSchema = z.object({ paymentId: idSchema }).strict();

/* --------------------------------- courses --------------------------------- */

export const courseDraftCreateSchema = z
  .object({
    title: z.string().trim().min(8).max(120),
    categoryId: z.string().refine((id) => CATEGORY_ID_SET.has(id), "Noma’lum yo‘nalish."),
    level: z.enum(["boshlangich", "orta", "yuqori"]),
    format: z.enum(["online", "offline", "hybrid"]),
    city: citySchema,
    location: z.string().trim().max(160).nullable(),
    priceUzs: z.number().int().min(0).max(100_000_000),
    summary: z.string().trim().min(40).max(400),
  })
  .strict()
  // Mirrors the courses_online_no_location CHECK constraint so the user sees a
  // field error instead of a database exception.
  .refine(
    (value) =>
      value.format === "online"
        ? value.city === null && (value.location === null || value.location === "")
        : value.city !== null,
    { message: "Oflayn kurs uchun shahar majburiy; onlayn kursda manzil bo‘lmaydi.", path: ["city"] },
  );

/** Editable body of an owned course draft. Same shape as create, no id/status. */
export const courseDraftUpdateSchema = z
  .object({
    title: z.string().trim().min(8).max(120),
    categoryId: z.string().refine((id) => CATEGORY_ID_SET.has(id), "Noma’lum yo‘nalish."),
    level: z.enum(["boshlangich", "orta", "yuqori"]),
    format: z.enum(["online", "offline", "hybrid"]),
    city: citySchema,
    location: z.string().trim().max(160).nullable(),
    priceUzs: z.number().int().min(0).max(100_000_000),
    summary: z.string().trim().min(40).max(400),
    longDescription: z.string().trim().max(4000),
  })
  .strict()
  .refine(
    (value) =>
      value.format === "online"
        ? value.city === null && (value.location === null || value.location === "")
        : value.city !== null,
    { message: "Oflayn kurs uchun shahar majburiy; onlayn kursda manzil bo‘lmaydi.", path: ["city"] },
  );

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A course group. Only PLANNED data is accepted: title, days, times, start
 * date and capacity. There is no seatsRemaining input — occupancy is derived
 * from real enrollment rows and must never be posted by a client.
 */
export const courseGroupSchema = z
  .object({
    courseId: idSchema,
    title: z.string().trim().min(2).max(80),
    days: z.array(z.enum(WEEKDAYS)).min(1).max(7),
    startTime: z.string().regex(TIME, "Vaqt HH:MM ko‘rinishida bo‘lsin."),
    endTime: z.string().regex(TIME, "Vaqt HH:MM ko‘rinishida bo‘lsin."),
    startDate: z.string().regex(DATE, "Sana YYYY-MM-DD ko‘rinishida bo‘lsin."),
    capacity: z.number().int().min(1).max(500),
  })
  .strict()
  .refine((value) => value.endTime > value.startTime, {
    message: "Tugash vaqti boshlanishdan keyin bo‘lsin.",
    path: ["endTime"],
  });

/** One syllabus module. Position is assigned by the server, never posted. */
export const syllabusModuleSchema = z
  .object({
    courseId: idSchema,
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(600),
    lessons: z.number().int().min(1).max(200),
  })
  .strict();

/* ---------------------- Phase 16 · private messaging ------------------------ */

/*
 * Messaging payloads are INTENT-SHAPED like the Phase 15 admin ones: they name
 * a conversation and (at most) one message. There is deliberately no field for
 * a sender, a recipient, a student id, a teacher id or a participant list —
 * `.strict()` rejects the whole payload if a caller invents one, so "send this
 * as somebody else" and "post into a thread I don't own" are unparseable
 * requests, not merely refused ones.
 */

/** Open (or fetch) the thread of one enrollment request the caller is part of. */
export const openConversationSchema = z
  .object({ enrollmentRequestId: idSchema })
  .strict();

/**
 * Send one plain-text message.
 *
 * Trimmed, non-empty, bounded by the SAME constant the database CHECK uses.
 * Line breaks are preserved; markup is not interpreted anywhere (the UI renders
 * the stored text through React, which escapes it).
 */
export const sendMessageSchema = z
  .object({
    conversationId: idSchema,
    body: z
      .string()
      .trim()
      .min(1, "Xabar bo‘sh bo‘lmasin.")
      .max(MESSAGE_BODY_MAX_LENGTH, `Xabar ${MESSAGE_BODY_MAX_LENGTH} belgidan oshmasin.`),
  })
  .strict();

/** Advance my read marker to one message I was actually shown. */
export const markConversationReadSchema = z
  .object({ conversationId: idSchema, lastMessageId: idSchema })
  .strict();

/* --------------------------- Phase 17 · refunds ---------------------------- */

/**
 * Student refund request — INTENT ONLY.
 *
 * The form may carry exactly two fields: WHICH enrollment and WHY. Everything
 * else about the money is derived server-side from the database:
 *   • the amount comes from the payment's immutable Phase 14 snapshot;
 *   • the payment comes from the enrollment, not from the browser;
 *   • the student comes from the session cookie, never from a field.
 *
 * `.strict()` is the enforcement: a request that carries `paymentId`,
 * `studentId`, `amount`, `status`, `provider` or `teacherId` is REJECTED rather
 * than silently stripped, so an over-posting attempt fails loudly in tests and
 * cannot be mistaken for a supported input.
 */
export const refundRequestSchema = z
  .object({
    enrollmentRequestId: idSchema,
    reason: z
      .string()
      .trim()
      .min(
        REFUND_REASON_MIN_LENGTH,
        `Sababni kamida ${REFUND_REASON_MIN_LENGTH} belgi bilan yozing.`,
      )
      .max(
        REFUND_REASON_MAX_LENGTH,
        `Sabab ${REFUND_REASON_MAX_LENGTH} belgidan oshmasin.`,
      ),
  })
  .strict();

/** Admin approval — the decision is the ONLY input; no amount, no status. */
export const refundApprovalSchema = z.object({ refundRequestId: idSchema }).strict();

/** Admin rejection — a decision requires a reason for the student. */
export const refundRejectionSchema = z
  .object({
    refundRequestId: idSchema,
    feedback: z
      .string()
      .trim()
      .min(
        REFUND_FEEDBACK_MIN_LENGTH,
        `Izohni kamida ${REFUND_FEEDBACK_MIN_LENGTH} belgi bilan yozing.`,
      )
      .max(
        REFUND_FEEDBACK_MAX_LENGTH,
        `Izoh ${REFUND_FEEDBACK_MAX_LENGTH} belgidan oshmasin.`,
      ),
  })
  .strict();

/** Admin records the outcome of the provider operation. Same shape as rejection. */
export const refundFailureSchema = refundRejectionSchema;

/* --------------------------------- reviews --------------------------------- */
/*
 * PHASE 19 review schemas.
 *
 * A review payload carries EXACTLY what a student can legitimately choose:
 * which course, which of THEIR OWN accepted enrollments it is about, a rating and
 * a body. There is no `studentUserId`, no `author`, no `role`, no `status` and no
 * `courseId`-adjacent ownership field, and `.strict()` makes an attempt to send one
 * a validation ERROR rather than a silently ignored key — so "author comes from the
 * session" is enforced by the shape of the input, not by a comment.
 *
 * The bounds mirror the database CHECK constraints (see lib/reviews.ts), so the
 * server can never accept a rating or a length the table would refuse.
 */

const reviewRatingSchema = z.coerce
  .number()
  .int(`Baho ${REVIEW_RATING_MIN} dan ${REVIEW_RATING_MAX} gacha bo‘lgan butun son bo‘lsin.`)
  .min(REVIEW_RATING_MIN, `Baho kamida ${REVIEW_RATING_MIN} bo‘lsin.`)
  .max(REVIEW_RATING_MAX, `Baho ${REVIEW_RATING_MAX} dan oshmasin.`);

/** Body is normalised (control chars stripped, whitespace collapsed) before the
 *  length is judged, so 20 newlines cannot pass as an opinion. */
const reviewBodySchema = z
  .string()
  .transform(normalizeReviewBody)
  .refine((value) => value.length >= REVIEW_BODY_MIN_LENGTH, {
    message: `Fikr kamida ${REVIEW_BODY_MIN_LENGTH} belgidan iborat bo‘lsin.`,
  })
  .refine((value) => value.length <= REVIEW_BODY_MAX_LENGTH, {
    message: `Fikr ${REVIEW_BODY_MAX_LENGTH} belgidan oshmasin.`,
  });

/** Create. Identity is NOT a field: the session supplies it. */
export const createCourseReviewSchema = z
  .object({
    courseId: idSchema,
    /** Must be the session student's own ACCEPTED enrollment — proven in SQL. */
    enrollmentRequestId: idSchema,
    rating: reviewRatingSchema,
    body: reviewBodySchema,
  })
  .strict();

/**
 * Edit. Note what is ABSENT: `courseId` and `studentUserId`. A review's course and
 * author are decided when it is created and cannot be re-pointed by an edit — the
 * service updates only rating/body/status, and ownership is checked against the
 * locked row.
 */
export const updateCourseReviewSchema = z
  .object({
    reviewId: idSchema,
    rating: reviewRatingSchema,
    body: reviewBodySchema,
  })
  .strict();

export const withdrawCourseReviewSchema = z.object({ reviewId: idSchema }).strict();

/** Admin publish — the decision is the whole input. */
export const publishCourseReviewSchema = z.object({ reviewId: idSchema }).strict();

/**
 * Admin rejection. The reason is OPTIONAL (a decision without prose is still a
 * decision), but if one is written it must say something and stay short — the
 * database CHECK enforces the same bounds.
 */
export const rejectCourseReviewSchema = z
  .object({
    reviewId: idSchema,
    reason: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length === 0 || value.length >= REVIEW_REASON_MIN_LENGTH, {
        message: `Sabab kamida ${REVIEW_REASON_MIN_LENGTH} belgidan iborat bo‘lsin yoki bo‘sh qoldiring.`,
      })
      .refine((value) => value.length <= REVIEW_REASON_MAX_LENGTH, {
        message: `Sabab ${REVIEW_REASON_MAX_LENGTH} belgidan oshmasin.`,
      }),
  })
  .strict();

/* ---------------------------------- media ---------------------------------- */
/*
 * PHASE 18 upload schemas.
 *
 * Each action has its OWN schema and its own purpose, and the FILE is taken from
 * the FormData separately — never parsed by Zod, never trusted. `.strict()` is
 * what makes "post `visibility: public`" a validation ERROR rather than a
 * silently ignored field, so no caller can even express an override.
 */

/** Verification document upload: the document TYPE is the only client input. */
export const verificationDocumentUploadSchema = z
  .object({ documentType: z.enum(VERIFICATION_DOCUMENT_TYPES) })
  .strict();

/** Profile image upload: NO fields at all. The owner is the session user. */
export const profileImageUploadSchema = z.object({}).strict();

/** Course cover upload: the course is chosen, nothing else. */
export const courseCoverUploadSchema = z.object({ courseId: idSchema }).strict();

/** Remove one own, not-yet-attached verification document. */
export const verificationDocumentRemovalSchema = z.object({ assetId: idSchema }).strict();

/** Remove an own course cover (draft only — enforced server-side). */
export const courseCoverRemovalSchema = z.object({ courseId: idSchema }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;

/** Uniform typed result for every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
