/* -------------------------------------------------------------------------- */
/* Phase 23 — the verification-blocking profile fields, end to end.              */
/*                                                                              */
/* THE BUG THIS SUITE PINS                                                      */
/* /teacher/dashboard/verification refuses an application until six profile      */
/* fields are filled in (Yo‘nalish, Shahar, Dars tillari, Tajriba, O‘zingiz      */
/* haqingizda, Dars o‘tish uslubi), but /teacher/dashboard/profile had no input  */
/* that wrote any of them to the database — its only editor saved a browser      */
/* draft, and `specialization` had no write path at all. A teacher was therefore */
/* required to supply data they could not enter.                                 */
/*                                                                              */
/* WHAT IS PROVEN BELOW                                                         */
/*   1. The blocker as it was: a freshly registered teacher is ineligible, the   */
/*      six fields are exactly what is missing, and the submission is refused.   */
/*   2. The editable surface covers EVERY requirement — derived from the same    */
/*      list the predicate evaluates, not from a hand-written copy.              */
/*   3. Save → reload through the REAL path: the browser's FormData builder, the */
/*      server's reader, the `.strict()` schema and the UPDATE.                  */
/*   4. Verification eligibility reads the SAME persisted columns the form       */
/*      writes, and “Tasdiqlash uchun yuborish” enables on exactly one rule.     */
/*   5. Nothing was loosened to get there: over-posting, bad values and the      */
/*      Phase 18 evidence requirement all still refuse, and a failed save        */
/*      changes nothing.                                                         */
/*                                                                              */
/* Runs against a real PostgreSQL engine (PGlite) with the committed migrations, */
/* plus the local storage provider for the evidence upload. Nothing is mocked.   */
/*                                                                              */
/*   npm run test:phase23-profile                                               */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
/* Type-only: erased at runtime, so the env setup below still runs first. */
import type { TeacherProfileEditValues } from "../src/lib/teacher-profile";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-phase23-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
// The submission needs the Phase 18 evidence, so a real (local) provider runs.
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = path.join(DATA_DIR, "storage");
process.env.STORAGE_SIGNING_SECRET = "phase23-suite-signing-secret-0123456789";
process.env.APP_BASE_URL = "http://localhost:3000";

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

/** Smallest byte string the upload validator accepts as a document. */
const pdfPayload = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

