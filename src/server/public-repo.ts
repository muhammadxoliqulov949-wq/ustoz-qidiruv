import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "./db/client";
import { publicMediaIndex, teacherPhotoUrl } from "./file-service";
import { getAcceptedCounts } from "./enrollment-service";
import {
  listPublicCourseReviews as reviewServiceListPublicCourseReviews,
  listPublicTeacherReviews as reviewServiceListPublicTeacherReviews,
  type PublicReviewView,
  type PublicTeacherReviewView,
} from "./review-service";
import { categories } from "@/data/categories";
import { courseFormatLabels } from "@/data/courses";
import type {
  Course,
  CourseFormat,
  CourseGroup,
  SyllabusModule,
  Teacher,
} from "@/data/models";
import type { TeacherRow } from "@/data/teacher-rows";
import { formatDateUz } from "@/components/course-detail/date";
import { defaultBrowseParams, type CourseBrowseParams } from "@/lib/course-search";
import type { DashCatalog } from "@/lib/dashboard";
import { formatPrice } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* PUBLIC MARKETPLACE REPOSITORY — Phase 12.                                   */
/*                                                                              */
/* This module is the ONLY place the public marketplace touches the database.  */
/* Pages and components receive plain, already-projected model objects and stay */
/* completely ignorant of Drizzle, SQL and column names.                        */
/*                                                                              */
/* CONSUMERS — /courses, /categories, /categories/[slug], /teachers,            */
/* /teachers/[slug], the course detail page AND the homepage recommendation     */
/* rows. Every public surface reads through here, so no page can hold a second, */
/* static copy of marketplace inventory that the database disagrees with.       */
/*                                                                              */
/* PROJECTION STRATEGY                                                          */
/* Rows are projected into the SAME `Course` / `Teacher` / `TeacherRow` types   */
/* the approved Phase 3-5 UI already consumes. That is deliberate: the UI       */
/* components and the pure search engines (applyCourseBrowse / applyTeacherBrowse)*/
/* are untouched, so switching the data source cannot regress the approved UX.  */
/*                                                                              */
/* VISIBILITY IS ENFORCED HERE, IN SQL                                          */
/* Every public query filters `status = 'published'`. Drafts are excluded by    */
/* the query itself, not by a UI `.filter()` that a future component could      */
/* forget — a draft is not "hidden", it is never selected.                      */
/*                                                                              */
/* HONEST AVAILABILITY                                                          */
/* `seatsRemaining` is NOT stored (Phase 11 rule: no invented occupancy). It is */
/* derived as capacity minus the count of ACCEPTED enrollment requests, which   */
/* is a real number backed by real rows. Pending requests do not occupy a seat. */
/*                                                                              */
/* RUNTIME ONLY — NEVER AT BUILD TIME                                           */
/* Every read here is a request-time query. Nothing in this module is called    */
/* from `generateStaticParams`, and no slug-listing helper exists for that      */
/* purpose: enumerating runtime rows during `next build` would make every       */
/* deployment depend on a reachable database and would freeze a path set that   */
/* changes after deploy. Unknown, draft and unpublished slugs 404 at request    */
/* time through the `status = 'published'` predicate below.                     */
/*                                                                              */
/* Every route that renders these reads therefore declares                      */
/* `export const dynamic = "force-dynamic"` — the browse routes, the detail      */
/* routes and the homepage alike — so `next build` never executes a query and    */
/* still succeeds with no database configured.                                  */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* PHASE 18: managed media overlays.                                           */
/*                                                                              */
/* A teacher's profile image and a course cover may now come from the media      */
/* store. The rule is "managed asset WINS, legacy seed/static path remains the   */
/* fallback", so nothing breaks for the thousands of rows that still carry a     */
/* `/media/...` path — and no fixture had to be migrated into object storage.     */
/*                                                                              */
/* Both overlays are BATCHED (one query per page) and read only ACTIVE PUBLIC    */
/* assets, so a private verification document structurally cannot appear in a    */
/* marketplace projection.                                                      */
/* -------------------------------------------------------------------------- */

