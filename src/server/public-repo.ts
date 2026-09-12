import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { getAcceptedCounts } from "./enrollment-service";
import { categories } from "@/data/categories";
import type {
  Course,
  CourseFormat,
  CourseGroup,
  SyllabusModule,
  Teacher,
} from "@/data/models";
import type { TeacherRow } from "@/data/teacher-rows";
import type { CourseBrowseParams } from "@/lib/course-search";

/* -------------------------------------------------------------------------- */
/* PUBLIC MARKETPLACE REPOSITORY — Phase 12.                                   */
/*                                                                              */
/* This module is the ONLY place the public marketplace touches the database.  */
/* Pages and components receive plain, already-projected model objects and stay */
/* completely ignorant of Drizzle, SQL and column names.                        */
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
/* -------------------------------------------------------------------------- */

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
 */
export async function listPublicCourses(
  params: CourseBrowseParams,
  options: { categoryId?: string | null } = {},
): Promise<Course[]> {
  const db = getDb();
  const where = [eq(schema.courses.status, PUBLIC_STATUS)];

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

  const rows = await db
    .select({ course: schema.courses, teacher: schema.teacherProfiles })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(and(...where))
    .orderBy(...order);

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

  return rows.map((row) =>
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
  );
}

/** Full public course by slug, including groups and ordered syllabus. */
export async function getPublicCourseBySlug(slug: string): Promise<Course | null> {
  const db = getDb();
  const rows = await db
    .select({ course: schema.courses, teacher: schema.teacherProfiles })
    .from(schema.courses)
    .innerJoin(
      schema.teacherProfiles,
      eq(schema.teacherProfiles.userId, schema.courses.teacherUserId),
    )
    .where(and(eq(schema.courses.slug, slug), eq(schema.courses.status, PUBLIC_STATUS)))
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

  return toCourse(
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
  );
}

/** Slugs of every public course — used by generateStaticParams. */
export async function listPublicCourseSlugs(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ slug: schema.courses.slug })
    .from(schema.courses)
    .where(eq(schema.courses.status, PUBLIC_STATUS));
  return rows.map((row) => row.slug);
}

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
    .select()
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.isPublic, true))
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
    .where(eq(schema.courses.status, PUBLIC_STATUS))
    .orderBy(asc(schema.courses.id));

  const FORMAT_ORDER: CourseFormat[] = ["online", "offline", "hybrid"];
  const rows: TeacherRow[] = [];

  for (const teacher of teacherRows) {
    const own = courseRows.filter((course) => course.teacherUserId === teacher.userId);
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

  return rows;
}

export async function getPublicTeacherBySlug(
  slug: string,
): Promise<{ row: TeacherRow; courses: Course[] } | null> {
  const db = getDb();
  const found = await db
    .select()
    .from(schema.teacherProfiles)
    .where(and(eq(schema.teacherProfiles.slug, slug), eq(schema.teacherProfiles.isPublic, true)))
    .limit(1);

  const teacher = found[0];
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
  const courses = courseRows.map((row) =>
    toCourse(
      row.course,
      { id: publicTeacher.id, name: publicTeacher.name, verified: publicTeacher.verified },
      groupsByCourse.get(row.course.id) ?? [],
      [],
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

  return {
    row: {
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

export async function listPublicTeacherSlugs(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ slug: schema.teacherProfiles.slug })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.isPublic, true));
  return rows.map((row) => row.slug);
}

/* ------------------------------ facet options ----------------------------- */

/** Facet option lists derived from live public data — every option can match. */
export async function getPublicFacets(): Promise<{
  cities: string[];
  languages: string[];
  categoryCounts: Map<string, number>;
}> {
  const db = getDb();
  const [cityRows, langRows, categoryRows] = await Promise.all([
    db
      .selectDistinct({ city: schema.courses.city })
      .from(schema.courses)
      .where(and(eq(schema.courses.status, PUBLIC_STATUS), sql`${schema.courses.city} IS NOT NULL`)),
    db
      .select({ languages: schema.teacherProfiles.languages })
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.isPublic, true)),
    db
      .select({ categoryId: schema.courses.categoryId, total: count(schema.courses.id) })
      .from(schema.courses)
      .where(eq(schema.courses.status, PUBLIC_STATUS))
      .groupBy(schema.courses.categoryId),
  ]);

  const languageSet = new Set<string>();
  for (const row of langRows) for (const tag of row.languages) languageSet.add(tag);

  return {
    cities: cityRows.map((row) => row.city).filter((city): city is string => city !== null),
    // Keep the approved display order rather than DB order.
    languages: ["UZ", "EN", "RU", "AR"].filter((tag) => languageSet.has(tag)),
    categoryCounts: new Map(categoryRows.map((row) => [row.categoryId, Number(row.total)])),
  };
}

/** Counts for the categories index page. */
export async function getCategoryCourseCounts(): Promise<Map<string, number>> {
  return (await getPublicFacets()).categoryCounts;
}

/**
 * Full teacher record by user id — used by the course detail page so it can
 * render the teacher block without importing the canonical teacher array.
 * Returns null when the teacher is not publicly visible.
 */
export async function getPublicTeacherById(userId: string): Promise<Teacher | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.teacherProfiles)
    .where(and(eq(schema.teacherProfiles.userId, userId), eq(schema.teacherProfiles.isPublic, true)))
    .limit(1);
  const teacher = rows[0];
  if (!teacher) return null;
  const owned = await db
    .select({ total: count(schema.courses.id) })
    .from(schema.courses)
    .where(
      and(eq(schema.courses.teacherUserId, userId), eq(schema.courses.status, PUBLIC_STATUS)),
    );
  return toTeacher(teacher, Number(owned[0]?.total ?? 0));
}
