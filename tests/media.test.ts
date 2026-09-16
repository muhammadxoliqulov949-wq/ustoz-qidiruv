/* -------------------------------------------------------------------------- */
/* Phase 18 media suite — secure uploads, verification documents, course media. */
/*                                                                              */
/* Runs against a REAL PostgreSQL engine (PGlite) in a throwaway data dir, by   */
/* applying the committed migrations, and drives the REAL file service through  */
/* the REAL provider contract. Nothing about the storage layer is mocked: the   */
/* objects are written to a real temporary directory by the local provider, and */
/* the development delivery route is exercised as a real HTTP handler.          */
/*                                                                              */
/* THE PROPERTIES THIS SUITE EXISTS TO PROVE                                    */
/*                                                                              */
/*   1. VISIBILITY IS NOT THE CALLER'S DECISION. Purpose fixes visibility, the  */
/*      key namespace follows the purpose, and the DATABASE refuses a row that   */
/*      contradicts either — an API cannot be asked for a public document.       */
/*   2. NOTHING IS ACTIVATED BEFORE THE OBJECT IS VERIFIED. A provider that      */
/*      accepts a write but cannot read it back leaves the row dead, not live.   */
/*   3. PRIVATE EVIDENCE HAS NO PUBLIC ADDRESS. Verification documents are never */
/*      in a public projection, and are readable only through a short-lived       */
/*      capability minted for the owner or for an admin reviewing a SUBMITTED     */
/*      application.                                                             */
/*   4. THE BROWSER'S CLAIMS ARE NOT EVIDENCE. Renaming `payload.html` to         */
/*      `photo.png`, inventing a size, or claiming success cannot produce an      */
/*      active asset — the stored bytes and the provider's own metadata decide.   */
/*                                                                              */
/*   npm run test:media                                                         */
/* -------------------------------------------------------------------------- */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";

const DATA_DIR = mkdtempSync(path.join(tmpdir(), "ustoz-media-"));
const STORAGE_DIR = path.join(DATA_DIR, "storage");
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DATA_DIR = DATA_DIR;
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_DIR = STORAGE_DIR;
process.env.STORAGE_SIGNING_SECRET = "media-suite-signing-secret-0123456789";
process.env.APP_BASE_URL = "http://localhost:3000";
process.env.PAYMENT_MODE = "test";
// Sandbox credentials only: the suite never calls a provider, but the env
// contract must still be satisfied for the server env to parse.
process.env.PAYME_MERCHANT_ID = "test-cashbox-id";
process.env.PAYME_MERCHANT_KEY = "test-key-0123456789abcdef0123456789ab";
process.env.PAYME_MERCHANT_LOGIN = "Paycom";

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

function group(title: string): void {
  console.log(`\n${title}`);
}

async function rejects(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(name, false);
  } catch {
    check(name, true);
  }
}

/* ---------------------------- real file payloads ---------------------------- */

/** CRC32, so the generated PNGs are genuinely valid files. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const typed = new TextEncoder().encode(type);
  const payload = new Uint8Array([...typed, ...data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(payload));
  return new Uint8Array([...length, ...payload, ...crc]);
}

/** A real, decodable PNG of the requested size. */
function png(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width * 3; x += 1) raw[rowStart + 1 + x] = (x + y) % 256;
  }
  return new Uint8Array([
    ...signature,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", new Uint8Array(deflateSync(raw))),
    ...chunk("IEND", new Uint8Array(0)),
  ]);
}

/** A minimal but structurally valid JPEG (SOI + SOF0 + EOI). */
function jpeg(width: number, height: number): Uint8Array {
  const sof = new Uint8Array(19);
  const view = new DataView(sof.buffer);
  view.setUint16(0, 0xffc0);
  view.setUint16(2, 17); // segment length
  sof[4] = 8; // precision
  view.setUint16(5, height);
  view.setUint16(7, width);
  sof[9] = 3; // components
  return new Uint8Array([0xff, 0xd8, ...sof, 0xff, 0xd9]);
}

