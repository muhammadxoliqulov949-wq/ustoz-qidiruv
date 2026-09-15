import "server-only";
import type { StorageVisibility } from "@/lib/media";

/* -------------------------------------------------------------------------- */
/* Storage contract — Phase 18.                                                */
/*                                                                              */
/* Everything the application is allowed to know about object storage lives in  */
/* these five operations. Provider SDKs, URL formats and credential handling    */
/* stay inside the provider implementations, so the rest of the codebase cannot */
/* depend on S3 (or anything else) by accident.                                 */
/*                                                                              */
/* The contract is deliberately small: no listing, no multipart, no arbitrary   */
/* ranges. Phase 18 stores avatars, covers and small scanned documents — a      */
/* bigger surface would be surface nobody uses.                                 */
/* -------------------------------------------------------------------------- */

export interface StoredObjectHead {
  key: string;
  byteSize: number;
  /** Content type the OBJECT carries in storage (authority after upload). */
  contentType: string;
  etag: string | null;
  /** Provider metadata we set ourselves (e.g. the sha256 we computed). */
  metadata: Record<string, string>;
}

export interface PutObjectInput {
  key: string;
  visibility: StorageVisibility;
  body: Uint8Array;
  contentType: string;
  /** Cache policy for the stored object (public: long, private: none). */
  cacheControl: string;
  metadata?: Record<string, string>;
}

export interface PrivateReadUrl {
  url: string;
  expiresAt: Date;
}

export interface StorageProvider {
  /** Provider name, persisted on every asset row for forensics/cleanup. */
  readonly name: string;
  /**
   * FALSE when the provider cannot mint time-limited URLs (a filesystem dev
   * store, for example, serves private objects through the app instead). The
   * service still performs the same authorization; only the delivery differs.
   */
  readonly supportsSignedRead: boolean;

  putObject(input: PutObjectInput): Promise<StoredObjectHead>;

  /** Metadata lookup. Returns null when the object does not exist. */
  headObject(key: string, visibility: StorageVisibility): Promise<StoredObjectHead | null>;

  deleteObject(key: string, visibility: StorageVisibility): Promise<void>;

  /**
   * Stable, unsigned URL for a PUBLIC object. Pure: no I/O, so projections can
   * build it while rendering. Returns null when this deployment has no public
   * delivery configured, and callers then fall back to the legacy static path.
   */
  getPublicUrl(key: string): string | null;

  /** Short-lived, capability-style URL for a PRIVATE object. */
  createPrivateReadUrl(
    key: string,
    options: { expiresInSeconds: number; downloadFileName?: string | null },
  ): Promise<PrivateReadUrl>;
}

/** Thrown when uploads are requested but the deployment has no valid storage. */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

/** Honest failure for "the provider said no" (network, permissions, 4xx). */
export class StorageOperationError extends Error {
  constructor(
    readonly operation: "put" | "head" | "delete" | "sign",
    message: string,
  ) {
    super(message);
    this.name = "StorageOperationError";
  }
}
