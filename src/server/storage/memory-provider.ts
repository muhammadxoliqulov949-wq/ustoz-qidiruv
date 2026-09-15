import "server-only";
import { createHash } from "node:crypto";
import type { StorageVisibility } from "@/lib/media";
import { isSafeStorageKey } from "./keys";
import {
  clampPrivateReadSeconds,
  MEDIA_URL_PARAM_EXPIRES,
  MEDIA_URL_PARAM_SIGNATURE,
  signPrivateKey,
} from "./signing";
import {
  StorageOperationError,
  type PrivateReadUrl,
  type StorageProvider,
  type StoredObjectHead,
  type PutObjectInput,
} from "./types";

/* -------------------------------------------------------------------------- */
/* In-memory provider — TESTS ONLY.                                            */
/*                                                                              */
/* Deterministic, in-process, no network, no credentials: the upload suite can  */
/* assert the generated key, the stored content type, deletion and the signed   */
/* capability semantics without reaching the public internet. It implements the */
/* SAME contract as S3 and the local disk provider, so a behavior verified here */
/* is a behavior of the contract, not of a test double that quietly differs.    */
/* -------------------------------------------------------------------------- */

export interface MemoryObject {
  key: string;
  visibility: StorageVisibility;
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
  metadata: Record<string, string>;
  checksumSha256: string;
}

export interface MemoryStorageOptions {
  signingSecret?: string;
  publicBaseUrl?: string;
  now?: () => number;
  /** Set false to simulate a provider that cannot mint signed URLs. */
  supportsSignedRead?: boolean;
}

export class MemoryStorageProvider implements StorageProvider {
  readonly name = "memory";
  readonly supportsSignedRead: boolean;

  private readonly objects = new Map<string, MemoryObject>();
  private readonly secret: string;
  private readonly baseUrl: string;

  constructor(private readonly options: MemoryStorageOptions = {}) {
    this.secret = options.signingSecret ?? "memory-provider-test-secret";
    this.baseUrl = options.publicBaseUrl ?? "https://storage.test";
    this.supportsSignedRead = options.supportsSignedRead ?? true;
  }

  /* ------------------------- test-facing inspection ------------------------- */

  /** Every object currently stored, for assertions. */
  snapshot(): MemoryObject[] {
    return [...this.objects.values()];
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  get(key: string): MemoryObject | null {
    return this.objects.get(key) ?? null;
  }

  /** Simulate an out-of-band deletion (e.g. a bucket lifecycle rule). */
  forget(key: string): void {
    this.objects.delete(key);
  }

  /* ------------------------------ the contract ----------------------------- */

  async putObject(input: PutObjectInput): Promise<StoredObjectHead> {
    if (!isSafeStorageKey(input.key)) {
      throw new StorageOperationError("put", "Unsafe storage key.");
    }
    const keyVisibility = input.key.startsWith("private/") ? "private" : "public";
    if (keyVisibility !== input.visibility) {
      throw new StorageOperationError("put", "Key namespace does not match visibility.");
    }
    const checksum = createHash("sha256").update(input.body).digest("hex");
    this.objects.set(input.key, {
      key: input.key,
      visibility: input.visibility,
      body: new Uint8Array(input.body),
      contentType: input.contentType,
      cacheControl: input.cacheControl,
      metadata: input.metadata ?? {},
      checksumSha256: checksum,
    });
    return {
      key: input.key,
      byteSize: input.body.length,
      contentType: input.contentType,
      etag: checksum.slice(0, 32),
      metadata: input.metadata ?? {},
    };
  }

  async headObject(key: string, visibility: StorageVisibility): Promise<StoredObjectHead | null> {
    const object = this.objects.get(key);
    if (!object || object.visibility !== visibility) return null;
    return {
      key,
      byteSize: object.body.length,
      contentType: object.contentType,
      etag: object.checksumSha256.slice(0, 32),
      metadata: object.metadata,
    };
  }

  async deleteObject(key: string, visibility: StorageVisibility): Promise<void> {
    const object = this.objects.get(key);
    if (!object) return;
    if (object.visibility !== visibility) {
      throw new StorageOperationError("delete", "Key namespace does not match visibility.");
    }
    this.objects.delete(key);
  }

  getPublicUrl(key: string): string | null {
    if (!isSafeStorageKey(key) || !key.startsWith("public/")) return null;
    return `${this.baseUrl}/${key}`;
  }

  async createPrivateReadUrl(
    key: string,
    options: { expiresInSeconds: number; downloadFileName?: string | null },
  ): Promise<PrivateReadUrl> {
    if (!this.supportsSignedRead) {
      throw new StorageOperationError("sign", "Provider cannot sign private reads.");
    }
    if (!isSafeStorageKey(key) || !key.startsWith("private/")) {
      throw new StorageOperationError("sign", "Only private keys can be signed.");
    }
    const seconds = clampPrivateReadSeconds(options.expiresInSeconds);
    const now = this.options.now?.() ?? Date.now();
    const expiresAtEpochSeconds = Math.floor(now / 1000) + seconds;
    const signature = signPrivateKey({ key, expiresAtEpochSeconds, secret: this.secret });
    const query = new URLSearchParams({
      [MEDIA_URL_PARAM_EXPIRES]: String(expiresAtEpochSeconds),
      [MEDIA_URL_PARAM_SIGNATURE]: signature,
    });
    return {
      url: `${this.baseUrl}/${key}?${query.toString()}`,
      expiresAt: new Date(expiresAtEpochSeconds * 1000),
    };
  }

  /** Test helper: the secret, so a suite can forge an invalid signature. */
  get signingSecret(): string {
    return this.secret;
  }
}
