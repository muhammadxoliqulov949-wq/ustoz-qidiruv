import { z } from "zod";
import { categories } from "@/data/categories";
import {
  extractUzPhoneDigits,
  UZ_MOBILE_PREFIXES,
  onboardingCities,
  onboardingLanguages,
  onboardingCategories,
} from "@/lib/onboarding";

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
    city: citySchema,
    district: z.string().trim().max(120),
    categories: z
      .array(z.string().refine((slug) => CATEGORY_SET.has(slug), "Noma’lum yo‘nalish."))
      .max(3),
    levels: z.array(z.enum(["boshlangich", "orta", "yuqori"])).max(3),
    formats: z.array(z.enum(["online", "offline"])).max(2),
    languages: languagesSchema,
    experienceYears: z.number().int().min(0).max(60).nullable(),
    bio: z.string().trim().max(1200),
    approach: z.string().trim().max(1200),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
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