async function withCourseCovers(items: Course[]): Promise<Course[]> {
  if (items.length === 0) return items;
  try {
    const index = await publicMediaIndex({ courseIds: items.map((item) => item.id) });
    if (index.courseCovers.size === 0) return items;
    return items.map((item) => {
      const managed = index.courseCovers.get(item.id);
      return managed ? { ...item, image: managed } : item;
    });
  } catch {
    // A storage misconfiguration must not take the marketplace down: the
    // legacy image is already a valid value.
    return items;
  }
}

async function withTeacherPhotos(rows: TeacherRow[]): Promise<TeacherRow[]> {
  if (rows.length === 0) return rows;
  try {
    const index = await publicMediaIndex({
      teacherUserIds: rows.map((row) => row.teacher.id),
    });
    if (index.teacherPhotos.size === 0) return rows;
    return rows.map((row) => {
      const managed = index.teacherPhotos.get(row.teacher.id);
      return managed ? { ...row, teacher: { ...row.teacher, photo: managed } } : row;
    });
  } catch {
    return rows;
  }
}

const categoryById = new Map(categories.map((category) => [category.id, category]));

/** Only this status is ever public. */
const PUBLIC_STATUS = "published" as const;

type CourseRow = typeof schema.courses.$inferSelect;
type GroupRow = typeof schema.courseGroups.$inferSelect;
type ModuleRow = typeof schema.syllabusModules.$inferSelect;
type TeacherRowDb = typeof schema.teacherProfiles.$inferSelect;

/* ----------------------------- projections -------------------------------- */

function toTeacher(row: TeacherRowDb, activeCourses: number): Teacher {
  return {
    id: row.userId,
    slug: row.slug,
    name: row.name,
    photo: row.photo,
    // Verification is DB truth. Nothing here upgrades it.
    verified: row.verification === "verified",
    specialization: row.specialization ?? "",
    bio: row.bio ?? "",
    detail: { approach: row.approach ?? "" },
    rating: row.ratingX10 / 10,
    reviews: row.reviewsCount,
    students: row.studentsCount,
    experienceYears: row.experienceYears ?? 0,
    languages: row.languages,
    activeCourses,
  };
}

function toGroup(row: GroupRow, seatsRemaining: number): CourseGroup {
  return {
    id: row.id,
    title: row.title,
    days: row.days,
    startTime: row.startTime,
    format: row.format,
    location: row.location,
    capacity: row.capacity,
    seatsRemaining,
    startDate: row.startDate,
  };
}

function toModule(row: ModuleRow): SyllabusModule {
  return { title: row.title, description: row.description, lessons: row.lessons };
}

function toCourse(
  row: CourseRow,
  teacher: { id: string; name: string; verified: boolean },
  groups: CourseGroup[],
  syllabus: SyllabusModule[],
): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categoryId: row.categoryId,
    teacher,
    rating: row.ratingX10 / 10,
    reviews: row.reviewsCount,
    students: row.studentsCount,
    format: row.format,
    location: row.location,
    city: row.city,
    level: row.level,
    schedule: row.schedule,
    // A published course always has this (DB CHECK enforces it).
    publishedAt: row.publishedAt ?? "",
    keywords: row.keywords,
    priceUzs: row.priceUzs,
    image: row.image,
    detail: {
      summary: row.summary,
      longDescription: row.longDescription,
      audience: row.audience,
      learningOutcomes: row.learningOutcomes,
      teachingLanguages: row.teachingLanguages,
      pricePeriod: "month",
      groups,
      syllabus,
    },
  };
}

/* --------------------------- availability --------------------------------- */

/**
 * Live seat availability for a set of groups.
 *
 * PHASE 13: a seat is occupied only by an ACCEPTED request. A pending
 * (`submitted`) request does not reduce availability — it has not been granted
 * yet, and counting it would overstate how full a group is and could block
 * other students on the strength of an undecided request.
 *
 * This delegates to the enrollment service so the public marketplace and the
 * teacher dashboard compute occupancy from exactly one definition. Nothing is
 * stored or decremented: cancelling an accepted place restores the seat for
 * free, because this is a COUNT.
 */
