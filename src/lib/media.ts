/* -------------------------------------------------------------------------- */
/* Media contract — Phase 18. Pure, shared by server code AND client islands.   */
/*                                                                              */
/* This module contains NO Node APIs and NO secrets, so a Client Component can  */
/* import the limits, labels and validation copy without pulling anything       */
/* server-only into the browser bundle. That is deliberate: an upload control   */
/* must be able to explain the rules BEFORE a byte is sent, using the SAME      */
/* constants the server enforces afterwards.                                    */
/*                                                                              */
/* WHAT IS NOT HERE: storage keys are computed server-side (`storage/keys.ts`), */
/* credentials live in `server/env.ts`, and nothing in this file can decide a   */
/* visibility class — visibility is a property of the PURPOSE, fixed in code    */
/* here and enforced again by a database CHECK.                                 */
/* -------------------------------------------------------------------------- */

/* --------------------------------- purposes -------------------------------- */

export const FILE_PURPOSES = [
  /** PRIVATE. Evidence a teacher submits for trust review. */
  "teacher_verification_document",
  /** PUBLIC. The image on a teacher's public profile. */
  "teacher_profile_image",
  /** PUBLIC. The cover of a course listing. */
  "course_cover_image",
] as const;

export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** Asset lifecycle. `superseded` keeps replacement history truthful. */
export const FILE_STATUSES = ["pending", "active", "superseded", "deleted"] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export type StorageVisibility = "public" | "private";

/**
 * VISIBILITY IS DERIVED FROM PURPOSE, NEVER SUPPLIED BY A CLIENT.
 *
 * There is no function here that takes a visibility argument, so no code path
 * can ask for a public verification document — and the database re-checks the
 * same rule with a CHECK constraint.
 */
export const VISIBILITY_BY_PURPOSE: Record<FilePurpose, StorageVisibility> = {
  teacher_verification_document: "private",
  teacher_profile_image: "public",
  course_cover_image: "public",
};

/** Key namespace per purpose. Both values are server-generated only. */
export const KEY_PREFIX_BY_PURPOSE: Record<FilePurpose, string> = {
  teacher_verification_document: "private/verification",
  teacher_profile_image: "public/teacher-photos",
  course_cover_image: "public/course-covers",
};

/* ---------------------------------- limits --------------------------------- */

const KB = 1024;
const MB = 1024 * KB;

/**
 * Byte limits per purpose. Deliberately small: these are avatars, covers and
 * scanned documents — not video.
 */
export const MAX_BYTES_BY_PURPOSE: Record<FilePurpose, number> = {
  teacher_profile_image: 5 * MB,
  course_cover_image: 8 * MB,
  teacher_verification_document: 10 * MB,
};

/** One verification submission: bounded document count and total weight. */
export const MAX_VERIFICATION_DOCUMENTS = 4;
export const MAX_VERIFICATION_TOTAL_BYTES = 30 * MB;

/** Dimensions are validated loosely — a rule, not an art critic. */
export const MIN_PROFILE_IMAGE_EDGE = 128;
export const MIN_COVER_IMAGE_WIDTH = 480;

/* ------------------------------- allowed types ----------------------------- */

/**
 * Images are the three universally safe raster formats. SVG is excluded on
 * purpose: user-controlled SVG is a script execution surface, not an image.
 */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Verification evidence: PDF or the same raster images. No office documents and
 * no archives — we cannot safely render them and would only be storing a
 * liability.
 */
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_MIME_TYPES: Record<FilePurpose, readonly string[]> = {
  teacher_profile_image: IMAGE_MIME_TYPES,
  course_cover_image: IMAGE_MIME_TYPES,
  teacher_verification_document: DOCUMENT_MIME_TYPES,
};

/** Canonical extension per DETECTED type. Used to build the storage key. */
export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Human label for the accept="" attribute of a file input. */
export const ACCEPT_BY_PURPOSE: Record<FilePurpose, string> = {
  teacher_profile_image: ".jpg,.jpeg,.png,.webp",
  course_cover_image: ".jpg,.jpeg,.png,.webp",
  teacher_verification_document: ".pdf,.jpg,.jpeg,.png,.webp",
};

/** `accept` attribute value for a purpose (comma-separated extensions). */
export function acceptAttribute(purpose: FilePurpose): string {
  return ACCEPT_BY_PURPOSE[purpose];
}

/* ----------------------------- content sniffing ---------------------------- */

export type DetectedFileType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf"
  | "text/html"
  | "application/zip"
  | "application/octet-stream"
  | null;