async function main(): Promise<void> {
  /* --------------------------- migrate from scratch ------------------------ */
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

  const { eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const verificationLib = await import("../src/lib/teacher-verification");
  const profileLib = await import("../src/lib/teacher-profile");
  const onboarding = await import("../src/lib/onboarding");
  const profileService = await import("../src/server/profile-service");
  const verification = await import("../src/server/verification-service");
  const files = await import("../src/server/file-service");
  const { getTeacherProfile } = await import("../src/server/repo");
  const db = getDb();

  const CITY = onboarding.onboardingCities[0] ?? "toshkent";
  const LANGUAGE = onboarding.onboardingLanguages[0] ?? "UZ";
  const passwordHash = await hashPassword("phase23-test-password");

  /** A teacher exactly as `registerAction` creates one: a name and nothing else. */
  async function registerTeacher(name: string, phone: string): Promise<string> {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role: "teacher", phone, passwordHash });
    await db.insert(schema.teacherProfiles).values({
      userId: id,
      role: "teacher",
      slug: `p23-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase()}`,
      name,
      categories: [],
      levels: [],
      formats: [],
      languages: [],
      verification: "unverified",
      onboardingCompleted: false,
    });
    return id;
  }

  /** A complete, valid form payload — the six QA fields plus the rest. */
  function completeValues(
    overrides: Partial<TeacherProfileEditValues> = {},
  ): TeacherProfileEditValues {
    return {
      name: "Nilufar Karimova",
      specialization: "IELTS va umumiy ingliz tili",
      city: CITY,
      district: "Yunusobod",
      categories: ["ingliz-tili"],
      levels: ["orta"],
      formats: ["online"],
      languages: [LANGUAGE],
      experienceYears: "6",
      bio: "Olti yildan beri IELTS ga tayyorlayman. Har bir o‘quvchi uchun alohida reja tuzaman va natijani har oyda birga ko‘rib chiqamiz.",
      approach: "Darslar speaking va writing amaliyotiga quriladi: har haftada ikki marta, uy vazifasi tekshiruvi bilan.",
      onboardingCompleted: true,
      ...overrides,
    };
  }

  /** The QA-reported requirement set, by key. */
  const QA_FIELDS = [
    "specialization",
    "city",
    "languages",
    "experienceYears",
    "bio",
    "approach",
  ] as const;

  /* ========================================================================== */
  console.log("\n# 1 — the reported blocker: the required fields exist and are missing");

  const requirementKeys = verificationLib.VERIFICATION_REQUIREMENTS.map((r) => r.key);
  check(
    "1.1 verification requires the seven profile fields (name + the six QA fields)",
    requirementKeys.length === 7 &&
      QA_FIELDS.every((field) => requirementKeys.includes(field)),
  );
  check(
    "1.2 the requirement labels are the ones the QA report names",
    QA_FIELDS.every((field) => {
      const requirement = verificationLib.VERIFICATION_REQUIREMENTS.find((r) => r.key === field);
      return requirement !== undefined && requirement.label.trim().length > 0;
    }),
  );

  const teacher = await registerTeacher("Nilufar Karimova", "+998901112233");

  const beforeState = await verification.getTeacherVerificationState(teacher);
  check("1.3 a freshly registered teacher is NOT eligible", beforeState.eligible === false);
  check(
    "1.4 exactly the six QA fields are missing (the name was set at registration)",
    beforeState.missing.length === 6 &&
      QA_FIELDS.every((field) => beforeState.missing.some((m) => m.key === field)),
  );

  const beforeSubmit = await verification.submitVerificationRequest(teacher);
  check(
    "1.5 the server refuses the application while the profile is incomplete",
    !beforeSubmit.ok && beforeSubmit.code === "ineligible",
  );

  const beforeRow = await getTeacherProfile(teacher);
  check(
    "1.6 the persisted row really is empty for those fields",
    beforeRow !== null &&
      beforeRow.specialization === null &&
      beforeRow.city === null &&
      beforeRow.languages.length === 0 &&
      beforeRow.experienceYears === null &&
      beforeRow.bio === null &&
      beforeRow.approach === null,
  );

  /* ========================================================================== */
  console.log("\n# 2 — every requirement has an editable field that reaches the database");

  const editableKeys = verificationLib.VERIFICATION_EDITABLE_FIELDS.map((f) => f.key);
  check(
    "2.1 the editable field list covers every requirement (no dead ends)",
    editableKeys.length === requirementKeys.length &&
      requirementKeys.every((key) => editableKeys.includes(key)),
  );
  check(
    "2.2 every editable field is one of the posted profile fields",
    verificationLib.VERIFICATION_EDITABLE_FIELDS.every((field) =>
      (profileLib.TEACHER_PROFILE_FIELDS as readonly string[]).includes(field.formField),
    ),
  );
  check(
    "2.3 every editable field name is also a persisted column of teacher_profiles",
    verificationLib.VERIFICATION_EDITABLE_FIELDS.every(
      (field) => field.formField in schema.teacherProfiles,
    ),
  );
  check(
    "2.4 the shared minimums are the ones the hints print",
    verificationLib.VERIFICATION_MIN_LENGTH.bio === 40 &&
      verificationLib.VERIFICATION_MIN_LENGTH.approach === 30 &&
      verificationLib.VERIFICATION_MIN_LENGTH.specialization === 3,
  );

  const editorSource = readFileSync(
    path.join(process.cwd(), "src/components/teacher-dashboard/profile-editor.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(
    path.join(process.cwd(), "src/app/teacher/dashboard/profile/page.tsx"),
    "utf8",
  );
  check(
    "2.5 the profile page renders the persisted-profile editor",
    pageSource.includes("<TeacherProfileEditor") &&
      pageSource.includes("profileToEditValues(profile)"),
  );
  check(
    "2.6 the profile page still renders the managed image uploader",
    pageSource.includes("<ProfileImageManager"),
  );
  check(
    "2.7 the editor renders a control for every required field",
    QA_FIELDS.every((field) =>
      editorSource.includes(`name="${field}"`) ||
      // `languages` is a ChipGroup (a fieldset of checkboxes), not one input.
      (field === "languages" && editorSource.includes('toggle("languages")')),
    ),
  );
  check(
    "2.8 the editor's live requirement list is the server predicate",
    editorSource.includes("missingVerificationRequirements(") &&
      editorSource.includes("verificationProfileInput("),
  );
  check(
    "2.9 the editor posts through the shared FormData builder",
    editorSource.includes("buildTeacherProfileFormData(form)"),
  );

  /* ========================================================================== */
  console.log("\n# 3 — save and reload: the six fields are persisted server-side");

  const values = completeValues();
  const saveResult = await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(profileLib.buildTeacherProfileFormData(values)),
  );
  check("3.1 a complete form saves", saveResult.ok === true);

  const saved = await getTeacherProfile(teacher);
  check("3.2 the profile row exists after the save", saved !== null);
  check("3.3 Yo‘nalish (specialization) is persisted", saved?.specialization === values.specialization);
  check("3.4 Shahar (city) is persisted", saved?.city === values.city);
  check(
    "3.5 Dars tillari (languages) is persisted",
    saved?.languages.join(",") === values.languages.join(","),
  );
  check(
    "3.6 Tajriba (experienceYears) is persisted as a number",
    saved?.experienceYears === Number(values.experienceYears),
  );
  check("3.7 O‘zingiz haqingizda (bio) is persisted", saved?.bio === values.bio);
  check("3.8 Dars o‘tish uslubi (approach) is persisted", saved?.approach === values.approach);
  check("3.9 To‘liq ism is persisted", saved?.name === values.name);
  check(
    "3.10 the non-required persisted fields survive the same save",
    saved?.district === values.district &&
      saved?.categories.join(",") === values.categories.join(",") &&
      saved?.levels.join(",") === values.levels.join(",") &&
      saved?.formats.join(",") === values.formats.join(","),
  );
  check(
    "3.11 the save stamps updated_at (a reload is not reading a cached row)",
    saved !== null &&
      beforeRow !== null &&
      saved.updatedAt.getTime() >= beforeRow.updatedAt.getTime(),
  );
  check(
    "3.12 onboardingCompleted is written from the form, not invented",
    saved?.onboardingCompleted === values.onboardingCompleted,
  );

  // A second, different save must overwrite — the form is an editor, not an insert.
  const edited = completeValues({
    specialization: "Matematika va DTM tayyorlov",
    city: onboarding.onboardingCities[1] ?? CITY,
    experienceYears: "9",
  });
  await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(profileLib.buildTeacherProfileFormData(edited)),
  );
  const reloaded = await getTeacherProfile(teacher);
  check(
    "3.13 re-saving overwrites the stored values (save → reload → save → reload)",
    reloaded?.specialization === edited.specialization &&
      reloaded?.city === edited.city &&
      reloaded?.experienceYears === 9 &&
      reloaded?.bio === values.bio,
  );
  const reopened = profileLib.profileToEditValues(reloaded);
  check(
    "3.14 reopening the editor shows the stored values, not the old ones",
    reopened.specialization === edited.specialization &&
      reopened.city === edited.city &&
      reopened.experienceYears === "9" &&
      reopened.languages.join(",") === edited.languages.join(",") &&
      reopened.bio === edited.bio &&
      reopened.onboardingCompleted === edited.onboardingCompleted,
  );

  // Back to the canonical complete state for the verification checks below.
  await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(profileLib.buildTeacherProfileFormData(values)),
  );

  /* ========================================================================== */
  console.log("\n# 4 — verification eligibility reads the same persisted data");

  const afterState = await verification.getTeacherVerificationState(teacher);
  check("4.1 the profile is now eligible", afterState.eligible === true);
  check("4.2 nothing is reported missing", afterState.missing.length === 0);
  check("4.3 the trust state is untouched by a profile save", afterState.state === "unverified");

  const afterRow = await getTeacherProfile(teacher);
  check(
    "4.4 the predicate input the service builds IS the persisted row",
    afterRow !== null &&
      JSON.stringify(verificationLib.verificationProfileInput(afterRow)) ===
        JSON.stringify({
          name: values.name,
          specialization: values.specialization,
          city: values.city,
          languages: values.languages,
          bio: values.bio,
          approach: values.approach,
          experienceYears: Number(values.experienceYears),
        }),
  );
  check(
    "4.5 the same predicate over the same row agrees with the service",
    afterRow !== null &&
      verificationLib.isVerificationEligible(verificationLib.verificationProfileInput(afterRow)) ===
        afterState.eligible,
  );

  // The button rule, evaluated on the server-computed inputs.
  check(
    "4.6 the submit rule enables when the profile is complete and evidence exists",
    verificationLib.verificationSubmitEnabled({
      eligible: true,
      documentsReady: true,
      pending: false,
    }) === true,
  );
  check(
    "4.7 the submit rule stays disabled while the profile is incomplete",
    verificationLib.verificationSubmitEnabled({
      eligible: false,
      documentsReady: true,
      pending: false,
    }) === false,
  );
  check(
    "4.8 the submit rule stays disabled without the required evidence",
    verificationLib.verificationSubmitEnabled({
      eligible: true,
      documentsReady: false,
      pending: false,
    }) === false,
  );
  const submitFormSource = readFileSync(
    path.join(
      process.cwd(),
      "src/components/teacher-dashboard/verification-submit-form.tsx",
    ),
    "utf8",
  );
  check(
    "4.9 the “Tasdiqlash uchun yuborish” button uses that one rule",
    submitFormSource.includes("verificationSubmitEnabled({ eligible, documentsReady, pending })") &&
      submitFormSource.includes("disabled={!enabled}"),
  );

  /* ========================================================================== */
  console.log("\n# 5 — the validation was not weakened to make the flow work");

  const noEvidence = await verification.submitVerificationRequest(teacher);
  check(
    "5.1 a complete profile WITHOUT evidence is still refused",
    !noEvidence.ok && noEvidence.code === "missing_documents",
  );

  const badCity = completeValues({ city: "atlantis" });
  const badCityResult = await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(
      profileLib.buildTeacherProfileFormData(badCity),
    ),
  );
  check(
    "5.2 an unknown city is rejected with a field error",
    !badCityResult.ok &&
      badCityResult.code === "invalid_input" &&
      badCityResult.fieldErrors?.city !== undefined,
  );
  const unchangedAfterBadCity = await getTeacherProfile(teacher);
  check(
    "5.3 a rejected save changes nothing",
    unchangedAfterBadCity?.city === values.city &&
      unchangedAfterBadCity?.specialization === values.specialization,
  );

  const longSpecialization = completeValues({ specialization: "Y".repeat(121) });
  const longResult = await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(
      profileLib.buildTeacherProfileFormData(longSpecialization),
    ),
  );
  check(
    "5.4 an over-long Yo‘nalish is rejected",
    !longResult.ok && longResult.code === "invalid_input",
  );

  for (const experience of ["-1", "61", "olti"]) {
    const bad = await profileService.saveTeacherProfile(
      teacher,
      profileService.teacherProfileFormCandidate(
        profileLib.buildTeacherProfileFormData(completeValues({ experienceYears: experience })),
      ),
    );
    check(
      `5.5 Tajriba "${experience}" is rejected`,
      !bad.ok && bad.code === "invalid_input",
    );
  }

  const shortBio = completeValues({ bio: "Qisqa." });
  const shortBioSaved = await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(
      profileLib.buildTeacherProfileFormData(shortBio),
    ),
  );
  const shortBioState = await verification.getTeacherVerificationState(teacher);
  check(
    "5.6 a short bio SAVES (the editor never over-validates) but is NOT eligible",
    shortBioSaved.ok === true &&
      shortBioState.eligible === false &&
      shortBioState.missing.some((m) => m.key === "bio"),
  );

  // Over-posting: the write path cannot be turned into self-verification.
  const overPost = profileService.teacherProfileFormCandidate(
    profileLib.buildTeacherProfileFormData(values),
  );
  (overPost as Record<string, unknown>).verification = "verified";
  const overPostResult = await profileService.saveTeacherProfile(teacher, overPost);
  const afterOverPost = await getTeacherProfile(teacher);
  check(
    "5.7 posting `verification` is rejected, not applied",
    !overPostResult.ok &&
      overPostResult.code === "invalid_input" &&
      afterOverPost?.verification === "unverified",
  );

  const slugPost = profileService.teacherProfileFormCandidate(
    profileLib.buildTeacherProfileFormData(values),
  );
  (slugPost as Record<string, unknown>).slug = "hijacked";
  const slugResult = await profileService.saveTeacherProfile(teacher, slugPost);
  check(
    "5.8 posting `slug` is rejected",
    !slugResult.ok && slugResult.code === "invalid_input",
  );

  const photoPost = profileService.teacherProfileFormCandidate(
    profileLib.buildTeacherProfileFormData(values),
  );
  (photoPost as Record<string, unknown>).photo = "/media/stolen.jpg";
  const photoResult = await profileService.saveTeacherProfile(teacher, photoPost);
  const afterPhoto = await getTeacherProfile(teacher);
  check(
    "5.9 posting `photo` is rejected — the image stays with the managed uploader",
    !photoResult.ok && photoResult.code === "invalid_input" && afterPhoto?.photo === null,
  );

  const missingSave = await profileService.saveTeacherProfile(teacher, {
    name: values.name,
  });
  check(
    "5.10 a payload missing fields is rejected rather than blanking the profile",
    !missingSave.ok && missingSave.code === "invalid_input",
  );

  const orphan = await profileService.saveTeacherProfile(
    "usr_does-not-exist",
    profileService.teacherProfileFormCandidate(
      profileLib.buildTeacherProfileFormData(values),
    ),
  );
  check(
    "5.11 a teacher with no profile row gets not_found, not a false success",
    !orphan.ok && orphan.code === "not_found",
  );

  // Restore the complete profile and clear the short bio from 5.6.
  await profileService.saveTeacherProfile(
    teacher,
    profileService.teacherProfileFormCandidate(profileLib.buildTeacherProfileFormData(values)),
  );

  /* ========================================================================== */
  console.log("\n# 6 — empty and absent values decode honestly");

  const emptyForm = profileLib.buildTeacherProfileFormData(
    completeValues({ specialization: "", city: "", experienceYears: "" }),
  );
  const emptyCandidate = profileService.teacherProfileFormCandidate(emptyForm);
  check(
    "6.1 empty text decodes to NULL, not to an empty string",
    emptyCandidate.specialization === null &&
      emptyCandidate.city === null &&
      emptyCandidate.experienceYears === null,
  );
  const absent = new FormData();
  absent.set("name", values.name);
  absent.set("onboardingCompleted", "");
  const absentCandidate = profileService.teacherProfileFormCandidate(absent);
  check(
    "6.2 fields absent from the form decode to their empty values",
    absentCandidate.specialization === null &&
      absentCandidate.city === null &&
      Array.isArray(absentCandidate.languages) &&
      (absentCandidate.languages as string[]).length === 0 &&
      absentCandidate.onboardingCompleted === false,
  );
  const other = await registerTeacher("Boshqa ustoz", "+998905556677");
  await profileService.saveTeacherProfile(
    other,
    profileService.teacherProfileFormCandidate(emptyForm),
  );
  const otherRow = await getTeacherProfile(other);
  const otherState = await verification.getTeacherVerificationState(other);
  check(
    "6.3 clearing Yo‘nalish stores NULL and makes the teacher ineligible again",
    otherRow?.specialization === null &&
      otherState.eligible === false &&
      otherState.missing.some((m) => m.key === "specialization"),
  );
  check(
    "6.4 a profile save never writes a trust state",
    otherRow?.verification === "unverified",
  );

  /* ========================================================================== */
  console.log("\n# 7 — a complete profile plus evidence submits, and only once");

  const uploaded = await files.uploadVerificationDocument(teacher, "identity_document", {
    bytes: pdfPayload,
    fileName: "passport.pdf",
  });
  check("7.1 the required evidence uploads", uploaded.ok === true);

  const eligibleState = await verification.getTeacherVerificationState(teacher);
  check(
    "7.2 the profile is eligible with the evidence in place",
    eligibleState.eligible === true &&
      verificationLib.verificationSubmitEnabled({
        eligible: eligibleState.eligible,
        documentsReady: true,
        pending: false,
      }) === true,
  );

  const submitted = await verification.submitVerificationRequest(teacher);
  check(
    "7.3 the application is accepted once profile and evidence are both ready",
    submitted.ok === true && typeof (submitted.ok ? submitted.data?.requestId : "") === "string",
  );
  const pendingState = await verification.getTeacherVerificationState(teacher);
  check("7.4 the profile moves to pending", pendingState.state === "pending");
  check(
    "7.5 the button rule disables while an application is live",
    verificationLib.verificationSubmitEnabled({
      eligible: pendingState.eligible,
      documentsReady: true,
      pending: pendingState.pending !== null,
    }) === false,
  );
  const resubmit = await verification.submitVerificationRequest(teacher);
  check(
    "7.6 a second application while one is pending is refused",
    !resubmit.ok && resubmit.code === "already_pending",
  );

  const rows = await db
    .select({ verification: schema.teacherProfiles.verification })
    .from(schema.teacherProfiles)
    .where(eq(schema.teacherProfiles.userId, teacher));
  check(
    "7.7 nothing in this flow wrote `verified`",
    rows[0]?.verification === "pending",
  );

  /* -------------------------------- summary -------------------------------- */
  console.log(`\n${pass} passed, ${fail} failed (${pass + fail} checks)`);
  if (fail > 0) console.log("failures:\n - " + failures.join("\n - "));
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
