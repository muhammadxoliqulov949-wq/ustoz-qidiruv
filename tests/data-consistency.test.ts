/* -------------------------------------------------------------------------- */
/* Phase 20 data-consistency test suite.                                        */
/*                                                                              */
/* Pins the Phase 20 contract: PostgreSQL is the runtime source of truth, every */
/* public read returns published/queryable rows only, inventory-dependent       */
/* facets derive from live rows (never fixtures), the deleted fixture modules   */
/* and exports have no importers, every footer link resolves to a built route,  */
/* and no DB-backed route is prerendered at build time.                         */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the same committed migrations production uses — the same harness    */
/* as the other suites.                                                         */
/*                                                                              */
/*   npm run test:consistency                                                  */
/* -------------------------------------------------------------------------- */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-consistency-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, condition: boolean): void {
  if (condition) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL: ${name}`);
  }
}

/** Every .ts/.tsx file under src/, relative paths. The scan covers src/ only:
 *  tests/ and README.md legitimately name the deleted exports as history. */
function srcFiles(): string[] {
  const root = path.join(process.cwd(), "src");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        out.push(path.relative(process.cwd(), full));
      }
    }
  };
  walk(root);
  return out;
}

function readLines(rel: string): string[] {
  return readFileSync(path.join(process.cwd(), rel), "utf8").split("\n");
}

async function main(): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const raw = new PGlite(DATA_DIR);
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await raw.exec(trimmed);
    }
  }
  await raw.close();

  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const publicRepo = await import("../src/server/public-repo");
  const { listStudentRequests } = await import("../src/server/enrollment-service");
  const { defaultBrowseParams, parseCourseBrowseParams } = await import(
    "../src/lib/course-search"
  );
  const { parseTeacherBrowseParams } = await import("../src/lib/teacher-search");
  const site = await import("../src/data/site");
  const { categories } = await import("../src/data/categories");
  const coursesModule = await import("../src/data/courses");
  const teacherRowsModule = await import("../src/data/teacher-rows");

  const db = getDb();

  /* ==================== EMPTY DATABASE — honest emptiness =================== */
  console.log("\n# EMPTY — a migrated but empty database is a supported state");

  check("empty DB: no public courses", (await publicRepo.listPublicCourses(defaultBrowseParams)).length === 0);
  check("empty DB: no public teachers", (await publicRepo.listPublicTeachers()).length === 0);
  const emptyFacets = await publicRepo.getPublicFacets();
  check("empty DB: no facet cities", emptyFacets.cities.length === 0);
  check("empty DB: no facet languages", emptyFacets.languages.length === 0);
  check("empty DB: no category counts", emptyFacets.categoryCounts.size === 0);
  check("empty DB: category counts map is empty", (await publicRepo.getCategoryCourseCounts()).size === 0);
  const emptyCatalog = await publicRepo.getDashboardCatalog();
  check("empty DB: dashboard catalog has no courses", emptyCatalog.courses.length === 0);
  check("empty DB: dashboard catalog has no teachers", emptyCatalog.teachers.length === 0);
  check("empty DB: unknown course slug is null", (await publicRepo.getPublicCourseBySlug("yoq-kurs")) === null);
  check("empty DB: unknown teacher slug is null", (await publicRepo.getPublicTeacherBySlug("yoq-ustoz")) === null);
  check("empty DB: student with no rows gets []", (await listStudentRequests("usr-nobody")).length === 0);

  /* ----------------------------- fixture setup ---------------------------- */
  const password = await hashPassword("phase20-consistency");

  async function makeUser(
    role: "student" | "teacher",
    phone: string,
    name: string,
    teacher?: { slug: string; isPublic: boolean; languages: string[] },
  ) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role, phone, passwordHash: password });
    if (role === "student") {
      await db.insert(schema.studentProfiles).values({ userId: id, name });
    } else {
      await db.insert(schema.teacherProfiles).values({
        userId: id,
        slug: teacher!.slug,
        name,
        bio: "B".repeat(60),
        city: "toshkent",
        languages: teacher!.languages,
        isPublic: teacher!.isPublic,
      });
    }
    return id;
  }

  async function makeCourse(
    teacherUserId: string,
    slug: string,
    extra: { status: "draft" | "published"; format: "online" | "offline"; city?: string; categoryId?: string },
  ) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: `Kurs ${slug}`,
      categoryId: extra.categoryId ?? "ielts",
      level: "orta",
      format: extra.format,
      city: extra.city ?? null,
      priceUzs: 100000,
      summary: "S".repeat(60),
      status: extra.status,
      publishedAt: extra.status === "published" ? "2026-01-15" : null,
    });
    return id;
  }

  async function makeGroup(courseId: string, capacity: number) {
    const id = newId("grp");
    await db.insert(schema.courseGroups).values({
      id,
      courseId,
      title: "Asosiy guruh",
      days: ["Du", "Cho"],
      startTime: "18:00",
      capacity,
      startDate: "2026-10-05",
    });
    return id;
  }

  // Directory teacher: public + owns published courses, teaches in UZ/EN.
  const teacherA = await makeUser("teacher", "+998901200001", "Ustoz A", {
    slug: "ustoz-a", isPublic: true, languages: ["UZ", "EN"],
  });
  // Private profile that still owns a published course (listed, but unlinkable).
  const teacherB = await makeUser("teacher", "+998901200002", "Ustoz B", {
    slug: "ustoz-b", isPublic: false, languages: ["RU"],
  });
  // Public profile with NO published course (not in the directory; RU excluded).
  const teacherC = await makeUser("teacher", "+998901200003", "Ustoz C", {
    slug: "ustoz-c", isPublic: true, languages: ["RU"],
  });
  const studentA = await makeUser("student", "+998901200004", "O‘quvchi A");
  const studentB = await makeUser("student", "+998901200005", "O‘quvchi B");

  const courseA = await makeCourse(teacherA, "kurs-a", { status: "published", format: "offline", city: "samarqand" });
  await makeCourse(teacherA, "kurs-b", { status: "published", format: "online" });
  await makeCourse(teacherA, "kurs-c", { status: "draft", format: "offline", city: "buxoro" });
  await makeCourse(teacherB, "kurs-d", { status: "published", format: "offline", city: "fargona" });
  await makeCourse(teacherC, "kurs-e", { status: "draft", format: "offline", city: "andijon" });
  const groupA = await makeGroup(courseA, 10);

  const requestId = newId("enr");
  await db.insert(schema.enrollmentRequests).values({
    id: requestId, studentUserId: studentA, courseId: courseA, groupId: groupA, note: "Qiziqaman",
  });

  /* ================== PUBLISHED-ONLY — public read predicates ============== */
  console.log("\n# PUBLISHED-ONLY — drafts never reach a public read");

  const listed = await publicRepo.listPublicCourses(defaultBrowseParams);
  const listedSlugs = new Set(listed.map((course) => course.slug));
  check("listing holds the three published courses",
    listedSlugs.has("kurs-a") && listedSlugs.has("kurs-b") && listedSlugs.has("kurs-d"));
  check("listing excludes the draft course", !listedSlugs.has("kurs-c"));

  check("draft slug resolves to null (would 404)", (await publicRepo.getPublicCourseBySlug("kurs-c")) === null);
  const detailA = await publicRepo.getPublicCourseBySlug("kurs-a");
  check("published slug resolves with its group",
    detailA !== null && detailA.detail.groups.length === 1 && detailA.detail.groups[0]!.seatsRemaining === 10);

  const directory = await publicRepo.listPublicTeachers();
  check("directory holds exactly the qualifying teacher",
    directory.length === 1 && directory[0]!.teacher.slug === "ustoz-a");
  check("private teacher profile is not in the directory",
    directory.every((row) => row.teacher.slug !== "ustoz-b"));
  check("public teacher with no published course is not in the directory",
    directory.every((row) => row.teacher.slug !== "ustoz-c"));
  check("private teacher slug resolves to null", (await publicRepo.getPublicTeacherBySlug("ustoz-b")) === null);
  const profileC = await publicRepo.getPublicTeacherBySlug("ustoz-c");
  check("course-less public profile renders with zero courses",
    profileC !== null && profileC.courses.length === 0);

  const counts = await publicRepo.getCategoryCourseCounts();
  check("category count counts published rows only", counts.get("ielts") === 3);
  check("category with nothing published is absent (renders as 0)", !counts.has("dasturlash"));

  /* ================= FACETS — inventory, not fixtures ===================== */
  console.log("\n# FACETS — live rows behind every inventory option");

  const facets = await publicRepo.getPublicFacets();
  check("facet cities come from published courses",
    JSON.stringify(facets.cities) === JSON.stringify(["fargona", "samarqand"]));
  check("draft course city is not a facet option", !facets.cities.includes("buxoro"));
  check("online course contributes no city", facets.cities.length === 2);
  check("facet languages come from directory teachers only",
    JSON.stringify(facets.languages) === JSON.stringify(["UZ", "EN"]));
  check("non-directory teacher language is not a facet option", !facets.languages.includes("RU"));

  /* ================== PARSERS — runtime allow-lists ======================= */
  console.log("\n# PARSERS — the URL whitelist follows live inventory");

  check("parser accepts a live city with the runtime allow-list",
    parseCourseBrowseParams({ city: "samarqand" }, facets.cities).city === "samarqand");
  check("parser drops a city with no live inventory",
    parseCourseBrowseParams({ city: "buxoro" }, facets.cities).city === null);
  check("parser drops garbage even with the allow-list",
    parseCourseBrowseParams({ city: "not-a-city" }, facets.cities).city === null);
  check("parser without a DB falls back to static taxonomy (never fixtures)",
    parseCourseBrowseParams({ city: "toshkent" }).city === "toshkent");
  check("taxonomy fallback still drops garbage",
    parseCourseBrowseParams({ city: "not-a-city" }).city === null);

  const teacherAllowed = { cities: facets.cities, languages: facets.languages };
  check("teacher parser accepts a live language",
    parseTeacherBrowseParams({ lang: "EN" }, teacherAllowed).lang === "EN");
  check("teacher parser drops a language with no directory teacher",
    parseTeacherBrowseParams({ lang: "RU" }, teacherAllowed).lang === null);
  check("teacher parser accepts a live city",
    parseTeacherBrowseParams({ city: "fargona" }, teacherAllowed).city === "fargona");
  check("teacher parser drops garbage",
    parseTeacherBrowseParams({ city: "xx", lang: "XX" }, teacherAllowed).city === null &&
    parseTeacherBrowseParams({ city: "xx", lang: "XX" }, teacherAllowed).lang === null);

  /* ============ DASHBOARD — account rows, honest empty states ============= */
  console.log("\n# DASHBOARD — the student cabinet reads the database");

  const catalog = await publicRepo.getDashboardCatalog();
  check("dashboard catalog holds published courses only",
    catalog.courses.length === 3 && catalog.courses.every((course) => course.slug !== "kurs-c"));
  check("dashboard catalog holds directory teachers only",
    catalog.teachers.length === 1 && catalog.teachers[0]!.slug === "ustoz-a");
  check("course of a non-directory teacher keeps a null teacherSlug (no invented link)",
    catalog.courses.find((course) => course.slug === "kurs-d")?.teacherSlug === null);

  const requestsA = await listStudentRequests(studentA);
  check("owner sees their real request row",
    requestsA.length === 1 && requestsA[0]!.id === requestId && requestsA[0]!.status === "submitted");
  check("student with no requests gets [] (honest empty state)", (await listStudentRequests(studentB)).length === 0);

  /* ============ STATIC AUDIT — the fixture cleanup holds ================== */
  console.log("\n# STATIC — deleted fixtures stay deleted");

  check("src/data/dashboard-catalog.ts does not exist", !existsSync(path.join(process.cwd(), "src/data/dashboard-catalog.ts")));
  const files = srcFiles();
  const dashboardImporters = files.filter((file) =>
    readLines(file).some((line) => /from\s+["'][^"']*dashboard-catalog["']/.test(line)),
  );
  check("nothing imports dashboard-catalog", dashboardImporters.length === 0);

  // The derived inventory vocabularies are deleted: the identifiers may only
  // survive inside the two history comments that record the deletion.
  const deletedIds = /\bcourseCities\b|\bteacherCities\b|\bteacherLanguages\b/;
  const strayMatches: string[] = [];
  for (const file of files) {
    for (const line of readLines(file)) {
      if (!deletedIds.test(line)) continue;
      const trimmed = line.trim();
      const isHistoryComment =
        trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("//");
      if (!isHistoryComment) strayMatches.push(`${file}: ${trimmed.slice(0, 80)}`);
    }
  }
  check("deleted identifiers survive only in history comments", strayMatches.length === 0);
  check("courses.ts exports no courseCities", !("courseCities" in coursesModule));
  check("teacher-rows.ts exports no teacherCities/teacherLanguages",
    !("teacherCities" in teacherRowsModule) && !("teacherLanguages" in teacherRowsModule));

  /* ============ STATIC AUDIT — copy truth and route truth ================= */
  console.log("\n# STATIC — no fake counts, no dead footer links");

  const heroSubtitle: string = site.hero.subtitle;
  check('hero subtitle makes no "Minglab" inventory claim', !heroSubtitle.includes("Minglab"));

  const footerLinks = site.footerGroups.flatMap((group) => group.links);
  check("footer carries no prefetch:false (every link is built)",
    footerLinks.every((link) => (link.prefetch ?? undefined) === undefined));
  check("footer links are internal paths", footerLinks.every((link) => link.href.startsWith("/")));
  const unresolved = footerLinks
    .map((link) => link.href.split("?")[0]!)
    .filter((pathname) => {
      const candidates = [
        `src/app${pathname}/page.tsx`,
        `src/app/(marketing)${pathname}/page.tsx`,
        `src/app/(auth)${pathname}/page.tsx`,
      ];
      return !candidates.some((candidate) => existsSync(path.join(process.cwd(), candidate)));
    });
  check("every footer href resolves to a built route file", unresolved.length === 0);

  for (const slug of ["about", "help", "contacts", "privacy", "terms"]) {
    check(`/${slug} route file exists`,
      existsSync(path.join(process.cwd(), `src/app/(marketing)/${slug}/page.tsx`)));
  }

  check("category taxonomy holds exactly six categories", categories.length === 6);
  check("category records carry no courseCount",
    categories.every((category) => !("courseCount" in category)));

  /* ============ STATIC AUDIT — no build-time database ===================== */
  console.log("\n# STATIC — build independence");

  const strayStaticParams: string[] = [];
  for (const file of files) {
    if (!file.startsWith("src/app/")) continue;
    for (const line of readLines(file)) {
      if (!line.includes("generateStaticParams")) continue;
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("//");
      if (!isComment) strayStaticParams.push(`${file}: ${trimmed.slice(0, 80)}`);
    }
  }
  check("generateStaticParams survives only in comments", strayStaticParams.length === 0);

  const dynamicRoutes = [
    "src/app/(marketing)/page.tsx",
    "src/app/(marketing)/courses/page.tsx",
    "src/app/(marketing)/courses/[slug]/page.tsx",
    "src/app/(marketing)/teachers/page.tsx",
    "src/app/(marketing)/teachers/[slug]/page.tsx",
    "src/app/(marketing)/categories/page.tsx",
    "src/app/(marketing)/categories/[slug]/page.tsx",
  ];
  for (const route of dynamicRoutes) {
    const body = readLines(route).join("\n");
    check(`${route.replace("src/app/(marketing)", "")} is force-dynamic`,
      body.includes('export const dynamic = "force-dynamic"'));
  }

  /* -------------------------------- summary -------------------------------- */
  console.log(`\n${pass} passed, ${fail} failed (${pass + fail} checks)`);
  if (fail > 0) {
    console.log("failures:");
    for (const name of failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