async function liveSeats(groupIds: string[]): Promise<Map<string, number>> {
  return getAcceptedCounts(groupIds);
}

/* -------------------------------- reviews --------------------------------- */

/*
 * PHASE 19: written reviews come from PostgreSQL through the review service, and
 * the public projection is deliberately tiny (id, rating, body, date, a safe
 * author label). The `status = 'published'` predicate lives in the service's SQL,
 * so a pending, rejected or withdrawn review is never selected by a public
 * surface — it is not "hidden by a filter", it is not in the result set.
 *
 * There is NO fixture fallback: the compiled-in sample list this replaced is
 * deleted, so an empty array means the section renders its honest empty state
 * rather than borrowed testimonials.
 *
 * These wrappers exist so the public marketplace keeps exactly ONE database
 * boundary — pages import from here and never reach a service directly.
 */

export type { PublicReviewView, PublicTeacherReviewView };

/** Published written reviews for one course, newest first. */
export async function listPublicCourseReviews(courseId: string): Promise<PublicReviewView[]> {
  return reviewServiceListPublicCourseReviews(courseId);
}

/** Published reviews across all of a teacher's published courses, newest first. */
export async function listPublicTeacherReviews(
  teacherUserId: string,
): Promise<PublicTeacherReviewView[]> {
  return reviewServiceListPublicTeacherReviews(teacherUserId);
}

/* ------------------------------ course reads ------------------------------ */

/**
 * Public course listing. Filtering and sorting that SQL can express are pushed
 * into SQL (status, category, format, level, schedule, city, price bounds,
 * rating, ordering) so the whole table is never loaded to render one page.
 *
 * Free-text search stays in the pure Phase 3 engine: it normalises Uzbek
 * latin/cyrillic variants and searches a composed haystack that includes the
 * category NAME. Reimplementing that in SQL would risk changing approved
 * search behaviour, which is explicitly out of scope.
 *
 * `options.limit` caps the result IN SQL, for surfaces that render a fixed
 * number of picks (the homepage rows). It is a row cap only — it never widens
 * visibility, because the `status = 'published'` predicate below is applied
 * first and unconditionally. Browse surfaces omit it and keep the full result
 * set.
 */
