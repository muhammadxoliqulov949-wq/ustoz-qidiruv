import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageVisibility } from "@/lib/media";
import { isSafeStorageKey } from "./keys";
import { clampPrivateReadSeconds } from "./signing";
import {
  StorageOperationError,
  type PrivateReadUrl,
  type StorageProvider,
  type StoredObjectHead,
  type PutObjectInput,
} from "./types";

/* -------------------------------------------------------------------------- */
/* S3-compatible provider — the PRODUCTION provider (Phase 18).                 */
/*                                                                              */
/* WHY S3: it is the interoperability standard, so the same code runs on AWS S3, */
/* Cloudflare R2, Backblaze B2 (S3 API) or a self-hosted MinIO — a deployment   */
/* decision, not an application rewrite. It gives all four properties Phase 18  */
/* needs: explicit content type, per-object metadata, presigned time-limited    */
/* reads, and predictable deletion.                                            */
/*                                                                              */
/* TWO NAMESPACES, TWO BUCKETS. Private evidence and public covers are stored   */
/* in the SAME account but under DIFFERENT prefixes, and are expected to live in */
/* separate buckets (or a bucket whose public distribution rule exposes only     */
/* `public/*`). `private/` objects are NEVER presignable for anyone but an      */
/* authorized viewer, and the presigned URL itself carries                     */
/* `response-cache-control: private, no-store` so a shared proxy cannot cache   */
/* evidence that leaked into a URL.                                            */
/*                                                                              */
/* CREDENTIALS: read from server-only env, never logged, never returned.        */
/* -------------------------------------------------------------------------- */

export interface S3StorageOptions {
  bucket: string;
  /** Bucket for `public/` objects. Defaults to the private bucket. */
  publicBucket?: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** Unsigned base URL of the public namespace (CDN / r2.dev / S3 website). */
  publicBaseUrl?: string;
  /** Injectable for tests: lets a suite point the SDK at a local HTTP double. */
  client?: S3Client;
}

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  readonly supportsSignedRead = true;

  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client =
      options.client ??
      new S3Client({
        region: options.region,
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
        forcePathStyle: options.forcePathStyle ?? false,
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });
  }

  private bucketFor(visibility: StorageVisibility): string {
    if (visibility === "public") return this.options.publicBucket ?? this.options.bucket;
    return this.options.bucket;
  }

  private assertKey(key: string, visibility: StorageVisibility): void {
    if (!isSafeStorageKey(key)) {
      throw new StorageOperationError("put", "Unsafe storage key.");
    }
    const expected = visibility === "private" ? "private/" : "public/";
    if (!key.startsWith(expected)) {
      throw new StorageOperationError("put", "Key namespace does not match visibility.");
    }
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectHead> {
    this.assertKey(input.key, input.visibility);
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketFor(input.visibility),
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
          Metadata: input.metadata,
        }),
      );
      return {
        key: input.key,
        byteSize: input.body.length,
        contentType: input.contentType,
        etag: response.ETag?.replace(/"/g, "") ?? null,
        metadata: input.metadata ?? {},
      };
    } catch (error) {
      throw new StorageOperationError("put", (error as Error).message);
    }
  }

  async headObject(key: string, visibility: StorageVisibility): Promise<StoredObjectHead | null> {
    this.assertKey(key, visibility);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }),
      );
      return {
        key,
        byteSize: Number(response.ContentLength ?? 0),
        contentType: response.ContentType ?? "application/octet-stream",
        etag: response.ETag?.replace(/"/g, "") ?? null,
        metadata: (response.Metadata ?? {}) as Record<string, string>,
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      // A missing object is a NORMAL answer here (cleanup, verification), not a
      // failure: anything else is reported as an operation error.
      if (name === "NotFound" || name === "NoSuchKey" || name === "404") return null;
      throw new StorageOperationError("head", (error as Error).message);
    }
  }

  async deleteObject(key: string, visibility: StorageVisibility): Promise<void> {
    this.assertKey(key, visibility);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }),
      );
    } catch (error) {
      throw new StorageOperationError("delete", (error as Error).message);
    }
  }

  getPublicUrl(key: string): string | null {
    if (!this.options.publicBaseUrl) return null;
    if (!isSafeStorageKey(key) || !key.startsWith("public/")) return null;
    return `${this.options.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  /**
   * Presigned GET. The response overrides are part of the SIGNED request, so the
   * cache and disposition policy cannot be changed by editing the URL:
   *   • `private, no-store`     — a private read must never be shared-cached;
   *   • `inline; filename="…"`  — safe preview for PDF and images, sanitized
   *                               name only (no header injection, no path);
   *   • `response-content-type` — pinned to the stored type, so a mislabelled
   *                               object cannot be rendered as HTML.
   */
  async createPrivateReadUrl(
    key: string,
    options: { expiresInSeconds: number; downloadFileName?: string | null },
  ): Promise<PrivateReadUrl> {
    this.assertKey(key, "private");
    const seconds = clampPrivateReadSeconds(options.expiresInSeconds);
    const fileName = options.downloadFileName?.replace(/["\\\r\n]/g, "").slice(0, 120);
    try {
      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucketFor("private"),
          Key: key,
          ResponseCacheControl: "private, no-store",
          ...(fileName ? { ResponseContentDisposition: `inline; filename="${fileName}"` } : {}),
        }),
        { expiresIn: seconds },
      );
      return { url, expiresAt: new Date(Date.now() + seconds * 1000) };
    } catch (error) {
      throw new StorageOperationError("sign", (error as Error).message);
    }
  }
}