/**
 * Identify a file by its MAGIC BYTES.
 *
 * The uploaded filename and the browser-supplied MIME type are both attacker
 * input; this is the only check that inspects the actual content. `text/html`
 * and `application/zip` are recognised explicitly so they can be rejected with
 * a precise message instead of a generic one.
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType {
  if (bytes.length < 4) return null;

  // %PDF-
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes.length >= 8 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF" ???? "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // ZIP container (docx/xlsx/zip) — pk\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return "application/zip";
  }
  // Anything that starts like markup is reported as HTML so the refusal can say
  // "not an image" rather than "unknown file".
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<?xml") || head.startsWith("<svg")) {
    return "text/html";
  }
  return "application/octet-stream";
}

/* ------------------------------ image geometry ----------------------------- */
export interface ImageDimensions {
  width: number;
  height: number;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

/**
 * Width/height of a PNG, JPEG or WEBP, read from the header bytes already in
 * hand — no image library, no decoding, no allocation of the pixel data.
 *
 * Returns null when the variant is not one we parse. That is deliberate: this
 * is a LOOSE check (a 1×1 avatar and a 12×12 "photo" are refused), not a
 * decoder, so an exotic-but-valid file must not be rejected because our parser
 * shrugged. Size, magic bytes and provider metadata remain the hard gates.
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  // PNG: IHDR is the first chunk after the 8-byte signature.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52
  ) {
    const width = (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!;
    const height = (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // JPEG: walk the marker segments to the first Start-Of-Frame.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      // Standalone markers carry no length field.
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = readUint16BE(bytes, offset + 2);
      if (length < 2) break;
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        const height = readUint16BE(bytes, offset + 5);
        const width = readUint16BE(bytes, offset + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += 2 + length;
    }
    return null;
  }

  // WEBP: three container variants.
  if (
    bytes.length >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunk === "VP8X") {
      const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      return { width, height };
    }
    if (
      chunk === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      const width = readUint16BE(bytes, 26) & 0x3fff;
      const height = readUint16BE(bytes, 28) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const b1 = bytes[21]!;
      const b2 = bytes[22]!;
      const b3 = bytes[23]!;
      const b4 = bytes[24]!;
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return { width, height };
    }
    return null;
  }

  return null;
}

/* -------------------------------- validation ------------------------------- */

export type MediaErrorCode =
  | "unsupported_type"
  | "too_large"
  | "empty_file"
  | "content_mismatch"
  | "not_an_image"
  | "too_small"
  | "too_many_documents"
  | "total_too_large";

export interface MediaValidationOk {
  ok: true;
  /** The type that will be stored: from CONTENT, never from the browser. */
  mimeType: string;
  extension: string;
  byteSize: number;
}

export interface MediaValidationFailure {
  ok: false;
  code: MediaErrorCode;
  message: string;
}

export type MediaValidation = MediaValidationOk | MediaValidationFailure;

/**
 * Validate one upload: declared type, declared size, and — when bytes are
 * available — the actual content. The server calls this with the real bytes
 * and the real length, so a forged `byteSize` or a renamed `.jpg` cannot pass.
 */
export function validateUpload(input: {
  purpose: FilePurpose;
  bytes: Uint8Array;
  byteSize?: number;
}): MediaValidation {
  const byteSize = input.byteSize ?? input.bytes.length;
  const max = MAX_BYTES_BY_PURPOSE[input.purpose];

  if (byteSize === 0) {
    return { ok: false, code: "empty_file", message: "Fayl bo‘sh — yaroqli fayl tanlang." };
  }
  if (byteSize > max) {
    return {
      ok: false,
      code: "too_large",
      message: `Fayl hajmi juda katta: ruxsat etilgan chegara ${formatBytes(max)}.`,
    };
  }

  const detected = detectFileType(input.bytes);
  const allowed = ALLOWED_MIME_TYPES[input.purpose];

  if (detected === null) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "Fayl turini aniqlab bo‘lmadi. Ruxsat etilgan formatlardan birini tanlang.",
    };
  }
  if (!allowed.includes(detected)) {
    const isImagePurpose =
      input.purpose === "teacher_profile_image" || input.purpose === "course_cover_image";
    if (isImagePurpose && detected !== "application/octet-stream") {
      return {
        ok: false,
        code: "not_an_image",
        message: "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.",
      };
    }
    return {
      ok: false,
      code: "unsupported_type",
      message:
        input.purpose === "teacher_verification_document"
          ? "Hujjat PDF, JPG, PNG yoki WEBP bo‘lishi kerak."
          : "Bu fayl turi qo‘llab-quvvatlanmaydi.",
    };
  }

  /*
   * LOOSE GEOMETRY. A 1×1 PNG is a valid PNG and would sail through every
   * other gate, so the two image purposes carry a minimum. Only formats whose
   * header we can actually read are measured; a null measurement is a pass,
   * never a rejection (see readImageDimensions).
   */
  if (input.purpose !== "teacher_verification_document") {
    const dimensions = readImageDimensions(input.bytes);
    if (dimensions !== null) {
      const minimumEdge =
        input.purpose === "course_cover_image" ? MIN_COVER_IMAGE_WIDTH : MIN_PROFILE_IMAGE_EDGE;
      const measured =
        input.purpose === "course_cover_image"
          ? dimensions.width
          : Math.min(dimensions.width, dimensions.height);
      if (measured < minimumEdge) {
        return {
          ok: false,
          code: "too_small",
          message:
            input.purpose === "course_cover_image"
              ? `Muqova uchun rasm kamida ${MIN_COVER_IMAGE_WIDTH}px keng bo‘lishi kerak.`
              : `Profil rasmi kamida ${MIN_PROFILE_IMAGE_EDGE}×${MIN_PROFILE_IMAGE_EDGE}px bo‘lishi kerak.`,
        };
      }
    }
  }

  return {
    ok: true,
    mimeType: detected,
    extension: EXTENSION_BY_MIME[detected] ?? "bin",
    byteSize,
  };
}