export async function listPublicCourses(
  params: CourseBrowseParams,
  options: { categoryId?: string | null; limit?: number | null } = {},
): Promise<Course[]> {
  const db = getDb();
  const where = [
    eq(schema.courses.status, PUBLIC_STATUS),
    // Account lifecycle, not profile-directory promotion, owns visibility here.
    eq(schema.users.accountStatus, "active"),
  ];

  if (options.categoryId) where.push(eq(schema.courses.categoryId, options.categoryId));
  if (params.format) where.push(eq(schema.courses.format, params.format));
  if (params.level) where.push(eq(schema.courses.level, params.level));
  if (params.schedule) where.push(eq(schema.courses.schedule, params.schedule));
  if (params.city) where.push(eq(schema.courses.city, params.city));
  if (params.price === "free") where.push(eq(schema.courses.priceUzs, 0));
  if (params.price === "paid") where.push(sql`${schema.courses.priceUzs} > 0`);
  if (params.priceMin !== null) where.push(gte(schema.courses.priceUzs, params.priceMin));
  if (params.priceMax !== null) where.push(lte(schema.courses.priceUzs, params.priceMax));
  if (params.minRating !== null) {
    where.push(gte(schema.courses.ratingX10, Math.round(params.minRating * 10)));
  }

  // Deterministic ordering, matching the approved pure sorters exactly.
  const order =
    params.sort === "rating"
      ? [desc(schema.courses.ratingX10), desc(schema.courses.reviewsCount), asc(schema.courses.id)]
      : params.sort === "price-asc"
        ? [asc(schema.courses.priceUzs), desc(schema.courses.publishedAt), asc(schema.courses.id)]
        : params.sort === "price-desc"
          ? [desc(schema.courses.priceUzs), desc(schema.courses.publishedAt), asc(schema.courses.id)]
          : params.sort === "newest"
            ? [desc(schema.courses.publishedAt), asc(schema.courses.id)]
            : // "recommended" preserves catalogue order (stable by id).
              [asc(schema.courses.id)];

  const listing = db
    .select({ course: schema.courses, teacher: schema.teacherProfiles })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
    .where(and(...where))
    .orderBy(...order);

  // Applied AFTER the visibility predicate and the ordering, so a capped
  // surface gets the top N published rows — never a different population.
  const limit = options.limit ?? null;
  const rows = limit !== null && limit > 0 ? await listing.limit(limit) : await listing;

  if (rows.length === 0) return [];

  // Groups are needed by the list cards (earliest start date) and by search.
  const courseIds = rows.map((row) => row.course.id);
  const groupRows = await db
    .select()
    .from(schema.courseGroups)
    .where(inArray(schema.courseGroups.courseId, courseIds))
    .orderBy(asc(schema.courseGroups.startDate));
  const seats = await liveSeats(groupRows.map((group) => group.id));

  const groupsByCourse = new Map<string, CourseGroup[]>();
  for (const group of groupRows) {
    const remaining = Math.max(0, group.capacity - (seats.get(group.id) ?? 0));
    const list = groupsByCourse.get(group.courseId);
    const projected = toGroup(group, remaining);
    if (list) list.push(projected);
    else groupsByCourse.set(group.courseId, [projected]);
  }

  return withCourseCovers(
    rows.map((row) =>
      toCourse(
        row.course,
        {
          id: row.teacher.userId,
          name: row.teacher.name,
          verified: row.teacher.verification === "verified",
        },
        groupsByCourse.get(row.course.id) ?? [],
        // The listing never renders the syllabus — don't fetch it.
        [],
      ),
    ),
  );
}

/** Full public course by slug, including groups and ordered syllabus. */
async function fetchPublicCourseBySlug(slug: string): Promise<Course | null> {
  const db = getDb();
  const rows = await db
    .select({ course: schema.courses, teacher: schema.teacherProfiles })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
    .where(
      and(
        eq(schema.courses.slug, slug),
        eq(schema.courses.status, PUBLIC_STATUS),
        eq(schema.users.accountStatus, "active"),
      ),
    )
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  const [groupRows, moduleRows] = await Promise.all([
    db
      .select()
      .from(schema.courseGroups)
      .where(eq(schema.courseGroups.courseId, found.course.id))
      .orderBy(asc(schema.courseGroups.startDate)),
    db
      .select()
      .from(schema.syllabusModules)
      .where(eq(schema.syllabusModules.courseId, found.course.id))
      .orderBy(asc(schema.syllabusModules.position)),
  ]);

  const seats = await liveSeats(groupRows.map((group) => group.id));

  const [course] = await withCourseCovers([
    toCourse(
      found.course,
      {
        id: found.teacher.userId,
        name: found.teacher.name,
        verified: found.teacher.verification === "verified",
      },
      groupRows.map((group) =>
        toGroup(group, Math.max(0, group.capacity - (seats.get(group.id) ?? 0))),
      ),
      moduleRows.map(toModule),
    ),
  ]);
  return course;
}

/*
 * Phase 22: request-memoized. `generateMetadata` and the page component
 * run in the SAME request and ask for the SAME row, so without this every
 * detail page paid for its course/teacher read twice. `cache()` is
 * request-scoped (a new request re-reads; revalidation still takes
 * effect immediately) and a transparent passthrough outside React.
 */
export const getPublicCourseBySlug = cache(fetchPublicCourseBySlug);

/* ------------------------------ teacher reads ----------------------------- */