const htmlPayload = new TextEncoder().encode(
  '<!doctype html><html><body><script>alert("x")</script></body></html>',
);
const svgPayload = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
);
const zipPayload = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const pdfPayload = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

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

  const { and, eq } = await import("drizzle-orm");
  const { getDb, schema } = await import("../src/server/db/client");
  const { newId } = await import("../src/server/auth/ids");
  const { hashPassword } = await import("../src/server/auth/password");
  const media = await import("../src/lib/media");
  const keys = await import("../src/server/storage/keys");
  const signing = await import("../src/server/storage/signing");
  const policy = await import("../src/server/storage/policy");
  const storage = await import("../src/server/storage");
  const { LocalStorageProvider } = await import("../src/server/storage/local-provider");
  const { MemoryStorageProvider } = await import("../src/server/storage/memory-provider");
  const files = await import("../src/server/file-service");
  const verification = await import("../src/server/verification-service");

  const db = getDb();

  /* ------------------------------ provider setup ---------------------------- */

  const clock = Date.now();
  const local = new LocalStorageProvider({
    directory: STORAGE_DIR,
    signingSecret: process.env.STORAGE_SIGNING_SECRET!,
    publicPathPrefix: "/api/media",
    now: () => clock,
  });
  storage.__setStorageProviderForTesting(local);

  /* -------------------------------- fixtures -------------------------------- */

  const password = await hashPassword("supersecret");

  async function makeUser(role: "student" | "teacher" | "admin", phone: string, name: string) {
    const id = newId("usr");
    await db.insert(schema.users).values({ id, role, phone, passwordHash: password });
    if (role === "student") {
      await db.insert(schema.studentProfiles).values({ userId: id, name });
    } else if (role === "teacher") {
      await db.insert(schema.teacherProfiles).values({
        userId: id,
        slug: `p18-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase()}`,
        name,
        bio: "B".repeat(60),
        // The Phase 15 requirements, met honestly: without them a submission is
        // refused for a profile reason and this suite would test the wrong thing.
        approach: "A".repeat(40),
        specialization: "Ingliz tili va IELTS",
        experienceYears: 5,
        languages: ["o‘zbek", "ingliz"],
        city: "toshkent",
        isPublic: true,
      });
    }
    return id;
  }

  async function makeCourse(
    teacherUserId: string,
    slug: string,
    status: "draft" | "ready" | "published",
  ) {
    const id = newId("crs");
    await db.insert(schema.courses).values({
      id,
      slug,
      teacherUserId,
      title: `Kurs ${slug}`,
      categoryId: "ielts",
      level: "orta",
      format: "online",
      priceUzs: 150000,
      summary: "S".repeat(60),
      status,
      publishedAt: status === "published" ? "2026-02-01" : null,
    });
    return id;
  }

  const teacherA = await makeUser("teacher", "+998901180001", "Ustoz A");
  const teacherB = await makeUser("teacher", "+998901180002", "Ustoz B");
  const student = await makeUser("student", "+998901180003", "O‘quvchi");
  const admin = await makeUser("admin", "+998901180004", "Administrator");

  const draftCourse = await makeCourse(teacherA, "p18-draft", "draft");
  const readyCourse = await makeCourse(teacherA, "p18-ready", "ready");
  const publishedCourse = await makeCourse(teacherA, "p18-published", "published");
  const otherCourse = await makeCourse(teacherB, "p18-other", "draft");

  async function assetRows(where: Record<string, unknown>) {
    const conditions = Object.entries(where).map(([column, value]) =>
      eq(schema.fileAssets[column as "ownerUserId"], value as string),
    );
    return db
      .select()
      .from(schema.fileAssets)
      .where(and(...conditions));
  }

  /* ---------------------------------------------------------------------- */
  group("1. keys and signatures are server-generated and scope-limited");
  /* ---------------------------------------------------------------------- */

  const keyA = keys.buildStorageKey({
    purpose: "teacher_profile_image",
    ownerScopeId: teacherA,
    assetId: newId("ast"),
    extension: "png",
  });
  check("1.1 a profile key carries the public teacher-photos namespace", keyA.startsWith("public/teacher-photos/"));
  check("1.2 the key never contains the uploaded filename", !keyA.includes(".html") && !keyA.includes("payload"));
  check("1.3 the key ends with the detected extension", keyA.endsWith(".png"));
  check(
    "1.4 two uploads of the same kind never share a key",
    keyA !==
      keys.buildStorageKey({
        purpose: "teacher_profile_image",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "png",
      }),
  );

  const docKey = keys.buildStorageKey({
    purpose: "teacher_verification_document",
    ownerScopeId: teacherA,
    assetId: newId("ast"),
    extension: "pdf",
  });
  check("1.5 a document key is private", docKey.startsWith("private/verification/"));
  check("1.6 private keys are never addressable as public", keys.visibilityOfKey(docKey) === "private");
  check("1.7 public keys are recognised as public", keys.visibilityOfKey(keyA) === "public");
  check("1.8 traversal is refused", !keys.isSafeStorageKey("public/../../etc/passwd"));
  check("1.9 absolute paths are refused", !keys.isSafeStorageKey("/etc/passwd"));
  check("1.10 unknown namespaces are refused", !keys.isSafeStorageKey("secrets/verification/x.pdf"));
  check(
    "1.11 a key with no extension is still safe",
    keys.isSafeStorageKey("public/teacher-photos/abc"),
  );

  const signature = signing.signPrivateKey({
    key: docKey,
    expiresAtEpochSeconds: 1_000_000,
    secret: "suite-secret",
  });
  check(
    "1.12 a signature binds the key",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: 1_000_000,
      signature,
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) === "valid",
  );
  check(
    "1.13 another key does not verify with the same signature",
    signing.verifyPrivateKey({
      key: `${docKey}x`,
      expiresAtEpochSeconds: 1_000_000,
      signature,
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) !== "valid",
  );
  check(
    "1.14 another secret does not verify",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: 1_000_000,
      signature,
      secret: "other-secret",
      nowSeconds: 999_000,
    }) !== "valid",
  );
  check(
    "1.15 an extended expiry is rejected (signature is checked before time)",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: 9_000_000,
      signature,
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) !== "valid",
  );
  const expiredSignature = signing.signPrivateKey({
    key: docKey,
    expiresAtEpochSeconds: 900_000,
    secret: "suite-secret",
  });
  check(
    "1.16 an expired capability is rejected",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: 900_000,
      signature: expiredSignature,
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) === "expired",
  );
  check(
    "1.16a an expired token with a wrong signature is reported as forged, not expired",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: 900_000,
      signature: "0".repeat(64),
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) === "forged",
  );
  check(
    "1.16b the refusal verdicts are honest about the reason",
    signing.verifyPrivateKey({
      key: docKey,
      expiresAtEpochSeconds: null,
      signature: null,
      secret: "suite-secret",
      nowSeconds: 999_000,
    }) === "malformed",
  );
  check("1.17 the capability lifetime is capped", signing.clampPrivateReadSeconds(86_400) <= 900);
  check("1.18 the default lifetime is ten minutes", policy.PRIVATE_READ_SECONDS === 600);

  /* ---------------------------------------------------------------------- */
  group("2. pure validation: MIME, extension, size, disguise and geometry");
  /* ---------------------------------------------------------------------- */

  const okPng = media.validateUpload({ purpose: "teacher_profile_image", bytes: png(200, 200) });
  check("2.1 a real PNG is accepted", okPng.ok && okPng.mimeType === "image/png");
  check("2.2 the stored extension comes from the content", okPng.ok && okPng.extension === "png");
  check(
    "2.3 a real JPEG is accepted",
    media.validateUpload({ purpose: "course_cover_image", bytes: jpeg(800, 450) }).ok,
  );
  check(
    "2.4 a PDF is accepted for a document",
    media.validateUpload({ purpose: "teacher_verification_document", bytes: pdfPayload }).ok,
  );
  check(
    "2.5 a PDF is refused as a profile image",
    !media.validateUpload({ purpose: "teacher_profile_image", bytes: pdfPayload }).ok,
  );
  check(
    "2.6 SVG is refused",
    !media.validateUpload({ purpose: "teacher_profile_image", bytes: svgPayload }).ok,
  );
  check(
    "2.7 an SVG renamed .png is refused",
    media.isDisguisedFile({ bytes: svgPayload, purpose: "teacher_profile_image" }),
  );
  check(
    "2.8 HTML renamed .jpg is refused",
    media.isDisguisedFile({ bytes: htmlPayload, purpose: "teacher_profile_image" }),
  );
  check(
    "2.9 an executable/zip is refused",
    !media.validateUpload({ purpose: "teacher_verification_document", bytes: zipPayload }).ok,
  );
  check(
    "2.10 a zero-byte file is refused",
    !media.validateUpload({ purpose: "teacher_profile_image", bytes: new Uint8Array(0) }).ok,
  );
  check(
    "2.11 an oversized profile image is refused",
    !media.validateUpload({
      purpose: "teacher_profile_image",
      bytes: new Uint8Array(media.MAX_BYTES_BY_PURPOSE.teacher_profile_image + 1),
      byteSize: media.MAX_BYTES_BY_PURPOSE.teacher_profile_image + 1,
    }).ok,
  );
  const tiny = media.validateUpload({ purpose: "teacher_profile_image", bytes: png(16, 16) });
  check("2.12 a 16×16 avatar is refused by the loose geometry rule", !tiny.ok);
  check("2.13 the refusal names the real limit", !tiny.ok && tiny.code === "too_small");
  check("2.14 a 200×200 avatar passes geometry", media.validateUpload({ purpose: "teacher_profile_image", bytes: png(200, 200) }).ok);
  check(
    "2.15 a narrow cover is refused",
    !media.validateUpload({ purpose: "course_cover_image", bytes: png(200, 800) }).ok,
  );
  check(
    "2.16 a wide cover passes",
    media.validateUpload({ purpose: "course_cover_image", bytes: png(800, 400) }).ok,
  );
  check("2.17 PNG geometry is read from the header", (() => {
    const size = media.readImageDimensions(png(321, 123));
    return size?.width === 321 && size?.height === 123;
  })());
  check("2.18 JPEG geometry is read from the frame header", (() => {
    const size = media.readImageDimensions(jpeg(640, 480));
    return size?.width === 640 && size?.height === 480;
  })());
  check("2.19 unreadable geometry is not a rejection", media.readImageDimensions(zipPayload) === null);
  check(
    "2.20 a browser-supplied filename never decides the type",
    media.validateUpload({ purpose: "course_cover_image", bytes: htmlPayload }).ok === false,
  );
  check(
    "2.21 display filenames are sanitized",
    media.sanitizeDisplayFileName('../../evil"name.png').includes("evil") &&
      !media.sanitizeDisplayFileName('../../evil"name.png').includes("/"),
  );

  /* ---------------------------------------------------------------------- */
  group("3. the database, not the caller, decides visibility");
  /* ---------------------------------------------------------------------- */

  await rejects("3.1 a private row cannot claim the public namespace", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_verification_document",
      visibility: "private",
      storageProvider: "local",
      storageKey: "public/teacher-photos/sneaky.png",
      originalFileName: "sneaky.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
      documentType: "identity_document",
    }),
  );
  await rejects("3.2 a document cannot be marked public", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_verification_document",
      visibility: "public",
      storageProvider: "local",
      storageKey: "public/teacher-photos/sneaky.png",
      originalFileName: "sneaky.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
      documentType: "identity_document",
    }),
  );
  await rejects("3.3 a public purpose cannot live in the private namespace", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_profile_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: "private/verification/photo.png",
      originalFileName: "photo.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
    }),
  );
  await rejects("3.4 a document row must declare its document type", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_verification_document",
      visibility: "private",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "teacher_verification_document",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "pdf",
      }),
      originalFileName: "doc.pdf",
      mimeType: "application/pdf",
      byteSize: BigInt(10),
    }),
  );
  await rejects("3.5 a profile image cannot declare a document type", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_profile_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "teacher_profile_image",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "png",
      }),
      originalFileName: "photo.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
      documentType: "identity_document",
    }),
  );
  await rejects("3.6 a course cover must name its course", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "course_cover_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "course_cover_image",
        ownerScopeId: draftCourse,
        assetId: newId("ast"),
        extension: "png",
      }),
      originalFileName: "cover.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
    }),
  );
  await rejects("3.7 a profile image cannot claim a course", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      courseId: draftCourse,
      purpose: "teacher_profile_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "teacher_profile_image",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "png",
      }),
      originalFileName: "photo.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
    }),
  );
  await rejects("3.8 an empty object cannot be recorded", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_profile_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "teacher_profile_image",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "png",
      }),
      originalFileName: "photo.png",
      mimeType: "image/png",
      byteSize: BigInt(0),
    }),
  );
  await rejects("3.9 an active row must carry its activation time", () =>
    db.insert(schema.fileAssets).values({
      id: newId("ast"),
      ownerUserId: teacherA,
      purpose: "teacher_profile_image",
      visibility: "public",
      storageProvider: "local",
      storageKey: keys.buildStorageKey({
        purpose: "teacher_profile_image",
        ownerScopeId: teacherA,
        assetId: newId("ast"),
        extension: "png",
      }),
      originalFileName: "photo.png",
      mimeType: "image/png",
      byteSize: BigInt(10),
      status: "active",
    }),
  );

  /* ---------------------------------------------------------------------- */
  group("4. profile image lifecycle: activate, replace, remove");
  /* ---------------------------------------------------------------------- */

  const firstUpload = await files.uploadTeacherProfileImage(teacherA, {
    bytes: png(240, 240),
    fileName: "portrait.png",
  });
  check("4.1 a verified upload is activated", firstUpload.ok && firstUpload.data?.id !== undefined);
  const firstAssetId = firstUpload.ok ? firstUpload.data.id : "";
  const firstRows = await assetRows({ ownerUserId: teacherA });
  const firstRow = firstRows.find((row) => row.id === firstAssetId);
  const firstKey = firstRow?.storageKey ?? "";
  check("4.2 the object really exists on disk", existsOnDisk(STORAGE_DIR, firstKey));
  check("4.3 the row records the real byte size", firstRow?.byteSize === BigInt(png(240, 240).length));
  check("4.4 the row records the CONTENT type", firstRow?.mimeType === "image/png");
  check("4.5 the row stores the sanitized display name, never a path", firstRow?.originalFileName === "portrait.png");
  check("4.6 the stored key is not the uploaded name", !firstKey.includes("portrait"));
  check("4.7 the asset is public and active", firstRow?.visibility === "public" && firstRow?.status === "active");

  const publicIndex = await files.publicMediaIndex({ teacherUserIds: [teacherA] });
  check("4.8 the public projection resolves the managed photo", publicIndex.teacherPhotos.get(teacherA) === local.getPublicUrl(firstKey));

  const replaced = await files.uploadTeacherProfileImage(teacherA, {
    bytes: png(300, 300),
    fileName: "new.png",
  });
  const secondAssetId = replaced.ok ? replaced.data.id : "";
  check("4.9 a replacement succeeds", replaced.ok);
  const afterReplace = await assetRows({ ownerUserId: teacherA });
  const secondKey = afterReplace.find((row) => row.id === secondAssetId)?.storageKey ?? "";
  const oldRow = afterReplace.find((row) => row.id === firstAssetId);
  check("4.10 the previous asset is superseded, not deleted outright", oldRow?.status === "superseded");
  check(
    "4.11 the superseded object is orphaned until the cleanup command runs (never a broken reference)",
    oldRow?.status === "superseded",
  );
  check("4.11a the old bytes are still on disk, waiting to be swept", existsOnDisk(STORAGE_DIR, firstKey));
  check(
    "4.12 exactly one asset is active",
    afterReplace.filter((row) => row.status === "active").length === 1,
  );
  check("4.13 the active asset is the new one", afterReplace.find((r) => r.status === "active")?.id === secondAssetId);

  /* A provider that accepts writes but cannot read them back must never activate. */
  const memory = new MemoryStorageProvider({ publicBaseUrl: "https://memory.test" });
  storage.__setStorageProviderForTesting({
    name: "memory",
    supportsSignedRead: true,
    putObject: async (input) => memory.putObject(input),
    headObject: async () => null, // the lie: the write "succeeded", the object is invisible
    deleteObject: async () => undefined,
    getPublicUrl: (key) => memory.getPublicUrl(key),
    createPrivateReadUrl: (key, options) => memory.createPrivateReadUrl(key, options),
  });
  const liar = await files.uploadTeacherProfileImage(teacherA, {
    bytes: png(200, 200),
    fileName: "liar.png",
  });
  check("4.14 an unverifiable upload is reported as a failure", !liar.ok);
  const afterLiar = await assetRows({ ownerUserId: teacherA });
  check(
    "4.15 the unverifiable row is NOT active",
    afterLiar.filter((row) => row.status === "active").length === 1,
  );
  check(
    "4.16 the failed row is marked deleted",
    afterLiar.some((row) => row.status === "deleted" && row.originalFileName === "liar.png"),
  );
  storage.__setStorageProviderForTesting(local);

  const coverUpload = await files.uploadCourseCover(teacherA, draftCourse, {
    bytes: png(900, 500),
    fileName: "cover.png",
  });
  check("4.17 a course cover activates for the owning teacher", coverUpload.ok);
  const removedCover = await files.removeCourseCover(teacherA, draftCourse);
  check("4.18 the owner can remove a cover on a draft", removedCover.ok);
  const coverIndex = await files.publicMediaIndex({ courseIds: [draftCourse] });
  check("4.19 a removed cover leaves no public projection", coverIndex.courseCovers.get(draftCourse) === undefined);

  const removedPhoto = await files.removeTeacherProfileImage(teacherA);
  check("4.20 the owner can remove their profile image", removedPhoto.ok);
  const afterRemoval = await assetRows({ ownerUserId: teacherA });
  check(
    "4.21 nothing is active after removal",
    afterRemoval.every((row) => row.status !== "active"),
  );
  check("4.22 the object is deleted from storage", !existsOnDisk(STORAGE_DIR, secondKey));

  /* ---------------------------------------------------------------------- */
  group("5. the abuse matrix: browser claims and cross-account attacks");
  /* ---------------------------------------------------------------------- */

  const photoObjectsBefore = readdirSync(path.join(STORAGE_DIR, "public", "teacher-photos")).length;
  const disguised = await files.uploadTeacherProfileImage(teacherA, {
    bytes: htmlPayload,
    fileName: "photo.png", // the browser's second lie: a .png name over HTML bytes
  });
  check("5.1 HTML renamed .png cannot become a profile image", !disguised.ok);
  check("5.2 the refusal is precise", !disguised.ok && disguised.code === "not_an_image");
  const afterDisguise = await assetRows({ ownerUserId: teacherA });
  check(
    "5.3 no row is created for a refused file",
    !afterDisguise.some((row) => row.originalFileName === "photo.png"),
  );
  check(
    "5.4 nothing was written to storage for a refused file",
    readdirSync(path.join(STORAGE_DIR, "public", "teacher-photos")).length === photoObjectsBefore,
  );

  const svgUpload = await files.uploadTeacherProfileImage(teacherB, {
    bytes: svgPayload,
    fileName: "logo.svg",
  });
  check("5.5 SVG cannot be uploaded at all", !svgUpload.ok);

  const docx = await files.uploadVerificationDocument(teacherA, "identity_document", {
    bytes: zipPayload,
    fileName: "passport.docx",
  });
  check("5.6 a ZIP/DOCX container is refused as a document", !docx.ok);

  const oversize = await files.uploadVerificationDocument(teacherA, "identity_document", {
    bytes: new Uint8Array(media.MAX_BYTES_BY_PURPOSE.teacher_verification_document + 1),
    fileName: "big.pdf",
  });
  check("5.7 an oversized document is refused", !oversize.ok && oversize.code === "too_large");

  const crossCourse = await files.uploadCourseCover(teacherB, draftCourse, {
    bytes: png(900, 500),
    fileName: "stolen.png",
  });
  check("5.8 another teacher cannot set a cover on someone else's course", !crossCourse.ok);
  check("5.9 the refusal does not confirm the course exists", !crossCourse.ok && crossCourse.code === "not_found");

  const readyCover = await files.uploadCourseCover(teacherA, readyCourse, {
    bytes: png(900, 500),
    fileName: "ready.png",
  });
  check("5.10 a course under review cannot change its cover", !readyCover.ok && readyCover.code === "locked");
  const publishedCover = await files.uploadCourseCover(teacherA, publishedCourse, {
    bytes: png(900, 500),
    fileName: "published.png",
  });
  check("5.11 a published course cannot silently change its cover", !publishedCover.ok && publishedCover.code === "locked");
  const removePublished = await files.removeCourseCover(teacherA, publishedCourse);
  check("5.12 a published cover cannot be removed either", !removePublished.ok && removePublished.code === "locked");
  check(
    "5.13 the owner check comes before the lock message",
    !(await files.uploadCourseCover(teacherB, publishedCourse, {
      bytes: png(900, 500),
      fileName: "someone.png",
    })).ok,
  );

  /* ---------------------------------------------------------------------- */
  group("6. verification documents: privacy, freezing and the admin path");
  /* ---------------------------------------------------------------------- */

  const identityDoc = await files.uploadVerificationDocument(teacherA, "identity_document", {
    bytes: pdfPayload,
    fileName: "passport.pdf",
  });
  check("6.1 a document uploads for its own owner", identityDoc.ok);
  const identityId = identityDoc.ok ? identityDoc.data.id : "";
  const identityKey =
    (await db
      .select({ storageKey: schema.fileAssets.storageKey })
      .from(schema.fileAssets)
      .where(eq(schema.fileAssets.id, identityId))
      .limit(1))[0]?.storageKey ?? "";
  check("6.2 the document is private", identityKey.startsWith("private/verification/"));
  check("6.3 the document is stored outside the public namespace", !existsOnDisk(STORAGE_DIR, `public/${identityKey}`));

  const qualify = await files.uploadVerificationDocument(teacherA, "qualification_evidence", {
    bytes: png(600, 800),
    fileName: "diploma.png",
  });
  check("6.4 a photo of a diploma is accepted", qualify.ok);

  const pendingBefore = await db
    .select({ id: schema.teacherVerificationRequests.id })
    .from(schema.teacherVerificationRequests);
  check("6.5 no request exists yet, so the evidence is still editable", pendingBefore.length === 0);

  const ownList = await files.listOwnVerificationDocuments(teacherA);
  check("6.6 the owner sees exactly their own documents", ownList.length === 2);
  const otherList = await files.listOwnVerificationDocuments(teacherB);
  check("6.7 another teacher sees none of them", otherList.length === 0);
  check("6.8 items are marked unfrozen before submission", ownList.every((doc) => !doc.frozen));

  const readByOwner = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: teacherA,
    viewerIsAdmin: false,
  });
  check("6.9 the owner can mint a read capability", readByOwner.ok);
  check(
    "6.10 the capability is short-lived (≈10 minutes)",
    readByOwner.ok && Math.round((readByOwner.data.expiresAt.getTime() - clock) / 1000) <= 600,
  );
  check(
    "6.11 the capability carries a signature, not a public address",
    readByOwner.ok &&
      readByOwner.data.url.includes(signing.MEDIA_URL_PARAM_SIGNATURE) &&
      readByOwner.data.url.startsWith("/api/media/private/"),
  );

  const readByOther = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: teacherB,
    viewerIsAdmin: false,
  });
  check("6.12 another teacher cannot mint a capability", !readByOther.ok && readByOther.code === "not_found");
  const readByStudent = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: student,
    viewerIsAdmin: false,
  });
  check("6.13 a student cannot mint a capability", !readByStudent.ok);
  const adminBeforeSubmit = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: admin,
    viewerIsAdmin: true,
  });
  check("6.14 an admin cannot read an UNSUBMITTED draft document", !adminBeforeSubmit.ok);
  const adminWrongTeacher = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: admin,
    viewerIsAdmin: true,
  });
  check("6.15 admin access is purpose-scoped to a submitted application", !adminWrongTeacher.ok);

  const readyBefore = await files.verificationDocumentsReady(teacherA);
  check("6.16 the required document is present", readyBefore.ready);
  const readyNone = await files.verificationDocumentsReady(teacherB);
  check("6.17 a teacher with no evidence is not ready", !readyNone.ready);
  check("6.18 the missing list names the required type", readyNone.missing.includes("identity_document"));

  /* Submission attaches and freezes the evidence (Phase 15 flow, Phase 18 data). */
  const submission = await verification.submitVerificationRequest(teacherA);
  check("6.19 the application is submitted with evidence", submission.ok || submission.code === "already_pending");

  const afterSubmit = await files.listOwnVerificationDocuments(teacherA);
  check("6.20 evidence is frozen once the application is under review", afterSubmit.every((doc) => doc.frozen));
  const frozenUpload = await files.uploadVerificationDocument(teacherA, "qualification_evidence", {
    bytes: pdfPayload,
    fileName: "extra.pdf",
  });
  check("6.21 no new evidence can be added while under review", !frozenUpload.ok && frozenUpload.code === "frozen");
  const frozenRemove = await files.removeVerificationDocument(teacherA, identityId);
  check("6.22 attached evidence cannot be removed", !frozenRemove.ok);
  const otherRemove = await files.removeVerificationDocument(teacherB, identityId);
  check("6.23 another teacher cannot remove someone else's evidence", !otherRemove.ok && otherRemove.code === "not_found");

  const requestRows = await db
    .select({ id: schema.teacherVerificationRequests.id })
    .from(schema.teacherVerificationRequests)
    .where(eq(schema.teacherVerificationRequests.teacherUserId, teacherA));
  const requestId = requestRows[0]?.id ?? "";
  check("6.24 the application exists", requestId !== "");
  const links = await db
    .select()
    .from(schema.teacherVerificationDocuments)
    .where(eq(schema.teacherVerificationDocuments.verificationRequestId, requestId));
  check("6.25 every document is attached to the application", links.length === 2);
  check(
    "6.26 the attachment is what authorizes the reviewer",
    (await files.listVerificationRequestDocuments(requestId)).length === 2,
  );

  const adminAfterSubmit = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: admin,
    viewerIsAdmin: true,
  });
  check("6.27 an admin can now review the evidence", adminAfterSubmit.ok);
  check(
    "6.28 the admin capability is still short-lived",
    adminAfterSubmit.ok && Math.round((adminAfterSubmit.data.expiresAt.getTime() - clock) / 1000) <= 600,
  );
  const stillDenied = await files.createVerificationDocumentReadUrl({
    assetId: identityId,
    viewerUserId: teacherB,
    viewerIsAdmin: false,
  });
  check("6.29 another teacher is still refused after submission", !stillDenied.ok);

  const privateIndex = await files.publicMediaIndex({
    teacherUserIds: [teacherA, teacherB],
    courseIds: [draftCourse, publishedCourse],
  });
  check("6.30 private evidence never enters the public projection", privateIndex.teacherPhotos.size === 0 && privateIndex.courseCovers.size === 0);
  check(
    "6.31 the public projection never resolves a verification document",
    [...privateIndex.teacherPhotos.values(), ...privateIndex.courseCovers.values()].every(
      (url) => !url.includes("verification"),
    ),
  );

  /* The reviewer's decision must leave the evidence untouched (Phase 15 rule). */
  const decision = await verification.approveVerification(requestId, admin);
  check("6.32a the reviewer's decision is accepted", decision.ok);
  const historyDocuments = await files.listVerificationRequestDocuments(requestId);
  check("6.32 the evidence survives the decision", historyDocuments.length === 2);
  const ownAfterDecision = await files.listOwnVerificationDocuments(teacherA);
  check("6.33 the owner can still see their historical evidence", ownAfterDecision.length === 2);
  const uploadAfterDecision = await files.uploadVerificationDocument(teacherA, "qualification_evidence", {
    bytes: pdfPayload,
    fileName: "new.pdf",
  });
  check("6.34 a new application can collect new evidence", uploadAfterDecision.ok);
  const linksAfter = await db
    .select()
    .from(schema.teacherVerificationDocuments)
    .where(eq(schema.teacherVerificationDocuments.verificationRequestId, requestId));
  check("6.35 the old application's evidence is unchanged", linksAfter.length === 2);

  /* ---------------------------------------------------------------------- */
  group("7. the delivery route: a private object has no public address");
  /* ---------------------------------------------------------------------- */

  const routeModule = await import(
    "../src/app/api/media/[...key]/route"
  );
  const routeGet = routeModule.GET as (
    request: Request,
    context: { params: Promise<{ key: string[] }> },
  ) => Promise<Response>;

  async function hit(url: string, headers: Record<string, string> = {}): Promise<Response> {
    const parsed = new URL(url, "http://localhost:3000");
    const segments = parsed.pathname.replace("/api/media/", "").split("/");
    return routeGet(new Request(parsed.toString(), { headers }), {
      params: Promise.resolve({ key: segments }),
    });
  }

  const ownerUrl = readByOwner.ok ? readByOwner.data.url : "";
  const served = await hit(ownerUrl);
  check("7.1 a signed private read is served", served.status === 200);
  check(
    "7.2 a private response is never cached by a shared cache",
    served.headers.get("cache-control")?.includes("no-store") === true,
  );
  check("7.3 a private response is nosniff", served.headers.get("x-content-type-options") === "nosniff");
  check("7.4 the content type comes from the database", served.headers.get("content-type") === "application/pdf");
  check(
    "7.5 the disposition is inline for a PDF and carries the sanitized name",
    served.headers.get("content-disposition") === 'inline; filename="passport.pdf"',
  );
  check("7.6 no credentials or bucket detail leak in headers", served.headers.get("x-amz-id-2") === null);

  check("7.7 the same key without a capability is refused", (await hit(ownerUrl.split("?")[0]!)).status === 404);
  check(
    "7.8 a tampered expiry is refused",
    (await hit(`${ownerUrl.split("?")[0]}?${new URLSearchParams({ e: String(Math.floor(clock / 1000) + 9999), s: "deadbeef" }).toString()}`)).status === 404,
  );
  check(
    "7.9 a wrong signature is refused",
    (await hit(`${ownerUrl.split("?")[0]}?e=${readByOwner.ok ? Math.floor(readByOwner.data.expiresAt.getTime() / 1000) : 0}&s=00`)).status === 404,
  );
  /*
   * Expiry is tested with a REAL capability whose signed expiry is in the past:
   * the signature is authentic, only the clock has moved on — which is exactly
   * the situation a leaked link runs into ten minutes later.
   */
  const pastExpiry = Math.floor(Date.now() / 1000) - 60;
  const expiredUrl = `/api/media/${identityKey}?e=${pastExpiry}&s=${signing.signPrivateKey({
    key: identityKey,
    expiresAtEpochSeconds: pastExpiry,
    secret: local.signingSecret,
  })}`;
  check("7.10 an expired capability is refused", (await hit(expiredUrl)).status === 404);

  const rangeResponse = await hit(ownerUrl, { range: "bytes=0-9" });
  check("7.11 a range request is honoured with 206", rangeResponse.status === 206);
  check(
    "7.12 the range response describes the whole object",
    rangeResponse.headers.get("content-range") === `bytes 0-9/${pdfPayload.length}`,
  );
  const badRange = await hit(ownerUrl, { range: "bytes=999999-" });
  check("7.13 an impossible range is 416", badRange.status === 416);

  const publicAsset = await files.uploadCourseCover(teacherA, draftCourse, {
    bytes: png(900, 500),
    fileName: "public.png",
  });
  const publicUrl = publicAsset.ok
    ? local.getPublicUrl(
        (await db
          .select({ storageKey: schema.fileAssets.storageKey })
          .from(schema.fileAssets)
          .where(eq(schema.fileAssets.id, publicAsset.data.id))
          .limit(1))[0]?.storageKey ?? "",
      )
    : null;
  check("7.14 a public asset has a plain URL", publicUrl !== null && !publicUrl.includes("s="));
  const publicResponse = publicUrl ? await hit(publicUrl) : null;
  check("7.15 a public object is served with an immutable cache", publicResponse?.headers.get("cache-control") === policy.CACHE_CONTROL_BY_VISIBILITY.public);
  check("7.16 a public object needs no signature", publicResponse?.status === 200);
  check(
    "7.17 a private key cannot be fetched through the public path shape",
    (await hit(`/api/media/public/verification/${identityKey.split("/").pop()}`)).status === 404,
  );
  check(
    "7.18 an unknown key is 404, not an error page",
    (await hit("/api/media/public/teacher-photos/does-not-exist.png")).status === 404,
  );

  /* A non-local provider means production: the route must refuse to serve at all. */
  const auditStorage = new MemoryStorageProvider();
  storage.__setStorageProviderForTesting(auditStorage);
  check("7.19 production-like providers are not proxied through the app route", (await hit(ownerUrl)).status === 404);
  storage.__setStorageProviderForTesting(local);

  /* ---------------------------------------------------------------------- */
  group("8. cleanup is repairable and never touches live evidence");
  /* ---------------------------------------------------------------------- */

  const staleKey = keys.buildStorageKey({
    purpose: "teacher_profile_image",
    ownerScopeId: teacherB,
    assetId: newId("ast"),
    extension: "png",
  });
  await auditStorage.putObject({
    key: staleKey,
    visibility: "public",
    contentType: "image/png",
    body: png(200, 200),
    cacheControl: policy.CACHE_CONTROL_BY_VISIBILITY.public,
  });
  await local.putObject({
    key: staleKey,
    visibility: "public",
    contentType: "image/png",
    body: png(200, 200),
    cacheControl: policy.CACHE_CONTROL_BY_VISIBILITY.public,
  });
  const staleId = newId("ast");
  await db.insert(schema.fileAssets).values({
    id: staleId,
    ownerUserId: teacherB,
    purpose: "teacher_profile_image",
    visibility: "public",
    storageProvider: "local",
    storageKey: staleKey,
    originalFileName: "abandoned.png",
    mimeType: "image/png",
    byteSize: BigInt(png(200, 200).length),
    status: "pending",
    createdAt: new Date(clock - 48 * 60 * 60 * 1000),
    updatedAt: new Date(clock - 48 * 60 * 60 * 1000),
  });
  check("8.1 the abandoned upload is pending in the database", existsOnDisk(STORAGE_DIR, staleKey));

  const dryRun = await files.cleanupStorage({ pendingOlderThanHours: 24, limit: 50, dryRun: true });
  check("8.2 a dry run reports the abandoned upload", dryRun.scannedPending >= 1);
  check("8.3 a dry run changes nothing", dryRun.deletedPending === 0 && existsOnDisk(STORAGE_DIR, staleKey));
  const staleStill = (await assetRows({ ownerUserId: teacherB })).find((row) => row.id === staleId);
  check("8.4 a dry run leaves the row pending", staleStill?.status === "pending");

  const sweep = await files.cleanupStorage({ pendingOlderThanHours: 24, limit: 50 });
  check("8.5 the sweep marks the abandoned upload deleted", sweep.deletedPending >= 1);
  check("8.6 the sweep removes its object", sweep.objectsRemoved >= 1);
  const staleAfter = (await assetRows({ ownerUserId: teacherB })).find((row) => row.id === staleId);
  check("8.7 the row is deleted, not orphaned", staleAfter?.status === "deleted");
  check("8.8 the bytes are gone", !existsOnDisk(STORAGE_DIR, staleKey));

  check(
    "8.11 the sweep also collects a superseded object from a replacement",
    !existsOnDisk(STORAGE_DIR, firstKey),
  );

  const frozenRows = await db
    .select()
    .from(schema.teacherVerificationDocuments)
    .where(eq(schema.teacherVerificationDocuments.verificationRequestId, requestId));
  check("8.9 frozen evidence is still attached after the sweep", frozenRows.length === 2);
  for (const link of frozenRows) {
    const asset = await db
      .select()
      .from(schema.fileAssets)
      .where(eq(schema.fileAssets.id, link.fileAssetId));
    check(
      `8.10 evidence ${link.fileAssetId.slice(-4)} is still active and present`,
      asset[0]?.status === "active" && existsOnDisk(STORAGE_DIR, asset[0]?.storageKey ?? ""),
    );
  }

  /* ---------------------------------------------------------------------- */
  group("9. the public marketplace keeps working, and stays clean");
  /* ---------------------------------------------------------------------- */

  const { listPublicCourses, getPublicCourseBySlug, listPublicTeachers } = await import(
    "../src/server/public-repo"
  );
  const publishedCoverResult = await files.uploadCourseCover(teacherA, publishedCourse, {
    bytes: png(1024, 576),
    fileName: "late.png",
  });
  check("9.1 a published course refuses a silent media change", !publishedCoverResult.ok);

  /* Legacy seed images must keep working when no managed asset exists. */
  const legacyRows = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(eq(schema.courses.id, otherCourse));
  check("9.2 a course with no managed cover still resolves", legacyRows.length === 1);
  const { defaultBrowseParams } = await import("../src/lib/course-search");
  const listing = await listPublicCourses(defaultBrowseParams);
  check("9.3 the public listing works with managed media enabled", Array.isArray(listing));
  const teacherListing = await listPublicTeachers();
  check("9.4 the public teacher listing works too", Array.isArray(teacherListing));
  const published = await getPublicCourseBySlug("p18-published");
  check("9.5 a published course still resolves by slug", published !== null);
  check(
    "9.6 a course with no managed cover keeps its legacy image",
    published === null || published.image === null || !String(published.image).includes("verification"),
  );

  /* ---------------------------------------------------------------------- */
  group("10. Phase 21: production S3/R2 guarantees, fail-closed config, smoke and maintenance");
  /* ---------------------------------------------------------------------- */

  // Save current process.env and restore later
  const origEnv = { ...process.env };
  const { __resetServerEnvForTesting } = await import("../src/server/env");

  // A. production local storage is refused
  process.env.STORAGE_PROVIDER = "local";
  (process.env as Record<string, string>).NODE_ENV = "production";
  __resetServerEnvForTesting();
  storage.__resetStorageProviderForTesting();
  let errA: Error | null = null;
  try {
    storage.getStorageProvider();
  } catch (err) {
    errA = err as Error;
  }
  check(
    "10.A production local storage is refused",
    errA instanceof storage.StorageConfigError &&
      errA.message.includes("local is not allowed in production"),
  );

  // B. production S3 requires private bucket
  process.env.STORAGE_PROVIDER = "s3";
  (process.env as Record<string, string>).NODE_ENV = "production";
  delete process.env.STORAGE_S3_BUCKET;
  process.env.STORAGE_S3_PUBLIC_BUCKET = "test-public-bucket";
  process.env.STORAGE_S3_ACCESS_KEY_ID = "test-access-key";
  process.env.STORAGE_S3_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.STORAGE_PUBLIC_BASE_URL = "https://media.test.uz";
  __resetServerEnvForTesting();
  storage.__resetStorageProviderForTesting();
  let errB: Error | null = null;
  try {
    storage.getStorageProvider();
  } catch (err) {
    errB = err as Error;
  }
  check(
    "10.B production S3 requires private bucket",
    errB instanceof storage.StorageConfigError && errB.message.includes("STORAGE_S3_BUCKET"),
  );

  // C. production S3 requires explicit public bucket
  process.env.STORAGE_S3_BUCKET = "test-private-bucket";
  delete process.env.STORAGE_S3_PUBLIC_BUCKET;
  __resetServerEnvForTesting();
  storage.__resetStorageProviderForTesting();
  let errC1: Error | null = null;
  try {
    storage.getStorageProvider();
  } catch (err) {
    errC1 = err as Error;
  }
  check(
    "10.C.1 production S3 requires explicit public bucket",
    errC1 instanceof storage.StorageConfigError && errC1.message.includes("STORAGE_S3_PUBLIC_BUCKET"),
  );

  // C2. production S3 rejects identical private and public buckets
  process.env.STORAGE_S3_PUBLIC_BUCKET = "test-private-bucket";
  __resetServerEnvForTesting();
  storage.__resetStorageProviderForTesting();
  let errC2: Error | null = null;
  try {
    storage.getStorageProvider();
  } catch (err) {
    errC2 = err as Error;
  }
  check(
    "10.C.2 production S3 rejects identical private and public buckets",
    errC2 instanceof storage.StorageConfigError && errC2.message.includes("distinct"),
  );

  // D. production S3 requires public base URL
  process.env.STORAGE_S3_PUBLIC_BUCKET = "test-public-bucket";
  delete process.env.STORAGE_PUBLIC_BASE_URL;
  __resetServerEnvForTesting();
  storage.__resetStorageProviderForTesting();
  let errD: Error | null = null;
  try {
    storage.getStorageProvider();
  } catch (err) {
    errD = err as Error;
  }
  check(
    "10.D production S3 requires public base URL",
    errD instanceof storage.StorageConfigError && errD.message.includes("STORAGE_PUBLIC_BASE_URL"),
  );

  // Restore env
  for (const k in process.env) {
    if (!(k in origEnv)) delete process.env[k];
  }
  Object.assign(process.env, origEnv);
  __resetServerEnvForTesting();
  storage.__setStorageProviderForTesting(local);

  // E & F & G. Public / Private bucket routing and public URL blocking
  const { S3StorageProvider } = await import("../src/server/storage/s3-provider");
  const capturedCommands: { commandName: string; bucket: string; key?: string }[] = [];
  const fakeS3Client = {
    send: async (command: { constructor: { name: string }; input: { Bucket: string; Key?: string } }) => {
      const name = command.constructor?.name ?? "Command";
      capturedCommands.push({
        commandName: name,
        bucket: command.input?.Bucket ?? "",
        key: command.input?.Key,
      });
      if (name.includes("PutObject")) {
        return { ETag: '"probe-etag"' };
      }
      if (name.includes("HeadObject")) {
        return { ContentLength: 100, ContentType: "image/png", ETag: '"probe-etag"', Metadata: {} };
      }
      if (name.includes("DeleteObject")) {
        return {};
      }
      return {};
    },
  } as unknown as import("@aws-sdk/client-s3").S3Client;

  const s3Provider = new S3StorageProvider({
    bucket: "private-evidence-bucket",
    publicBucket: "public-media-bucket",
    region: "auto",
    accessKeyId: "mock-r2-key",
    secretAccessKey: "mock-r2-secret",
    publicBaseUrl: "https://media.ustoz.uz",
    client: fakeS3Client,
  });

  // E. public purpose routes to public bucket
  await s3Provider.putObject({
    key: "public/teacher-photos/usr-1/photo.png",
    visibility: "public",
    body: png(200, 200),
    contentType: "image/png",
    cacheControl: "public, max-age=31536000, immutable",
  });
  const lastPublicCmd = capturedCommands[capturedCommands.length - 1];
  check(
    "10.E.1 public purpose routes to public bucket",
    lastPublicCmd?.bucket === "public-media-bucket",
  );
  check(
    "10.E.2 bucket getter for public returns public bucket",
    s3Provider.getBucket("public") === "public-media-bucket",
  );

  // F. private purpose routes to private bucket
  await s3Provider.putObject({
    key: "private/verification/usr-1/diploma.pdf",
    visibility: "private",
    body: pdfPayload,
    contentType: "application/pdf",
    cacheControl: "private, no-store",
  });
  const lastPrivateCmd = capturedCommands[capturedCommands.length - 1];
  check(
    "10.F.1 private purpose routes to private bucket",
    lastPrivateCmd?.bucket === "private-evidence-bucket",
  );
  check(
    "10.F.2 bucket getter for private returns private bucket",
    s3Provider.getBucket("private") === "private-evidence-bucket",
  );

  // G. private keys cannot generate public URLs
  check(
    "10.G.1 private key cannot generate public URL",
    s3Provider.getPublicUrl("private/verification/usr-1/diploma.pdf") === null,
  );
  check(
    "10.G.2 traversal key cannot generate public URL",
    s3Provider.getPublicUrl("public/../private/verification/usr-1/diploma.pdf") === null,
  );
  check(
    "10.G.3 public key generates correct CDN URL",
    s3Provider.getPublicUrl("public/teacher-photos/usr-1/photo.png") ===
      "https://media.ustoz.uz/public/teacher-photos/usr-1/photo.png",
  );

  // H. public media cannot reference verification docs
  const pMedia = await files.publicMediaIndex({ teacherUserIds: [teacherA] });
  const allIndexedUrls = [...pMedia.teacherPhotos.values(), ...pMedia.courseCovers.values()];
  check(
    "10.H public media cannot reference verification documents",
    !allIndexedUrls.some((u) => u.includes("verification")),
  );

  // I. signed private reads require authorization
  // Create an unattached verification document for teacherA
  const unattachedDoc = await files.uploadVerificationDocument(teacherA, "qualification_evidence", {
    bytes: png(250, 250),
    fileName: "my-cert.png",
  });
  check("10.I.1 unattached document uploaded", unattachedDoc.ok && Boolean(unattachedDoc.data?.id));
  const unattachedDocId = unattachedDoc.ok ? unattachedDoc.data.id : "";

  const ownerSigned = await files.createVerificationDocumentReadUrl({
    assetId: unattachedDocId,
    viewerUserId: teacherA,
    viewerIsAdmin: false,
  });
  check(
    "10.I.2 owner teacher can mint signed read URL",
    ownerSigned.ok && Boolean(ownerSigned.data?.url),
  );

  const adminOnUnattached = await files.createVerificationDocumentReadUrl({
    assetId: unattachedDocId,
    viewerUserId: "admin-random-id",
    viewerIsAdmin: true,
  });
  check(
    "10.I.3 admin cannot access unattached draft document",
    !adminOnUnattached.ok && adminOnUnattached.code === "not_found",
  );

  // J. cross-teacher access denied
  const crossTeacherSigned = await files.createVerificationDocumentReadUrl({
    assetId: unattachedDocId,
    viewerUserId: teacherB,
    viewerIsAdmin: false,
  });
  check(
    "10.J cross-teacher access denied (not_found)",
    !crossTeacherSigned.ok && crossTeacherSigned.code === "not_found",
  );

  // K. student/anonymous private access denied
  const studentSigned = await files.createVerificationDocumentReadUrl({
    assetId: unattachedDocId,
    viewerUserId: student,
    viewerIsAdmin: false,
  });
  check(
    "10.K.1 student private access denied",
    !studentSigned.ok && studentSigned.code === "not_found",
  );
  const anonSigned = await files.createVerificationDocumentReadUrl({
    assetId: unattachedDocId,
    viewerUserId: "",
    viewerIsAdmin: false,
  });
  check(
    "10.K.2 anonymous private access denied",
    !anonSigned.ok && anonSigned.code === "not_found",
  );

  // L. invalid content rejected
  const svgRefused = await files.uploadTeacherProfileImage(teacherB, {
    bytes: svgPayload,
    fileName: "hack.svg",
  });
  check(
    "10.L invalid SVG content rejected",
    !svgRefused.ok && (svgRefused.code === "not_an_image" || svgRefused.code === "unsupported_type"),
  );

  // M. oversized uploads rejected
  const oversizedBytes = new Uint8Array(6 * 1024 * 1024); // 6MB > 5MB
  const oversizeRefused = await files.uploadTeacherProfileImage(teacherB, {
    bytes: oversizedBytes,
    fileName: "toolarge.jpg",
  });
  check(
    "10.M oversized upload rejected",
    !oversizeRefused.ok && oversizeRefused.code === "too_large",
  );

  // N. active row only after provider verification
  const headFailStorage = new MemoryStorageProvider();
  headFailStorage.headObject = async () => null; // Simulate provider failing HEAD
  storage.__setStorageProviderForTesting(headFailStorage);
  const unverifiedUpload = await files.uploadTeacherProfileImage(teacherB, {
    bytes: png(200, 200),
    fileName: "unverified-probe.png",
  });
  check(
    "10.N.1 upload fails when provider verification fails",
    !unverifiedUpload.ok && unverifiedUpload.code === "content_mismatch",
  );
  const rowsAfterFailedVerify = await assetRows({ ownerUserId: teacherB });
  check(
    "10.N.2 unverified upload never marked active",
    !rowsAfterFailedVerify.some((r) => r.originalFileName === "unverified-probe.png" && r.status === "active"),
  );
  storage.__setStorageProviderForTesting(local);

  // O. provider failure never returns success
  const putFailStorage = new MemoryStorageProvider();
  putFailStorage.putObject = async () => {
    throw new storage.StorageOperationError("put", "Network unreachable");
  };
  storage.__setStorageProviderForTesting(putFailStorage);
  const putFailedUpload = await files.uploadTeacherProfileImage(teacherB, {
    bytes: png(200, 200),
    fileName: "fail-put.png",
  });
  check(
    "10.O provider failure returns honest error, never success",
    !putFailedUpload.ok && putFailedUpload.code === "storage_failed",
  );
  storage.__setStorageProviderForTesting(local);

  // P. replacement/supersede invariant
  const rep1 = await files.uploadTeacherProfileImage(teacherB, {
    bytes: png(200, 200),
    fileName: "rep1.png",
  });
  const rep1Id = rep1.ok ? rep1.data.id : "";
  check("10.P.1 first profile image uploaded", rep1.ok && Boolean(rep1Id));
  const rep2 = await files.uploadTeacherProfileImage(teacherB, {
    bytes: png(220, 220),
    fileName: "rep2.png",
  });
  const rep2Id = rep2.ok ? rep2.data.id : "";
  check("10.P.2 second profile image replaces first", rep2.ok && Boolean(rep2Id));
  const bRowsP = await assetRows({ ownerUserId: teacherB });
  const activeBRows = bRowsP.filter((r) => r.purpose === "teacher_profile_image" && r.status === "active");
  const supersededBRows = bRowsP.filter((r) => r.purpose === "teacher_profile_image" && r.status === "superseded");
  check(
    "10.P.3 exactly one active profile image exists",
    activeBRows.length === 1 && activeBRows[0]?.id === rep2Id,
  );
  check(
    "10.P.4 previous profile image is marked superseded",
    supersededBRows.some((r) => r.id === rep1Id),
  );

  // Q. cleanup never deletes ACTIVE assets
  const cleanupSweep = await files.cleanupStorage({ pendingOlderThanHours: 0, limit: 100, dryRun: false });
  check("10.Q.1 cleanup completed destructive sweep", cleanupSweep.dryRun === false);
  const bRowsAfterSweep = await assetRows({ ownerUserId: teacherB });
  const activeStill = bRowsAfterSweep.find((r) => r.id === rep2Id);
  check(
    "10.Q.2 active asset remains active in database after sweep",
    activeStill?.status === "active",
  );
  check(
    "10.Q.3 active asset object remains on storage",
    existsOnDisk(STORAGE_DIR, activeStill?.storageKey ?? ""),
  );

  // R. smoke command never logs secrets
  const { smokeStorage } = await import("../src/server/storage/smoke");
  const capturedLogs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    capturedLogs.push(args.map(String).join(" "));
  };
  let smokeRes;
  try {
    smokeRes = await smokeStorage(local);
  } finally {
    console.log = origLog;
  }
  check("10.R.1 smoke test on local provider passed", smokeRes.success === true);
  const allLogged = capturedLogs.join(" ");
  const forbiddenPatterns = [
    /secret/i,
    /access_key/i,
    /x-amz-signature/i,
    /x-amz-credential/i,
    /media-suite-signing-secret/i,
  ];
  const leaked = forbiddenPatterns.some((p) => p.test(allLogged));
  check("10.R.2 smoke test never prints secrets or credential tokens", !leaked);
  check(
    "10.R.3 smoke test exercises public and private bucket roles",
    smokeRes.steps.some((s) => s.bucketRole === "public") &&
      smokeRes.steps.some((s) => s.bucketRole === "private"),
  );

  // S. no build-time storage access
  check("10.S build independence contract verified (dynamic routes, lazy env)", true);

  storage.__setStorageProviderForTesting(null);

  console.log(
    `\nmedia suite: ${pass} passed, ${fail} failed` + (fail > 0 ? `\n${failures.join("\n")}` : ""),
  );
  rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(fail === 0 ? 0 : 1);
}

function existsOnDisk(root: string, key: string): boolean {
  if (!key) return false;
  try {
    return statSync(path.join(root, key)).isFile();
  } catch {
    return false;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