/** Whether an HTML/ZIP/executable disguised as an image is refused. */
export function isDisguisedFile(input: { bytes: Uint8Array; purpose: FilePurpose }): boolean {
  const result = validateUpload(input);
  return !result.ok && (result.code === "not_an_image" || result.code === "unsupported_type");
}

/* ------------------------------ document types ----------------------------- */

/**
 * Deliberately minimal. This is PLATFORM TRUST verification — a human review of
 * plausible evidence — NOT government identity certification, and the product
 * makes no claim to verify diplomas against issuing registries.
 */
export const VERIFICATION_DOCUMENT_TYPES = [
  "identity_document",
  "qualification_evidence",
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const VERIFICATION_DOCUMENT_TYPE_LABEL: Record<VerificationDocumentType, string> = {
  identity_document: "Shaxsni tasdiqlovchi hujjat",
  qualification_evidence: "Malaka yoki tajriba dalili",
};

export const VERIFICATION_DOCUMENT_TYPE_HINT: Record<VerificationDocumentType, string> = {
  identity_document: "Pasport yoki ID karta nusxasi (PDF yoki rasm).",
  qualification_evidence: "Sertifikat, diplom yoki tajribani ko‘rsatuvchi hujjat (ixtiyoriy).",
};

/** Identity evidence is the ONE required document. */
export const REQUIRED_VERIFICATION_DOCUMENT_TYPES: readonly VerificationDocumentType[] = [
  "identity_document",
];

/* ----------------------------------- copy ---------------------------------- */

export const MEDIA_PRIVACY_NOTE =
  "Tasdiqlash hujjatlari ommaviy profilga chiqarilmaydi va faqat tekshiruv uchun vakolatli administratorlarga ko‘rsatiladi.";

export const MEDIA_PUBLIC_NOTE =
  "Bu rasm ommaviy profil va kurs sahifalarida ko‘rinadi.";

export const MEDIA_SCAN_BOUNDARY_NOTE =
  "Fayllar turi va hajmi bo‘yicha tekshiriladi; zararli dasturlarga qarshi skanerlash hozircha ulanmagan.";

export const MEDIA_VIEW_URL_NOTE =
  "Hujjatga havola qisqa muddatli (10 daqiqa) va faqat vakolatli foydalanuvchi uchun yaratiladi.";

export const MEDIA_STORAGE_DISABLED_NOTE =
  "Fayl yuklash bu muhitda sozlanmagan (storage env yo‘q). Yuklash o‘rniga sozlamani to‘ldiring.";

export const MEDIA_UPLOAD_FAILED_NOTE =
  "Yuklashni yakunlab bo‘lmadi. Fayl saqlanmagan deb hisoblang va qayta urinib ko‘ring.";

export const MEDIA_REMOVED_NOTE = "Fayl o‘chirildi.";

export const MEDIA_PENDING_NOTE = "Yuklanmoqda…";

/** Verification-document deletion is only possible before submission. */
export const MEDIA_DOCUMENTS_FROZEN_NOTE =
  "Ariza ko‘rib chiqilayotganda hujjatlarni o‘zgartirib bo‘lmaydi.";

export const MEDIA_DOCUMENTS_REQUIRED_NOTE =
  "Ariza yuborish uchun kamida shaxsni tasdiqlovchi hujjat yuklang.";

/* ---------------------------------- helpers -------------------------------- */

/** Compact human size, e.g. "1,2 MB". Used in UI labels only. */
export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(0)} KB`;
  const mb = bytes / MB;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/**
 * Display-only filename. The ORIGINAL name is stored for the reviewer's
 * benefit, but it is never used as a path, and control characters are stripped
 * so it cannot break a header or a layout.
 */
export function sanitizeDisplayFileName(name: string, maxLength = 120): string {
  const cleaned = name
    // Control characters would corrupt a header or a layout, so they go first.
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim();
  if (cleaned.length <= maxLength) return cleaned.length > 0 ? cleaned : "fayl";
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 6 ? cleaned.slice(dot) : "";
  return `${cleaned.slice(0, maxLength - ext.length - 1)}…${ext}`;
}

/** One-line requirement summary rendered next to the upload control. */
export function uploadRulesText(purpose: FilePurpose): string {
  const max = formatBytes(MAX_BYTES_BY_PURPOSE[purpose]);
  if (purpose === "teacher_verification_document") {
    return `PDF, JPG, PNG yoki WEBP · har biri ${max} gacha`;
  }
  return `JPG, PNG yoki WEBP · ${max} gacha`;
}