/**
 * Public teacher rows. A teacher appears only when the profile is public AND
 * actually owns at least one published course, so the directory can never
 * advertise an empty profile. Facets (cities/formats/categories/min price) are
 * DERIVED from those published courses — exactly like the Phase 5 read model,
 * so a teacher's claims cannot drift from the courses that exist.
 */
export async function listPublicTeachers(): Promise<TeacherRow[]> {
  const db = getDb();
  const teacherRows = await db
    .select({ teacher: schema.teacherProfiles })
    .from(schema.teacherProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.teacherProfiles.userId))
    .where(and(eq(schema.teacherProfiles.isPublic, true), eq(schema.users.accountStatus, "active")))
    .orderBy(asc(schema.teacherProfiles.userId));

  if (teacherRows.length === 0) return [];

  const courseRows = await db
    .select({
      id: schema.courses.id,
      teacherUserId: schema.courses.teacherUserId,
      categoryId: schema.courses.categoryId,
      city: schema.courses.city,
      format: schema.courses.format,
      priceUzs: schema.courses.priceUzs,
    })
    .from(schema.courses)
    .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
    .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
    .where(
      and(
        eq(schema.courses.status, PUBLIC_STATUS),
        eq(schema.teacherProfiles.isPublic, true),
        eq(schema.users.accountStatus, "active"),
      ),
    )
    .orderBy(asc(schema.courses.id));

  const FORMAT_ORDER: CourseFormat[] = ["online", "offline", "hybrid"];
  const rows: TeacherRow[] = [];

  // Phase 22: group once (O(teachers + courses)) instead of filtering the
  // whole course list per teacher (O(teachers × courses)). Same membership,
  // same order — the filter below used to re-scan `courseRows` for every row.
  const coursesByTeacher = new Map<string, typeof courseRows>();
  for (const course of courseRows) {
    const list = coursesByTeacher.get(course.teacherUserId);
    if (list) list.push(course);
    else coursesByTeacher.set(course.teacherUserId, [course]);
  }

  for (const row of teacherRows) {
    const teacher = row.teacher;
    const own = coursesByTeacher.get(teacher.userId) ?? [];
    if (own.length === 0) continue; // no published course → not in the directory

    const categoryIds: string[] = [];
    const cities: string[] = [];
    const formats = new Set<CourseFormat>();
    let minPrice: number | null = null;
    let hasFree = false;

    for (const course of own) {
      if (!categoryIds.includes(course.categoryId)) categoryIds.push(course.categoryId);
      if (course.city && !cities.includes(course.city)) cities.push(course.city);
      formats.add(course.format);
      if (course.priceUzs === 0) hasFree = true;
      minPrice = minPrice === null ? course.priceUzs : Math.min(minPrice, course.priceUzs);
    }

    rows.push({
      teacher: toTeacher(teacher, own.length),
      courseIds: own.map((course) => course.id),
      categorySlugs: categoryIds.map((id) => categoryById.get(id)?.slug ?? id),
      categoryNames: categoryIds.map((id) => categoryById.get(id)?.name ?? ""),
      cities,
      formats: FORMAT_ORDER.filter((format) => formats.has(format)),
      minPriceUzs: minPrice,
      hasFreeCourse: hasFree,
    });
  }

  return withTeacherPhotos(rows);
}

async function fetchPublicTeacherBySlug(
  slug: string,
): Promise<{ row: TeacherRow; courses: Course[] } | null> {
  const db = getDb();
  const found = await db
    .select({ teacher: schema.teacherProfiles })
    .from(schema.teacherProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.teacherProfiles.userId))
    .where(
      and(
        eq(schema.teacherProfiles.slug, slug),
        eq(schema.teacherProfiles.isPublic, true),
        eq(schema.users.accountStatus, "active"),
      ),
    )
    .limit(1);

  const teacher = found[0]?.teacher;
  if (!teacher) return null;

  // Ownership comes from the FK, so there is exactly one course→teacher link.
  const courseRows = await db
    .select({ course: schema.courses })
    .from(schema.courses)
    .where(
      and(
        eq(schema.courses.teacherUserId, teacher.userId),
        eq(schema.courses.status, PUBLIC_STATUS),
      ),
    )
    .orderBy(asc(schema.courses.id));

  // A public teacher profile remains a valid page even when it currently has no
  // live courses; the directory intentionally filters those profiles out, while
  // a direct link can render an honest zero-course state.
  const courseIds = courseRows.map((row) => row.course.id);
  const groupRows =
    courseIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.courseGroups)
          .where(inArray(schema.courseGroups.courseId, courseIds))
          .orderBy(asc(schema.courseGroups.startDate));
  const seats = await liveSeats(groupRows.map((group) => group.id));

  const groupsByCourse = new Map<string, CourseGroup[]>();
  for (const group of groupRows) {
    const projected = toGroup(group, Math.max(0, group.capacity - (seats.get(group.id) ?? 0)));
    const list = groupsByCourse.get(group.courseId);
    if (list) list.push(projected);
    else groupsByCourse.set(group.courseId, [projected]);
  }

  const publicTeacher = toTeacher(teacher, courseRows.length);
  const courses = await withCourseCovers(
    courseRows.map((row) =>
      toCourse(
        row.course,
        { id: publicTeacher.id, name: publicTeacher.name, verified: publicTeacher.verified },
        groupsByCourse.get(row.course.id) ?? [],
        [],
      ),
    ),
  );

  const FORMAT_ORDER: CourseFormat[] = ["online", "offline", "hybrid"];
  const categoryIds: string[] = [];
  const cities: string[] = [];
  const formats = new Set<CourseFormat>();
  let minPrice: number | null = null;
  let hasFree = false;
  for (const course of courses) {
    if (!categoryIds.includes(course.categoryId)) categoryIds.push(course.categoryId);
    if (course.city && !cities.includes(course.city)) cities.push(course.city);
    formats.add(course.format);
    if (course.priceUzs === 0) hasFree = true;
    minPrice = minPrice === null ? course.priceUzs : Math.min(minPrice, course.priceUzs);
  }

  const [resolvedRow] = await withTeacherPhotos([
    {
      teacher: publicTeacher,
      courseIds,
      categorySlugs: categoryIds.map((id) => categoryById.get(id)?.slug ?? id),
      categoryNames: categoryIds.map((id) => categoryById.get(id)?.name ?? ""),
      cities,
      formats: FORMAT_ORDER.filter((format) => formats.has(format)),
      minPriceUzs: minPrice,
      hasFreeCourse: hasFree,
    },
  ]);

  return {
    row: resolvedRow ?? {
      teacher: publicTeacher,
      courseIds,
      categorySlugs: categoryIds.map((id) => categoryById.get(id)?.slug ?? id),
      categoryNames: categoryIds.map((id) => categoryById.get(id)?.name ?? ""),
      cities,
      formats: FORMAT_ORDER.filter((format) => formats.has(format)),
      minPriceUzs: minPrice,
      hasFreeCourse: hasFree,
    },
    courses,
  };
}

/*
 * Phase 22: request-memoized. `generateMetadata` and the page component
 * run in the SAME request and ask for the SAME row, so without this every
 * detail page paid for its course/teacher read twice. `cache()` is
 * request-scoped (a new request re-reads; revalidation still takes
 * effect immediately) and a transparent passthrough outside React.
 */
export const getPublicTeacherBySlug = cache(fetchPublicTeacherBySlug);

/* ------------------------------ facet options ----------------------------- */

/**
 * Facet option lists derived from live public data — every option can match.
 *
 * PHASE 20: both lists describe the SAME population the browse pages render.
 * Cities come from published courses (an online-only catalogue yields no city
 * facet at all); languages come from public profiles that actually own at
 * least one published course — the exact directory membership
 * `listPublicTeachers()` returns — so a language no visible teacher teaches
 * in is never offered. An empty database yields empty lists, and the browse
 * sidebars render no option that implies inventory which does not exist.
 */
export async function getPublicFacets(): Promise<{
  cities: string[];
  languages: string[];
  categoryCounts: Map<string, number>;
}> {
  const db = getDb();
  // Teachers with at least one published course — the directory population.
  const directoryTeachers = db
    .selectDistinct({ teacherUserId: schema.courses.teacherUserId })
    .from(schema.courses)
    .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
    .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
    .where(and(eq(schema.courses.status, PUBLIC_STATUS), eq(schema.teacherProfiles.isPublic, true), eq(schema.users.accountStatus, "active")));
  const [cityRows, langRows, categoryCounts] = await Promise.all([
    db
      .selectDistinct({ city: schema.courses.city })
      .from(schema.courses)
      .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
      .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
      .where(and(eq(schema.courses.status, PUBLIC_STATUS), eq(schema.users.accountStatus, "active"), sql`${schema.courses.city} IS NOT NULL`))
      .orderBy(asc(schema.courses.city)),
    db
      .select({ languages: schema.teacherProfiles.languages })
      .from(schema.teacherProfiles)
      .where(
        and(
          eq(schema.teacherProfiles.isPublic, true),
          inArray(schema.teacherProfiles.userId, directoryTeachers),
        ),
      ),
    getCategoryCourseCounts(),
  ]);

  const languageSet = new Set<string>();
  for (const row of langRows) for (const tag of row.languages) languageSet.add(tag);

  return {
    cities: cityRows.map((row) => row.city).filter((city): city is string => city !== null),
    // Keep the approved display order rather than DB order.
    languages: ["UZ", "EN", "RU", "AR"].filter((tag) => languageSet.has(tag)),
    categoryCounts,
  };
}

/* ------------------------- student dashboard catalog ------------------------ */

/**
 * PHASE 20: the student dashboard catalog, projected from PostgreSQL.
 *
 * This REPLACES the deleted `src/data/dashboard-catalog.ts`, which built the
 * same `DashCatalog` shape from the fixture arrays at module scope. The shape
 * is unchanged — the dashboard islands (`OverviewPanels`, `RequestsPanel`,
 * `SavedPanel`) join it against the same browser stores exactly as before —
 * but every row now comes from the same request-time reads the public
 * marketplace uses:
 *
 *   • courses: published rows via `listPublicCourses()` (live group seats
 *     included, managed covers overlaid);
 *   • teachers: directory rows via `listPublicTeachers()` (public profiles
 *     that own at least one published course, active counts derived).
 *
 * There is deliberately no second database access pattern here: this function
 * composes the existing public reads and only reshapes them into the lite
 * projection. No fixture fallback exists: an empty database yields an empty
 * catalog, and the dashboard renders its honest empty states (a saved id or
 * an enrollment draft that names no published row simply resolves to
 * nothing, exactly as `savedCourses` / `toDashRequest` already specify).
 *
 * A course whose teacher has no public directory row keeps a null
 * `teacherSlug` (same as the old projection) rather than inventing a link.
 */
export async function getDashboardCatalog(): Promise<DashCatalog> {
  const [courses, teacherRows] = await Promise.all([
    listPublicCourses({ ...defaultBrowseParams }),
    listPublicTeachers(),
  ]);
  const slugByTeacherId = new Map(
    teacherRows.map((row) => [row.teacher.id, row.teacher.slug]),
  );

  return {
    courses: courses.map((course) => {
      const unit = course.detail.pricePeriod === "month" ? "oyiga" : "kurs uchun bir marta";
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        image: course.image,
        category: categoryById.get(course.categoryId)?.name ?? null,
        formatLabel: courseFormatLabels[course.format],
        location: course.format === "online" ? null : course.location,
        teacherName: course.teacher.name,
        teacherSlug: slugByTeacherId.get(course.teacher.id) ?? null,
        priceSummary:
          course.priceUzs === 0 ? "Bepul" : `${formatPrice(course.priceUzs)} / ${unit}`,
        priceUzs: course.priceUzs,
        groups: course.detail.groups.map((group) => ({
          id: group.id,
          title: group.title,
          days: group.days,
          startTime: group.startTime,
          format: group.format,
          formatLabel: courseFormatLabels[group.format],
          location: group.location,
          capacity: group.capacity,
          seatsRemaining: group.seatsRemaining,
          startDate: group.startDate,
          startDateLabel: formatDateUz(group.startDate),
        })),
      };
    }),
    teachers: teacherRows.map((row) => ({
      id: row.teacher.id,
      slug: row.teacher.slug,
      name: row.teacher.name,
      photo: row.teacher.photo,
      verified: row.teacher.verified,
      specialization: row.teacher.specialization,
      activeCourses: row.teacher.activeCourses,
    })),
  };
}

/**
 * Published-course count per category id — the number rendered beside each
 * category tile on the homepage and on /categories.
 *
 * WHICH CATEGORIES EXIST is static product taxonomy (`@/data/categories`:
 * id, slug, name, icon — the same vocabulary the authoring form, the URL
 * whitelist and `categoryId` validation use). HOW MANY COURSES each one holds
 * is marketplace inventory, so it is counted here and nowhere else: one
 * `GROUP BY` over `status = 'published'` rows.
 *
 * A category with nothing published is simply ABSENT from the map (a `GROUP BY`
 * returns no row for it) and callers render that as 0. No category is ever
 * given a placeholder number, because a tile that promises courses the
 * catalogue does not have is the same lie as a card linking to a 404.
 */
export async function getCategoryCourseCounts(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ categoryId: schema.courses.categoryId, total: count(schema.courses.id) })
    .from(schema.courses)
    .innerJoin(schema.teacherProfiles, eq(schema.teacherProfiles.userId, schema.courses.teacherUserId))
    .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
    .where(and(eq(schema.courses.status, PUBLIC_STATUS), eq(schema.users.accountStatus, "active")))
    .groupBy(schema.courses.categoryId);
  return new Map(rows.map((row) => [row.categoryId, Number(row.total)]));
}

/**
 * Full teacher record by user id — used by the course detail page so it can
 * render the teacher block without importing the canonical teacher array.
 * Returns null when the teacher is not publicly visible.
 */
async function fetchPublicTeacherById(userId: string): Promise<Teacher | null> {
  const db = getDb();
  // Phase 22: the profile row and the owned-course count are independent —
  // issuing them together halves this lookup's database round trips.
  const [rows, owned] = await Promise.all([
    db
      .select({ teacher: schema.teacherProfiles })
      .from(schema.teacherProfiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.teacherProfiles.userId))
      .where(
        and(
          eq(schema.teacherProfiles.userId, userId),
          eq(schema.teacherProfiles.isPublic, true),
          eq(schema.users.accountStatus, "active"),
        ),
      )
      .limit(1),
    db
      .select({ total: count(schema.courses.id) })
      .from(schema.courses)
      .innerJoin(schema.users, eq(schema.users.id, schema.courses.teacherUserId))
      .where(
        and(
          eq(schema.courses.teacherUserId, userId),
          eq(schema.courses.status, PUBLIC_STATUS),
          eq(schema.users.accountStatus, "active"),
        ),
      ),
  ]);
  const teacher = rows[0]?.teacher;
  if (!teacher) return null;
  const projected = toTeacher(teacher, Number(owned[0]?.total ?? 0));
  // Managed image wins; the legacy `/media/...` path stays the fallback.
  try {
    const managed = await teacherPhotoUrl(userId);
    return managed ? { ...projected, photo: managed } : projected;
  } catch {
    return projected;
  }
}

/*
 * Phase 22: request-memoized. `generateMetadata` and the page component
 * run in the SAME request and ask for the SAME row, so without this every
 * detail page paid for its course/teacher read twice. `cache()` is
 * request-scoped (a new request re-reads; revalidation still takes
 * effect immediately) and a transparent passthrough outside React.
 */
export const getPublicTeacherById = cache(fetchPublicTeacherById);
